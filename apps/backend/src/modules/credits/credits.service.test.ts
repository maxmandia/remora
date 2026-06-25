import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { BillingRepository } from "../billing/billing.repository.ts";
import type { RealtimeRepository } from "../realtime/realtime.repository.ts";
import type { CreditsRepository } from "./credits.repository.ts";
import { CreditsService } from "./credits.service.ts";
import {
  CreditBalanceMutationRejectedError,
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
  InsufficientCreditBalanceError,
  ManualCreditPurchaseVerificationError,
} from "./credits.types.ts";

vi.mock("../billing/billing.repository.ts", () => ({
  billingRepository: {
    getBillingProfileByUserId: vi.fn(),
  },
}));

vi.mock("./credits.repository.ts", () => ({
  creditsRepository: {
    findManualCreditPurchaseGrantByIdempotencyKey: vi.fn(),
    updateCreditBalance: vi.fn(),
    createCreditLedgerEntry: vi.fn(),
  },
}));

vi.mock("../../db/transaction-manager.ts", () => ({
  transactionManager: {
    transaction: vi.fn(),
  },
}));

describe("CreditsService", () => {
  it("creates Stripe checkout sessions for manual credit purchases", async () => {
    const stripeCheckoutSessionClient = {
      create: vi.fn().mockResolvedValue({
        url: "https://checkout.stripe.test/session_1",
      }),
    };
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionClient,
      webOrigin: "https://app.example.test",
    });

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    expect(stripeCheckoutSessionClient.create).toHaveBeenCalledWith({
      mode: "payment",
      customer: "cus_123",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 2500,
            product_data: {
              name: "Remora credits",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        remora_user_id: "user_1",
        amount_cents: "2500",
        credit_amount_usd_micros: "25000000",
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
      payment_intent_data: {
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "2500",
          credit_amount_usd_micros: "25000000",
          purchase_kind: "manual_credit_purchase",
          metadata_version: "1",
        },
      },
      success_url: "https://app.example.test/?credit_checkout=success",
      cancel_url: "https://app.example.test/?credit_checkout=cancel",
    });
  });

  it("requires a billing profile before creating checkout", async () => {
    const stripeCheckoutSessionClient = {
      create: vi.fn(),
    };
    const service = new CreditsService(
      createBillingRepository({ stripeCustomerId: null }),
      {
        stripeCheckoutSessionClient,
        webOrigin: "https://app.example.test",
      },
    );

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).rejects.toBeInstanceOf(CreditCheckoutBillingProfileMissingError);
    expect(stripeCheckoutSessionClient.create).not.toHaveBeenCalled();
  });

  it("requires Stripe checkout sessions to include a URL", async () => {
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionClient: {
        create: vi.fn().mockResolvedValue({
          url: null,
        }),
      },
      webOrigin: "https://app.example.test",
    });

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).rejects.toBeInstanceOf(CreditCheckoutSessionUrlMissingError);
  });

  it("verifies paid Stripe checkout sessions for manual credit purchases", async () => {
    const stripeCheckoutSessionRetrieveClient = {
      retrieve: vi.fn().mockResolvedValue(createCheckoutSession()),
    };
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionRetrieveClient,
    });

    await expect(
      service.verifyManualCreditCheckoutSession({
        stripeCheckoutSessionId: "cs_123",
        stripeEventId: "evt_123",
      }),
    ).resolves.toEqual({
      userId: "user_1",
      amountCents: 2500,
      creditAmountUsdMicros: 25_000_000,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
    });
    expect(stripeCheckoutSessionRetrieveClient.retrieve).toHaveBeenCalledWith(
      "cs_123",
    );
  });

  it.each([
    {
      name: "invalid metadata",
      session: createCheckoutSession({
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "twenty-five",
          credit_amount_usd_micros: "25000000",
          purchase_kind: "manual_credit_purchase",
          metadata_version: "1",
        },
      }),
    },
    {
      name: "wrong purchase kind",
      session: createCheckoutSession({
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "2500",
          credit_amount_usd_micros: "25000000",
          purchase_kind: "subscription",
          metadata_version: "1",
        },
      }),
    },
    {
      name: "wrong currency",
      session: createCheckoutSession({ currency: "eur" }),
    },
    {
      name: "unpaid session",
      session: createCheckoutSession({ payment_status: "unpaid" }),
    },
    {
      name: "amount mismatch",
      session: createCheckoutSession({ amount_total: 2600 }),
    },
    {
      name: "credit amount mismatch",
      session: createCheckoutSession({
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "2500",
          credit_amount_usd_micros: "26000000",
          purchase_kind: "manual_credit_purchase",
          metadata_version: "1",
        },
      }),
    },
    {
      name: "customer mismatch",
      session: createCheckoutSession({ customer: "cus_other" }),
    },
  ])("rejects $name", async ({ session }) => {
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionRetrieveClient: {
        retrieve: vi.fn().mockResolvedValue(session),
      },
    });

    await expect(
      service.verifyManualCreditCheckoutSession({
        stripeCheckoutSessionId: "cs_123",
        stripeEventId: "evt_123",
      }),
    ).rejects.toBeInstanceOf(ManualCreditPurchaseVerificationError);
  });

  it("rejects sessions without a matching billing profile", async () => {
    const service = new CreditsService(
      createBillingRepository({ stripeCustomerId: null }),
      {
        stripeCheckoutSessionRetrieveClient: {
          retrieve: vi.fn().mockResolvedValue(createCheckoutSession()),
        },
      },
    );

    await expect(
      service.verifyManualCreditCheckoutSession({
        stripeCheckoutSessionId: "cs_123",
        stripeEventId: "evt_123",
      }),
    ).rejects.toBeInstanceOf(ManualCreditPurchaseVerificationError);
  });

  it("grants verified manual credit purchases through the repository", async () => {
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValue(null);
    const updateCreditBalance = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    const createCreditLedgerEntry = vi.fn().mockResolvedValue({
      id: "ledger_1",
    });
    const transactions = createTransactionManager({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
      } as unknown as CreditsRepository,
      realtimeRepository,
      transactionManager: transactions,
    });
    const verifiedPurchase = createVerifiedPurchase();

    await expect(
      service.grantManualCreditPurchase(verifiedPurchase),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: false,
    });
    expect(findManualCreditPurchaseGrantByIdempotencyKey).toHaveBeenCalledWith(
      "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
    );
    expect(updateCreditBalance).toHaveBeenCalledWith({
      userId: "user_1",
      entryType: "manual_credit_purchase",
      availableCreditDeltaUsdMicros: 25_000_000,
      reservedCreditDeltaUsdMicros: 0,
      generationJobId: null,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      idempotencyKey: "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      metadata: {
        amount_cents: 2500,
        credit_amount_usd_micros: 25_000_000,
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
    });
    expect(createCreditLedgerEntry).toHaveBeenCalledWith({
      userId: "user_1",
      entryType: "manual_credit_purchase",
      availableCreditDeltaUsdMicros: 25_000_000,
      reservedCreditDeltaUsdMicros: 0,
      generationJobId: null,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      idempotencyKey: "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      metadata: {
        amount_cents: 2500,
        credit_amount_usd_micros: 25_000_000,
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
      availableCreditAmountUsdMicrosAfter: 25_000_000,
      reservedCreditAmountUsdMicrosAfter: 0,
    });
    expect(realtimeRepository.publishInternalEvent).toHaveBeenCalledWith({
      id: expect.stringMatching(/^credits\.balance\.updated:.+$/),
      type: "credits.balance.updated",
      userId: "user_1",
      occurredAt: expect.any(String),
      payload: {},
    });
  });

  it("publishes balance updates after fresh balance mutations resolve", async () => {
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValue(null);
    const updateCreditBalance = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    let resolveCreateCreditLedgerEntry!: (value: { id: string }) => void;
    const createCreditLedgerEntry = vi.fn(
      () =>
        new Promise<{ id: string }>((resolve) => {
          resolveCreateCreditLedgerEntry = resolve;
        }),
    );
    const transactions = createTransactionManager({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
      } as unknown as CreditsRepository,
      realtimeRepository,
      transactionManager: transactions,
    });

    const grantPromise = service.grantManualCreditPurchase(
      createVerifiedPurchase(),
    );

    await vi.waitFor(() => {
      expect(createCreditLedgerEntry).toHaveBeenCalledTimes(1);
    });
    expect(realtimeRepository.publishInternalEvent).not.toHaveBeenCalled();

    resolveCreateCreditLedgerEntry({ id: "ledger_1" });

    await expect(grantPromise).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: false,
    });
    expect(realtimeRepository.publishInternalEvent).toHaveBeenCalledWith({
      id: expect.stringMatching(/^credits\.balance\.updated:.+$/),
      type: "credits.balance.updated",
      userId: "user_1",
      occurredAt: expect.any(String),
      payload: {},
    });
  });

  it("returns existing grants without inserting again", async () => {
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValue({
        userId: "user_1",
        availableCreditAmountUsdMicros: 25_000_000,
        reservedCreditAmountUsdMicros: 0,
        ledgerEntryId: "ledger_1",
      });
    const transactions = createTransactionManager();
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
      } as unknown as CreditsRepository,
      realtimeRepository,
      transactionManager: transactions,
    });

    await expect(
      service.grantManualCreditPurchase(createVerifiedPurchase()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: true,
    });
    expect(transactions.transaction).not.toHaveBeenCalled();
    expect(realtimeRepository.publishInternalEvent).not.toHaveBeenCalled();
  });

  it("returns the existing grant when a concurrent insert wins the idempotency race", async () => {
    const existingGrant = {
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
    };
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingGrant);
    const updateCreditBalance = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    const createCreditLedgerEntry = vi.fn().mockRejectedValue({
      code: "23505",
      constraint_name: "credit_ledger_entry_idempotency_key_idx",
    });
    const transactions = createTransactionManager({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
      } as unknown as CreditsRepository,
      realtimeRepository,
      transactionManager: transactions,
    });

    await expect(
      service.grantManualCreditPurchase(createVerifiedPurchase()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: true,
    });
    expect(findManualCreditPurchaseGrantByIdempotencyKey).toHaveBeenCalledTimes(
      2,
    );
    expect(realtimeRepository.publishInternalEvent).not.toHaveBeenCalled();
  });

  it("keeps granted manual credit purchases successful when realtime publish fails", async () => {
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValue(null);
    const updateCreditBalance = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    const createCreditLedgerEntry = vi.fn().mockResolvedValue({
      id: "ledger_1",
    });
    const transactions = createTransactionManager({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository({
      publishInternalEvent: vi
        .fn()
        .mockRejectedValue(new Error("Realtime unavailable")),
    });
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
      } as unknown as CreditsRepository,
      realtimeRepository,
      transactionManager: transactions,
    });

    await expect(
      service.grantManualCreditPurchase(createVerifiedPurchase()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: false,
    });
    expect(realtimeRepository.publishInternalEvent).toHaveBeenCalledTimes(1);
  });

  it("reserves generation job costs through the provided transaction", async () => {
    const updateCreditBalance = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 24_580_000,
      reservedCreditAmountUsdMicros: 420_000,
    });
    const createCreditLedgerEntry = vi.fn().mockResolvedValue({
      id: "ledger_1",
    });
    const creditTransaction = createCreditTransactionHarness({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      realtimeRepository,
    });

    await expect(
      service.reserveGenerationJobCostEstimate(
        {
          userId: "user_1",
          generationSubmissionId: "submission_1",
          generationJobId: "job_1",
          generationJobCostId: "estimate_1",
          estimatedCostUsdMicros: 420_000,
        },
        creditTransaction.transaction,
      ),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmountUsdMicros: 24_580_000,
      reservedCreditAmountUsdMicros: 420_000,
      ledgerEntryId: "ledger_1",
    });
    expect(updateCreditBalance).toHaveBeenCalledWith({
      userId: "user_1",
      entryType: "generation_credit_reservation",
      availableCreditDeltaUsdMicros: -420_000,
      reservedCreditDeltaUsdMicros: 420_000,
      generationJobId: "job_1",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      idempotencyKey: "generation:job:job_1:credit-reservation:v1",
      metadata: {
        generation_submission_id: "submission_1",
        generation_job_cost_estimate_id: "estimate_1",
        estimated_cost_usd_micros: 420_000,
        credit_reservation_kind: "generation_credit_reservation",
        metadata_version: "1",
      },
    });
    expect(createCreditLedgerEntry).toHaveBeenCalledWith({
      userId: "user_1",
      entryType: "generation_credit_reservation",
      availableCreditDeltaUsdMicros: -420_000,
      reservedCreditDeltaUsdMicros: 420_000,
      generationJobId: "job_1",
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      idempotencyKey: "generation:job:job_1:credit-reservation:v1",
      metadata: {
        generation_submission_id: "submission_1",
        generation_job_cost_estimate_id: "estimate_1",
        estimated_cost_usd_micros: 420_000,
        credit_reservation_kind: "generation_credit_reservation",
        metadata_version: "1",
      },
      availableCreditAmountUsdMicrosAfter: 24_580_000,
      reservedCreditAmountUsdMicrosAfter: 420_000,
    });
    expect(creditTransaction.afterCommit).toHaveBeenCalledWith(
      expect.any(Function),
      {
        key: "credits.balance.updated:user_1",
      },
    );
    expect(realtimeRepository.publishInternalEvent).not.toHaveBeenCalled();
  });

  it("coalesces same-user reservation balance updates in one transaction", async () => {
    const creditTransaction = createCreditTransactionHarness({
      createCreditLedgerEntry: vi
        .fn()
        .mockResolvedValueOnce({ id: "ledger_1" })
        .mockResolvedValueOnce({ id: "ledger_2" }),
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      realtimeRepository,
    });

    await service.reserveGenerationJobCostEstimate(
      {
        userId: "user_1",
        generationSubmissionId: "submission_1",
        generationJobId: "job_1",
        generationJobCostId: "estimate_1",
        estimatedCostUsdMicros: 420_000,
      },
      creditTransaction.transaction,
    );
    await service.reserveGenerationJobCostEstimate(
      {
        userId: "user_1",
        generationSubmissionId: "submission_1",
        generationJobId: "job_2",
        generationJobCostId: "estimate_2",
        estimatedCostUsdMicros: 420_000,
      },
      creditTransaction.transaction,
    );

    await creditTransaction.runAfterCommit();

    expect(creditTransaction.afterCommit).toHaveBeenCalledTimes(2);
    expect(realtimeRepository.publishInternalEvent).toHaveBeenCalledTimes(1);
    expect(realtimeRepository.publishInternalEvent).toHaveBeenCalledWith({
      id: expect.stringMatching(/^credits\.balance\.updated:.+$/),
      type: "credits.balance.updated",
      userId: "user_1",
      occurredAt: expect.any(String),
      payload: {},
    });
  });

  it("skips ledger and balance mutation for zero-cost generation jobs", async () => {
    const updateCreditBalance = vi.fn();
    const createCreditLedgerEntry = vi.fn();
    const creditTransaction = createCreditTransactionHarness({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const service = new CreditsService(createBillingRepository());

    await expect(
      service.reserveGenerationJobCostEstimate(
        {
          userId: "user_1",
          generationSubmissionId: "submission_1",
          generationJobId: "job_1",
          generationJobCostId: "estimate_1",
          estimatedCostUsdMicros: 0,
        },
        creditTransaction.transaction,
      ),
    ).resolves.toBeNull();
    expect(updateCreditBalance).not.toHaveBeenCalled();
    expect(createCreditLedgerEntry).not.toHaveBeenCalled();
    expect(creditTransaction.afterCommit).not.toHaveBeenCalled();
  });

  it("translates rejected reservation balance updates into insufficient balance errors", async () => {
    const updateCreditBalance = vi
      .fn()
      .mockRejectedValue(new CreditBalanceMutationRejectedError("user_1"));
    const createCreditLedgerEntry = vi.fn();
    const creditTransaction = createCreditTransactionHarness({
      updateCreditBalance,
      createCreditLedgerEntry,
    });
    const realtimeRepository = createRealtimeRepository();
    const service = new CreditsService(createBillingRepository(), {
      realtimeRepository,
    });

    await expect(
      service.reserveGenerationJobCostEstimate(
        {
          userId: "user_1",
          generationSubmissionId: "submission_1",
          generationJobId: "job_1",
          generationJobCostId: "estimate_1",
          estimatedCostUsdMicros: 420_000,
        },
        creditTransaction.transaction,
      ),
    ).rejects.toBeInstanceOf(InsufficientCreditBalanceError);
    expect(createCreditLedgerEntry).not.toHaveBeenCalled();
    expect(creditTransaction.afterCommit).not.toHaveBeenCalled();
    expect(realtimeRepository.publishInternalEvent).not.toHaveBeenCalled();
  });
});

function createVerifiedPurchase() {
  return {
    userId: "user_1",
    amountCents: 2500,
    creditAmountUsdMicros: 25_000_000,
    stripeCheckoutSessionId: "cs_123",
    stripePaymentIntentId: "pi_123",
    stripeEventId: "evt_123",
  };
}

function createBillingRepository({
  stripeCustomerId = "cus_123",
}: {
  stripeCustomerId?: string | null;
} = {}) {
  return {
    getBillingProfileByUserId: vi.fn().mockResolvedValue(
      stripeCustomerId
        ? {
            userId: "user_1",
            stripeCustomerId,
          }
        : null,
    ),
  } as unknown as BillingRepository;
}

function createRealtimeRepository({
  publishInternalEvent = vi.fn(async () => undefined),
}: {
  publishInternalEvent?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    publishInternalEvent,
  } as unknown as RealtimeRepository;
}

function createTransactionManager({
  updateCreditBalance = vi.fn().mockResolvedValue({
    userId: "user_1",
    availableCreditAmountUsdMicros: 25_000_000,
    reservedCreditAmountUsdMicros: 0,
  }),
  createCreditLedgerEntry = vi.fn().mockResolvedValue({ id: "ledger_1" }),
}: {
  updateCreditBalance?: ReturnType<typeof vi.fn>;
  createCreditLedgerEntry?: ReturnType<typeof vi.fn>;
} = {}) {
  return {
    transaction: vi.fn(
      async (callback: (tx: TransactionManager) => Promise<unknown>) => {
        const transaction = createCreditTransactionHarness({
          updateCreditBalance,
          createCreditLedgerEntry,
        });
        const result = await callback(transaction.transaction);

        await transaction.runAfterCommit();

        return result;
      },
    ),
  } as unknown as TransactionManager;
}

function createCreditTransactionHarness({
  updateCreditBalance = vi.fn().mockResolvedValue({
    userId: "user_1",
    availableCreditAmountUsdMicros: 25_000_000,
    reservedCreditAmountUsdMicros: 0,
  }),
  createCreditLedgerEntry = vi.fn().mockResolvedValue({ id: "ledger_1" }),
}: {
  updateCreditBalance?: ReturnType<typeof vi.fn>;
  createCreditLedgerEntry?: ReturnType<typeof vi.fn>;
} = {}) {
  const afterCommitCallbacks: Array<() => Promise<void> | void> = [];
  const afterCommitKeys = new Set<string>();
  const afterCommit = vi.fn(
    (callback: () => Promise<void> | void, options: { key?: string } = {}) => {
      if (options.key) {
        if (afterCommitKeys.has(options.key)) {
          return;
        }

        afterCommitKeys.add(options.key);
      }

      afterCommitCallbacks.push(callback);
    },
  );
  let transaction!: TransactionManager;
  const transactionCallback = vi.fn(
    (callback: (tx: TransactionManager) => Promise<unknown>) =>
      callback(transaction),
  );

  transaction = {
    credits: {
      updateCreditBalance,
      createCreditLedgerEntry,
    },
    afterCommit,
    transaction: transactionCallback,
  } as unknown as TransactionManager;

  return {
    afterCommit,
    transaction,
    runAfterCommit: async () => {
      for (const callback of afterCommitCallbacks) {
        await callback();
      }
    },
  };
}

function createCheckoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_123",
    object: "checkout.session",
    mode: "payment",
    payment_status: "paid",
    amount_total: 2500,
    currency: "usd",
    customer: "cus_123",
    payment_intent: "pi_123",
    metadata: {
      remora_user_id: "user_1",
      amount_cents: "2500",
      credit_amount_usd_micros: "25000000",
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

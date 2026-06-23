import { describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";

import type { BillingRepository } from "../billing/billing.repository.ts";
import type { CreditsRepository } from "./credits.repository.ts";
import { CreditsService } from "./credits.service.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
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
    insertManualCreditPurchaseGrant: vi.fn(),
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
        credit_amount: "2500",
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
      payment_intent_data: {
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "2500",
          credit_amount: "2500",
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
      creditAmount: 2500,
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
          credit_amount: "2500",
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
          credit_amount: "2500",
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
    const insertManualCreditPurchaseGrant = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
    });
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
        insertManualCreditPurchaseGrant,
      } as unknown as CreditsRepository,
    });
    const verifiedPurchase = createVerifiedPurchase();

    await expect(
      service.grantManualCreditPurchase(verifiedPurchase),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: false,
    });
    expect(findManualCreditPurchaseGrantByIdempotencyKey).toHaveBeenCalledWith(
      "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
    );
    expect(insertManualCreditPurchaseGrant).toHaveBeenCalledWith({
      userId: "user_1",
      entryType: "manual_credit_purchase",
      creditAmount: 2500,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      idempotencyKey:
        "stripe:payment_intent:pi_123:manual-credit-purchase:v1",
      metadata: {
        amount_cents: 2500,
        credit_amount: 2500,
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
    });
  });

  it("returns existing grants without inserting again", async () => {
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValue({
        userId: "user_1",
        availableCreditAmount: 2500,
        reservedCreditAmount: 0,
        ledgerEntryId: "ledger_1",
      });
    const insertManualCreditPurchaseGrant = vi.fn();
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
        insertManualCreditPurchaseGrant,
      } as unknown as CreditsRepository,
    });

    await expect(
      service.grantManualCreditPurchase(createVerifiedPurchase()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: true,
    });
    expect(insertManualCreditPurchaseGrant).not.toHaveBeenCalled();
  });

  it("returns the existing grant when a concurrent insert wins the idempotency race", async () => {
    const existingGrant = {
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
    };
    const findManualCreditPurchaseGrantByIdempotencyKey = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingGrant);
    const insertManualCreditPurchaseGrant = vi.fn().mockRejectedValue({
      code: "23505",
      constraint_name: "credit_ledger_entry_idempotency_key_idx",
    });
    const service = new CreditsService(createBillingRepository(), {
      creditsRepository: {
        findManualCreditPurchaseGrantByIdempotencyKey,
        insertManualCreditPurchaseGrant,
      } as unknown as CreditsRepository,
    });

    await expect(
      service.grantManualCreditPurchase(createVerifiedPurchase()),
    ).resolves.toEqual({
      userId: "user_1",
      availableCreditAmount: 2500,
      reservedCreditAmount: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: true,
    });
    expect(findManualCreditPurchaseGrantByIdempotencyKey).toHaveBeenCalledTimes(
      2,
    );
  });
});

function createVerifiedPurchase() {
  return {
    userId: "user_1",
    amountCents: 2500,
    creditAmount: 2500,
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
      credit_amount: "2500",
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

import { describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type { BillingRepository } from "../billing/billing.repository.ts";
import type { CreditsRepository } from "../credits/credits.repository.ts";
import type { VerifiedManualCreditPurchase } from "../credits/credits.types.ts";
import type { CreditAutoTopUpSettingsRepository } from "./credit_auto_top_up_settings.repository.ts";
import { CreditAutoTopUpSettingsService } from "./credit_auto_top_up_settings.service.ts";
import { CreditAutoTopUpSettingsNotEditableError } from "./credit_auto_top_up_settings.types.ts";

vi.mock("../billing/billing.repository.ts", () => ({
  billingRepository: {
    getBillingProfileByUserId: vi.fn(),
  },
}));

vi.mock("../credits/credits.repository.ts", () => ({
  creditsRepository: {
    getBalanceByUserId: vi.fn(),
  },
}));

vi.mock("./credit_auto_top_up_settings.repository.ts", () => ({
  creditAutoTopUpSettingsRepository: {
    getSettingsByUserId: vi.fn(),
  },
}));

describe("CreditAutoTopUpSettingsService", () => {
  it("configures auto-reload after a manual purchase saves a payment method", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.configureManualCreditPurchaseAutoReload(
        createVerifiedPurchase({
          autoReload: {
            enabled: true,
            topUpFloorUsdMicros: 5_000_000,
            topUpAmountUsdMicros: 25_000_000,
            stripePaymentMethodId: "pm_123",
          },
        }),
      ),
    ).resolves.toEqual({ enabled: true });
    expect(
      transaction.saveDefaultPaymentMethodForOffSessionUse,
    ).toHaveBeenCalledWith({
      userId: "user_1",
      defaultStripePaymentMethodId: "pm_123",
      offSessionConsentAt: expect.any(Date),
    });
    expect(transaction.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: true,
      topUpFloorUsdMicros: 5_000_000,
      topUpAmountUsdMicros: 25_000_000,
    });
  });

  it("disables auto top-up when the manual purchase did not save a payment method", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.configureManualCreditPurchaseAutoReload(
        createVerifiedPurchase({
          autoReload: {
            enabled: true,
            topUpFloorUsdMicros: 5_000_000,
            topUpAmountUsdMicros: 25_000_000,
            stripePaymentMethodId: null,
          },
        }),
      ),
    ).resolves.toEqual({ enabled: false });
    expect(transaction.updateBillingPaymentMethodStatus).toHaveBeenCalledWith({
      userId: "user_1",
      paymentMethodStatus: "failed",
    });
    expect(transaction.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
  });

  it("updates saved auto top-up settings when the payment method is active", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.updateSettings({
        userId: "user_1",
        enabled: true,
        topUpFloorUsdMicros: 7_500_000,
        topUpAmountUsdMicros: 50_000_000,
      }),
    ).resolves.toEqual({
      enabled: true,
      topUpFloorUsdMicros: 7_500_000,
      topUpAmountUsdMicros: 50_000_000,
    });
    expect(transaction.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: true,
      topUpFloorUsdMicros: 7_500_000,
      topUpAmountUsdMicros: 50_000_000,
    });
  });

  it("disables saved auto top-up settings without an active saved payment method", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      billingRepository: createBillingRepository({
        billingProfile: {
          userId: "user_1",
          stripeCustomerId: "cus_123",
          defaultStripePaymentMethodId: null,
          offSessionPaymentsEnabled: false,
          offSessionConsentAt: null,
          paymentMethodStatus: "none",
        },
      }),
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.updateSettings({
        userId: "user_1",
        enabled: false,
      }),
    ).resolves.toEqual({
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
    expect(transaction.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
  });

  it("rejects auto top-up settings updates without an active saved payment method", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      billingRepository: createBillingRepository({
        billingProfile: {
          userId: "user_1",
          stripeCustomerId: "cus_123",
          defaultStripePaymentMethodId: null,
          offSessionPaymentsEnabled: false,
          offSessionConsentAt: null,
          paymentMethodStatus: "none",
        },
      }),
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.updateSettings({
        userId: "user_1",
        enabled: true,
        topUpFloorUsdMicros: 7_500_000,
        topUpAmountUsdMicros: 50_000_000,
      }),
    ).rejects.toBeInstanceOf(CreditAutoTopUpSettingsNotEditableError);
    expect(transaction.updateSettings).not.toHaveBeenCalled();
  });

  it("skips auto top-up when settings are inactive", async () => {
    const stripePaymentIntentClient = {
      create: vi.fn(),
    };
    const grantCreditAutoTopUpPurchase = vi.fn();
    const service = createService({
      settingsRepository: createSettingsRepository({
        settings: {
          userId: "user_1",
          enabled: false,
          topUpFloorUsdMicros: 5_000_000,
          topUpAmountUsdMicros: 25_000_000,
        },
      }),
      stripePaymentIntentClient,
      grantCreditAutoTopUpPurchase,
    });

    await expect(
      service.processCreditAutoTopUp({
        userId: "user_1",
        triggerLedgerEntryId: "ledger_trigger",
      }),
    ).resolves.toEqual({ status: "skipped", reason: "inactive" });
    expect(stripePaymentIntentClient.create).not.toHaveBeenCalled();
    expect(grantCreditAutoTopUpPurchase).not.toHaveBeenCalled();
  });

  it("skips auto top-up when the balance is missing", async () => {
    const service = createService({
      creditsRepository: createCreditsRepository({ balance: null }),
    });

    await expect(
      service.processCreditAutoTopUp({
        userId: "user_1",
        triggerLedgerEntryId: "ledger_trigger",
      }),
    ).resolves.toEqual({ status: "skipped", reason: "balance_missing" });
  });

  it("skips auto top-up when the balance is above the floor", async () => {
    const service = createService({
      creditsRepository: createCreditsRepository({
        balance: {
          userId: "user_1",
          availableCreditAmountUsdMicros: 5_000_001,
          reservedCreditAmountUsdMicros: 0,
        },
      }),
    });

    await expect(
      service.processCreditAutoTopUp({
        userId: "user_1",
        triggerLedgerEntryId: "ledger_trigger",
      }),
    ).resolves.toEqual({ status: "skipped", reason: "balance_above_floor" });
  });

  it("charges saved payment methods and grants auto top-up credits", async () => {
    const stripePaymentIntentClient = {
      create: vi.fn().mockResolvedValue({
        id: "pi_auto_top_up",
        status: "succeeded",
      }),
    };
    const grantCreditAutoTopUpPurchase = vi.fn().mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 29_500_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_auto_top_up",
      alreadyGranted: false,
    });
    const service = createService({
      grantCreditAutoTopUpPurchase,
      stripePaymentIntentClient,
    });

    await expect(
      service.processCreditAutoTopUp({
        userId: "user_1",
        triggerLedgerEntryId: "ledger_trigger",
      }),
    ).resolves.toMatchObject({
      status: "succeeded",
      grant: {
        alreadyGranted: false,
        ledgerEntryId: "ledger_auto_top_up",
      },
    });
    expect(stripePaymentIntentClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2500,
        currency: "usd",
        customer: "cus_123",
        payment_method: "pm_123",
        off_session: true,
        confirm: true,
        metadata: expect.objectContaining({
          purchase_kind: "auto_top_up_credit_purchase",
          trigger_ledger_entry_id: "ledger_trigger",
        }),
      }),
      {
        idempotencyKey:
          "credit-ledger-entry:ledger_trigger:auto-top-up-payment-intent:create:v1",
      },
    );
    expect(grantCreditAutoTopUpPurchase).toHaveBeenCalledWith({
      userId: "user_1",
      amountCents: 2500,
      creditAmountUsdMicros: 25_000_000,
      topUpFloorUsdMicros: 5_000_000,
      triggerLedgerEntryId: "ledger_trigger",
      stripePaymentIntentId: "pi_auto_top_up",
    });
  });

  it("disables auto top-up when Stripe requires payment action", async () => {
    const transaction = createTransactionManager();
    const service = createService({
      stripePaymentIntentClient: {
        create: vi.fn().mockRejectedValue({
          code: "authentication_required",
        }),
      },
      transactionManager: transaction.transactionManager,
    });

    await expect(
      service.processCreditAutoTopUp({
        userId: "user_1",
        triggerLedgerEntryId: "ledger_trigger",
      }),
    ).resolves.toEqual({ status: "failed", reason: "requires_action" });
    expect(transaction.updateBillingPaymentMethodStatus).toHaveBeenCalledWith({
      userId: "user_1",
      paymentMethodStatus: "requires_action",
    });
    expect(transaction.updateSettings).toHaveBeenCalledWith({
      userId: "user_1",
      enabled: false,
      topUpFloorUsdMicros: 0,
      topUpAmountUsdMicros: 0,
    });
  });

  it("starts auto top-up after committed credit spend crosses the floor", async () => {
    const transaction = createTransactionManager();
    const startCreditAutoTopUpWorkflow = vi.fn().mockResolvedValue({
      workflowId: "credit-auto-top-up:trigger-ledger-entry:ledger_1",
      runId: "run_1",
      alreadyStarted: false,
    });
    const service = createService({
      startCreditAutoTopUpWorkflow,
      transactionManager: transaction.transactionManager,
    });

    await service.maybeTriggerCreditAutoTopUp({
      userId: "user_1",
      entryType: "generation_credit_reservation",
      availableCreditDeltaUsdMicros: -1_000_000,
      availableCreditAmountUsdMicros: 4_500_000,
      ledgerEntryId: "ledger_1",
    });

    expect(startCreditAutoTopUpWorkflow).not.toHaveBeenCalled();

    await transaction.runAfterCommit();

    expect(startCreditAutoTopUpWorkflow).toHaveBeenCalledWith({
      userId: "user_1",
      triggerLedgerEntryId: "ledger_1",
    });
  });

  it("keeps credit spend successful when auto top-up workflow start fails", async () => {
    const startError = new Error("Temporal unavailable");
    const logger = {
      error: vi.fn(),
    };
    const transaction = createTransactionManager();
    const service = createService({
      logger,
      startCreditAutoTopUpWorkflow: vi.fn().mockRejectedValue(startError),
      transactionManager: transaction.transactionManager,
    });

    await service.maybeTriggerCreditAutoTopUp({
      userId: "user_1",
      entryType: "generation_credit_reservation",
      availableCreditDeltaUsdMicros: -1_000_000,
      availableCreditAmountUsdMicros: 4_500_000,
      ledgerEntryId: "ledger_1",
    });
    await expect(transaction.runAfterCommit()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Credit auto-reload workflow start failed",
      startError,
    );
  });
});

type CreditAutoTopUpSettingsServiceOptions = ConstructorParameters<
  typeof CreditAutoTopUpSettingsService
>[1];

function createService({
  billingRepository = createBillingRepository(),
  creditsRepository = createCreditsRepository(),
  grantCreditAutoTopUpPurchase = vi.fn(),
  logger,
  settingsRepository = createSettingsRepository(),
  startCreditAutoTopUpWorkflow,
  stripePaymentIntentClient = {
    create: vi.fn().mockResolvedValue({
      id: "pi_auto_top_up",
      status: "succeeded",
    }),
  },
  transactionManager = createTransactionManager().transactionManager,
}: Partial<
  Omit<
    CreditAutoTopUpSettingsServiceOptions,
    "billingRepository" | "creditsRepository"
  >
> & {
  billingRepository?: BillingRepository;
  creditsRepository?: CreditsRepository;
  settingsRepository?: CreditAutoTopUpSettingsRepository;
} = {}) {
  return new CreditAutoTopUpSettingsService(settingsRepository, {
    billingRepository,
    creditsRepository,
    grantCreditAutoTopUpPurchase,
    ...(logger ? { logger } : {}),
    ...(startCreditAutoTopUpWorkflow ? { startCreditAutoTopUpWorkflow } : {}),
    stripePaymentIntentClient,
    transactionManager,
  });
}

function createBillingRepository({
  billingProfile = {
    userId: "user_1",
    stripeCustomerId: "cus_123",
    defaultStripePaymentMethodId: "pm_123",
    offSessionPaymentsEnabled: true,
    offSessionConsentAt: new Date("2026-06-01T00:00:00.000Z"),
    paymentMethodStatus: "active" as const,
  },
}: {
  billingProfile?: Awaited<
    ReturnType<BillingRepository["getBillingProfileByUserId"]>
  >;
} = {}) {
  return {
    getBillingProfileByUserId: vi.fn().mockResolvedValue(billingProfile),
  } as unknown as BillingRepository;
}

function createSettingsRepository({
  settings = {
    userId: "user_1",
    enabled: true,
    topUpFloorUsdMicros: 5_000_000,
    topUpAmountUsdMicros: 25_000_000,
  },
}: {
  settings?: Awaited<
    ReturnType<CreditAutoTopUpSettingsRepository["getSettingsByUserId"]>
  >;
} = {}) {
  return {
    getSettingsByUserId: vi.fn().mockResolvedValue(settings),
  } as unknown as CreditAutoTopUpSettingsRepository;
}

function createCreditsRepository({
  balance = {
    userId: "user_1",
    availableCreditAmountUsdMicros: 4_500_000,
    reservedCreditAmountUsdMicros: 0,
  },
}: {
  balance?: Awaited<ReturnType<CreditsRepository["getBalanceByUserId"]>>;
} = {}) {
  return {
    getBalanceByUserId: vi.fn().mockResolvedValue(balance),
  } as unknown as CreditsRepository;
}

function createTransactionManager({
  saveDefaultPaymentMethodForOffSessionUse = vi
    .fn()
    .mockResolvedValue({ userId: "user_1" }),
  updateBillingPaymentMethodStatus = vi
    .fn()
    .mockResolvedValue({ userId: "user_1" }),
  updateSettings = vi.fn().mockResolvedValue({ userId: "user_1" }),
}: {
  saveDefaultPaymentMethodForOffSessionUse?: ReturnType<typeof vi.fn>;
  updateBillingPaymentMethodStatus?: ReturnType<typeof vi.fn>;
  updateSettings?: ReturnType<typeof vi.fn>;
} = {}) {
  const afterCommitCallbacks: Array<() => Promise<void> | void> = [];
  const afterCommit = vi.fn((callback: () => Promise<void> | void) => {
    afterCommitCallbacks.push(callback);
  });
  let activeTransaction!: TransactionManager;

  activeTransaction = {
    billing: {
      saveDefaultPaymentMethodForOffSessionUse,
      updateBillingPaymentMethodStatus,
    },
    creditAutoTopUpSettings: {
      updateSettings,
    },
    afterCommit,
    transaction: vi.fn(
      (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback(activeTransaction),
    ),
  } as unknown as TransactionManager;

  const transactionManager = {
    afterCommit,
    transaction: vi.fn(
      async (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback(activeTransaction),
    ),
  } as unknown as TransactionManager;

  return {
    afterCommit,
    saveDefaultPaymentMethodForOffSessionUse,
    transactionManager,
    updateBillingPaymentMethodStatus,
    updateSettings,
    runAfterCommit: async () => {
      for (const callback of afterCommitCallbacks) {
        await callback();
      }
    },
  };
}

function createVerifiedPurchase(
  overrides: Partial<VerifiedManualCreditPurchase> = {},
): VerifiedManualCreditPurchase {
  return {
    userId: "user_1",
    amountCents: 2500,
    creditAmountUsdMicros: 25_000_000,
    stripeCheckoutSessionId: "cs_123",
    stripePaymentIntentId: "pi_123",
    stripeEventId: "evt_123",
    autoReload: {
      enabled: false,
    },
    ...overrides,
  };
}

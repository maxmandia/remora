import { isRecord } from "@remora/utils";
import { usdMicrosPerCent } from "@remora/utils/currency";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripe/stripe.ts";
import type { TransactionManager } from "../../db/transaction-manager.ts";
import {
  billingRepository,
  type BillingRepository,
} from "../billing/billing.repository.ts";
import type { BillingPaymentMethodStatus } from "../billing/billing.types.ts";
import {
  creditsRepository,
  type CreditsRepository,
} from "../credits/credits.repository.ts";
import {
  autoTopUpCreditPurchaseKind,
  generationCreditChargeKind,
  generationCreditReservationKind,
  type CreditAutoTopUpGrantResult,
  type CreditLedgerEntryType,
  type VerifiedCreditAutoTopUpPurchase,
  type VerifiedManualCreditPurchase,
} from "../credits/credits.types.ts";
import {
  creditAutoTopUpSettingsRepository,
  type CreditAutoTopUpSettingsRepository,
} from "./credit_auto_top_up_settings.repository.ts";
import type {
  ActiveCreditAutoTopUpConfig,
  CreditAutoTopUpFailureReason,
  CreditAutoTopUpResult,
  CreditAutoTopUpWorkflowStarter,
  CreditAutoTopUpWorkflowStarterInput,
} from "./credit_auto_top_up_settings.types.ts";
import { CreditAutoTopUpSettingsNotEditableError } from "./credit_auto_top_up_settings.types.ts";

type StripePaymentIntentCreateClient = Pick<Stripe["paymentIntents"], "create">;

type CreditAutoTopUpGrant = (
  input: VerifiedCreditAutoTopUpPurchase,
) => Promise<CreditAutoTopUpGrantResult>;

type CreditAutoTopUpSettingsServiceLogger = {
  error(message: string, error?: unknown): void;
};

async function defaultStartCreditAutoTopUpWorkflow(
  input: CreditAutoTopUpWorkflowStarterInput,
) {
  const { startCreditAutoTopUpWorkflow } =
    await import("../../temporal/client.ts");

  return startCreditAutoTopUpWorkflow(input);
}

export class CreditAutoTopUpSettingsService {
  private readonly billing: BillingRepository;
  private readonly credits: CreditsRepository;
  private readonly grantCreditAutoTopUpPurchase: CreditAutoTopUpGrant;
  private readonly logger: CreditAutoTopUpSettingsServiceLogger;
  private readonly startCreditAutoTopUpWorkflow: CreditAutoTopUpWorkflowStarter;
  private readonly stripePaymentIntentCreateClient: StripePaymentIntentCreateClient | null;
  private readonly transactionManager: TransactionManager;

  constructor(
    private readonly repository: CreditAutoTopUpSettingsRepository = creditAutoTopUpSettingsRepository,
    options: {
      billingRepository?: BillingRepository;
      creditsRepository?: CreditsRepository;
      grantCreditAutoTopUpPurchase: CreditAutoTopUpGrant;
      logger?: CreditAutoTopUpSettingsServiceLogger;
      startCreditAutoTopUpWorkflow?: CreditAutoTopUpWorkflowStarter;
      stripePaymentIntentClient?: StripePaymentIntentCreateClient;
      transactionManager: TransactionManager;
    },
  ) {
    this.billing = options.billingRepository ?? billingRepository;
    this.credits = options.creditsRepository ?? creditsRepository;
    this.grantCreditAutoTopUpPurchase = options.grantCreditAutoTopUpPurchase;
    this.logger = options.logger ?? console;
    this.startCreditAutoTopUpWorkflow =
      options.startCreditAutoTopUpWorkflow ??
      defaultStartCreditAutoTopUpWorkflow;
    this.stripePaymentIntentCreateClient =
      options.stripePaymentIntentClient ?? null;
    this.transactionManager = options.transactionManager;
  }

  async configureManualCreditPurchaseAutoReload(
    input: VerifiedManualCreditPurchase,
  ): Promise<{ enabled: boolean }> {
    const autoReload = input.autoReload;

    if (!autoReload.enabled) {
      return { enabled: false };
    }

    if (!autoReload.stripePaymentMethodId) {
      await this.disableForPaymentFailure({
        userId: input.userId,
        paymentMethodStatus: "failed",
      });

      return { enabled: false };
    }

    const stripePaymentMethodId = autoReload.stripePaymentMethodId;

    await this.transactionManager.transaction(async (activeTx) => {
      await activeTx.billing.saveDefaultPaymentMethodForOffSessionUse({
        userId: input.userId,
        defaultStripePaymentMethodId: stripePaymentMethodId,
        offSessionConsentAt: new Date(),
      });
      await activeTx.creditAutoTopUpSettings.updateSettings({
        userId: input.userId,
        enabled: true,
        topUpFloorUsdMicros: autoReload.topUpFloorUsdMicros,
        topUpAmountUsdMicros: autoReload.topUpAmountUsdMicros,
      });
    });

    return { enabled: true };
  }

  async getActiveConfigByUserId(
    userId: string,
  ): Promise<ActiveCreditAutoTopUpConfig | null> {
    const [billingProfile, settings] = await Promise.all([
      this.billing.getBillingProfileByUserId(userId),
      this.repository.getSettingsByUserId(userId),
    ]);

    if (
      !billingProfile ||
      !settings?.enabled ||
      !billingProfile.defaultStripePaymentMethodId ||
      !billingProfile.offSessionPaymentsEnabled ||
      billingProfile.paymentMethodStatus !== "active" ||
      settings.topUpFloorUsdMicros <= 0 ||
      settings.topUpAmountUsdMicros <= 0
    ) {
      return null;
    }

    return {
      userId,
      stripeCustomerId: billingProfile.stripeCustomerId,
      defaultStripePaymentMethodId: billingProfile.defaultStripePaymentMethodId,
      topUpFloorUsdMicros: settings.topUpFloorUsdMicros,
      topUpAmountUsdMicros: settings.topUpAmountUsdMicros,
    };
  }

  async updateSettings(
    input:
      | {
          enabled: false;
          userId: string;
        }
      | {
          enabled: true;
          topUpAmountUsdMicros: number;
          topUpFloorUsdMicros: number;
          userId: string;
        },
  ) {
    if (input.enabled && !(await this.getActiveConfigByUserId(input.userId))) {
      throw new CreditAutoTopUpSettingsNotEditableError(input.userId);
    }

    const topUpFloorUsdMicros = input.enabled ? input.topUpFloorUsdMicros : 0;
    const topUpAmountUsdMicros = input.enabled
      ? input.topUpAmountUsdMicros
      : 0;

    await this.transactionManager.transaction(async (activeTx) => {
      await activeTx.creditAutoTopUpSettings.updateSettings({
        userId: input.userId,
        enabled: input.enabled,
        topUpFloorUsdMicros,
        topUpAmountUsdMicros,
      });
    });

    return {
      enabled: input.enabled,
      topUpFloorUsdMicros,
      topUpAmountUsdMicros,
    };
  }

  async processCreditAutoTopUp({
    triggerLedgerEntryId,
    userId,
  }: {
    triggerLedgerEntryId: string;
    userId: string;
  }): Promise<CreditAutoTopUpResult> {
    const config = await this.getActiveConfigByUserId(userId);

    if (!config) {
      return { status: "skipped", reason: "inactive" };
    }

    const balance = await this.credits.getBalanceByUserId(userId);

    if (!balance) {
      return { status: "skipped", reason: "balance_missing" };
    }

    if (balance.availableCreditAmountUsdMicros > config.topUpFloorUsdMicros) {
      return { status: "skipped", reason: "balance_above_floor" };
    }

    const amountCents = this.getCentsFromUsdMicros(
      config.topUpAmountUsdMicros,
      "Credit auto top-up amount",
    );
    const metadata = this.createCreditAutoTopUpMetadata({
      amountCents,
      creditAmountUsdMicros: config.topUpAmountUsdMicros,
      topUpFloorUsdMicros: config.topUpFloorUsdMicros,
      triggerLedgerEntryId,
      userId,
    });
    let paymentIntent: Stripe.PaymentIntent;

    try {
      paymentIntent = await this.getStripePaymentIntentCreateClient().create(
        {
          amount: amountCents,
          currency: "usd",
          customer: config.stripeCustomerId,
          payment_method: config.defaultStripePaymentMethodId,
          off_session: true,
          confirm: true,
          metadata,
        },
        {
          idempotencyKey: this.createStripePaymentIntentIdempotencyKey({
            triggerLedgerEntryId,
          }),
        },
      );
    } catch (error) {
      const failureReason = this.getStripePaymentFailureReason(error);

      if (failureReason) {
        await this.disableForPaymentFailure({
          userId,
          paymentMethodStatus: this.toBillingPaymentMethodStatus(failureReason),
        });

        return {
          status: "failed",
          reason: failureReason,
        };
      }

      throw error;
    }

    if (paymentIntent.status !== "succeeded") {
      const failureReason = this.getPaymentIntentFailureReason(paymentIntent);

      if (failureReason) {
        await this.disableForPaymentFailure({
          userId,
          paymentMethodStatus: this.toBillingPaymentMethodStatus(failureReason),
        });

        return {
          status: "failed",
          reason: failureReason,
        };
      }

      throw new Error(
        `Credit auto top-up payment intent ${paymentIntent.id} did not succeed: ${paymentIntent.status}`,
      );
    }

    const grant = await this.grantCreditAutoTopUpPurchase({
      userId,
      amountCents,
      creditAmountUsdMicros: config.topUpAmountUsdMicros,
      topUpFloorUsdMicros: config.topUpFloorUsdMicros,
      triggerLedgerEntryId,
      stripePaymentIntentId: paymentIntent.id,
    });

    return {
      status: "succeeded",
      grant,
    };
  }

  async maybeTriggerCreditAutoTopUp({
    availableCreditAmountUsdMicros,
    availableCreditDeltaUsdMicros,
    entryType,
    ledgerEntryId,
    userId,
  }: {
    availableCreditAmountUsdMicros: number;
    availableCreditDeltaUsdMicros: number;
    entryType: CreditLedgerEntryType;
    ledgerEntryId: string;
    userId: string;
  }): Promise<void> {
    if (
      availableCreditDeltaUsdMicros >= 0 ||
      !this.canTriggerCreditAutoTopUp(entryType)
    ) {
      return;
    }

    const config = await this.getActiveConfigByUserId(userId);

    if (!config) {
      return;
    }

    const previousAvailableCreditAmountUsdMicros =
      availableCreditAmountUsdMicros - availableCreditDeltaUsdMicros;

    if (
      previousAvailableCreditAmountUsdMicros <= config.topUpFloorUsdMicros ||
      availableCreditAmountUsdMicros > config.topUpFloorUsdMicros
    ) {
      return;
    }

    this.transactionManager.afterCommit(
      () =>
        this.startCreditAutoTopUpAfterCommit({
          userId,
          triggerLedgerEntryId: ledgerEntryId,
        }),
      {
        key: `credits.auto-top-up:${userId}`,
      },
    );
  }

  private async disableForPaymentFailure({
    paymentMethodStatus,
    userId,
  }: {
    paymentMethodStatus: BillingPaymentMethodStatus;
    userId: string;
  }): Promise<void> {
    await this.transactionManager.transaction(async (activeTx) => {
      await activeTx.billing.updateBillingPaymentMethodStatus({
        userId,
        paymentMethodStatus,
      });
      await activeTx.creditAutoTopUpSettings.updateSettings({
        userId,
        enabled: false,
        topUpFloorUsdMicros: 0,
        topUpAmountUsdMicros: 0,
      });
    });
  }

  private getStripePaymentIntentCreateClient() {
    return (
      this.stripePaymentIntentCreateClient ?? getStripeClient().paymentIntents
    );
  }

  private createCreditAutoTopUpMetadata({
    amountCents,
    creditAmountUsdMicros,
    topUpFloorUsdMicros,
    triggerLedgerEntryId,
    userId,
  }: {
    amountCents: number;
    creditAmountUsdMicros: number;
    topUpFloorUsdMicros: number;
    triggerLedgerEntryId: string;
    userId: string;
  }): Stripe.MetadataParam {
    return {
      remora_user_id: userId,
      amount_cents: String(amountCents),
      credit_amount_usd_micros: String(creditAmountUsdMicros),
      purchase_kind: autoTopUpCreditPurchaseKind,
      top_up_floor_usd_micros: String(topUpFloorUsdMicros),
      trigger_ledger_entry_id: triggerLedgerEntryId,
      metadata_version: "1",
    };
  }

  private createStripePaymentIntentIdempotencyKey({
    triggerLedgerEntryId,
  }: {
    triggerLedgerEntryId: string;
  }) {
    return `credit-ledger-entry:${triggerLedgerEntryId}:auto-top-up-payment-intent:create:v1`;
  }

  private getCentsFromUsdMicros(amountUsdMicros: number, label: string) {
    if (
      !Number.isInteger(amountUsdMicros) ||
      amountUsdMicros <= 0 ||
      amountUsdMicros % usdMicrosPerCent !== 0
    ) {
      throw new Error(`${label} must be a positive whole-cent USD amount`);
    }

    return amountUsdMicros / usdMicrosPerCent;
  }

  private getStripePaymentFailureReason(
    error: unknown,
  ): CreditAutoTopUpFailureReason | null {
    if (!isRecord(error)) {
      return null;
    }

    if (error.code === "authentication_required") {
      return "requires_action";
    }

    if (error.type === "StripeCardError") {
      return "payment_failed";
    }

    const paymentIntent = isRecord(error.payment_intent)
      ? error.payment_intent
      : null;
    const paymentIntentStatus =
      paymentIntent && typeof paymentIntent.status === "string"
        ? paymentIntent.status
        : null;

    return this.getPaymentIntentFailureReasonFromStatus(paymentIntentStatus);
  }

  private getPaymentIntentFailureReason(
    paymentIntent: Stripe.PaymentIntent,
  ): CreditAutoTopUpFailureReason | null {
    return this.getPaymentIntentFailureReasonFromStatus(paymentIntent.status);
  }

  private getPaymentIntentFailureReasonFromStatus(
    status: string | null,
  ): CreditAutoTopUpFailureReason | null {
    if (status === "requires_action") {
      return "requires_action";
    }

    if (status === "requires_payment_method" || status === "canceled") {
      return "payment_failed";
    }

    return null;
  }

  private toBillingPaymentMethodStatus(
    failureReason: CreditAutoTopUpFailureReason,
  ): BillingPaymentMethodStatus {
    return failureReason === "requires_action" ? "requires_action" : "failed";
  }

  private canTriggerCreditAutoTopUp(entryType: CreditLedgerEntryType) {
    return (
      entryType === generationCreditReservationKind ||
      entryType === generationCreditChargeKind
    );
  }

  private async startCreditAutoTopUpAfterCommit(
    input: CreditAutoTopUpWorkflowStarterInput,
  ) {
    try {
      await this.startCreditAutoTopUpWorkflow(input);
    } catch (error) {
      this.logger.error("Credit auto-reload workflow start failed", error);
    }
  }
}

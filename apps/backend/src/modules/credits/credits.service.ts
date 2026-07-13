import type { CreateCreditCheckoutSessionInput } from "@remora/domain/credits/validator";
import { parseBackendHttpEnv } from "@remora/env";
import { getUsdMicrosFromCents } from "@remora/utils/currency";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripe/stripe.ts";
import type { TransactionManager } from "../../db/transaction-manager.ts";
import {
  billingRepository,
  type BillingRepository,
} from "../billing/billing.repository.ts";
import {
  realtimeRepository,
  type RealtimeRepository,
} from "../realtime/realtime.repository.ts";
import { createCreditsBalanceUpdatedRealtimeInternalEvent } from "../realtime/realtime.utils.ts";
import {
  creditsRepository,
  type CreditsRepository,
} from "./credits.repository.ts";
import {
  autoTopUpCreditPurchaseKind,
  type CreditAutoTopUpGrantResult,
  CreditBalanceMutationRejectedError,
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
  generationCreditChargeKind,
  generationCreditReservationKind,
  generationCreditReservationReleaseKind,
  InsufficientCreditBalanceError,
  type ManualCreditPurchaseAutoReloadSettings,
  manualCreditPurchaseKind,
  ManualCreditPurchaseVerificationError,
} from "./credits.types.ts";
import {
  createCreditAutoTopUpPurchaseIdempotencyKey,
  createCreditAutoTopUpPurchaseLedgerMetadata,
  createGenerationCreditChargeIdempotencyKey,
  createGenerationCreditChargeLedgerMetadata,
  createGenerationCreditReservationIdempotencyKey,
  createGenerationCreditReservationLedgerMetadata,
  createGenerationCreditReservationReleaseIdempotencyKey,
  createGenerationCreditReservationReleaseLedgerMetadata,
  createManualCreditPurchaseIdempotencyKey,
  createManualCreditPurchaseLedgerMetadata,
  isCreditLedgerEntryIdempotencyKeyConflict,
} from "./credits.utils.ts";

import type {
  CreditBalanceMutationRecord,
  CreditMutationCommand,
  ManualCreditPurchaseGrantRecord,
  ManualCreditPurchaseGrantResult,
  VerifiedCreditAutoTopUpPurchase,
  VerifiedManualCreditPurchase,
} from "./credits.types.ts";

type StripeCheckoutSessionCreateClient = Pick<
  Stripe["checkout"]["sessions"],
  "create"
>;
type StripeCheckoutSessionRetrieveClient = Pick<
  Stripe["checkout"]["sessions"],
  "retrieve"
>;

type ReserveGenerationJobCostEstimateInput = {
  userId: string;
  generationSubmissionId: string;
  generationJobId: string;
  generationJobCostId: string;
  estimatedCostUsdMicros: number;
};

type SettleGenerationJobCostInput = {
  userId: string;
  generationJobId: string;
  generationJobCostId: string;
  estimatedCostUsdMicros: number;
  finalCostUsdMicros: number;
};

type ReleaseGenerationJobCostReservationInput = {
  userId: string;
  generationJobId: string;
  generationJobCostId: string;
  estimatedCostUsdMicros: number;
};

type CreditLedgerEntryRecord = NonNullable<
  Awaited<
    ReturnType<CreditsRepository["findCreditLedgerEntryByIdempotencyKey"]>
  >
>;

export class CreditsService {
  private readonly stripeCheckoutSessionCreateClient: StripeCheckoutSessionCreateClient | null;
  private readonly stripeCheckoutSessionRetrieveClient: StripeCheckoutSessionRetrieveClient | null;
  private readonly repository: CreditsRepository;
  private readonly realtime: RealtimeRepository;
  private readonly transactionManager: TransactionManager;
  private readonly webOrigin: string;

  constructor(
    private readonly billing: BillingRepository = billingRepository,
    options: {
      creditsRepository?: CreditsRepository;
      realtimeRepository?: RealtimeRepository;
      transactionManager: TransactionManager;
      stripeCheckoutSessionClient?: StripeCheckoutSessionCreateClient;
      stripeCheckoutSessionRetrieveClient?: StripeCheckoutSessionRetrieveClient;
      webOrigin?: string;
    },
  ) {
    this.repository = options.creditsRepository ?? creditsRepository;
    this.realtime = options.realtimeRepository ?? realtimeRepository;
    this.transactionManager = options.transactionManager;
    this.stripeCheckoutSessionCreateClient =
      options.stripeCheckoutSessionClient ?? null;
    this.stripeCheckoutSessionRetrieveClient =
      options.stripeCheckoutSessionRetrieveClient ?? null;
    this.webOrigin =
      options.webOrigin ?? parseBackendHttpEnv(process.env).WEB_ORIGIN;
  }

  async createCheckoutSession({
    amountCents,
    autoReload = { enabled: false },
    desktopReturnUrl,
    userId,
  }: CreateCreditCheckoutSessionInput & {
    userId: string;
  }) {
    const billingProfile = await this.billing.getBillingProfileByUserId(userId);

    if (!billingProfile) {
      throw new CreditCheckoutBillingProfileMissingError(userId);
    }

    const metadata = this.createCreditPurchaseMetadata({
      amountCents,
      autoReload,
      userId,
    });
    const session = await this.getStripeCheckoutSessionCreateClient().create({
      mode: "payment",
      customer: billingProfile.stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents,
            product_data: {
              name: "Remora credits",
              description: "Credits are used to generate output on Remora.",
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
        ...(autoReload.enabled ? { setup_future_usage: "off_session" } : {}),
      },
      success_url: this.createCheckoutReturnUrl("success", desktopReturnUrl),
      cancel_url: this.createCheckoutReturnUrl("cancel", desktopReturnUrl),
    });

    if (!session.url) {
      throw new CreditCheckoutSessionUrlMissingError();
    }

    return {
      checkoutUrl: session.url,
    };
  }

  async verifyManualCreditCheckoutSession({
    stripeCheckoutSessionId,
    stripeEventId,
  }: {
    stripeCheckoutSessionId: string;
    stripeEventId: string;
  }): Promise<VerifiedManualCreditPurchase> {
    const session =
      await this.getStripeCheckoutSessionRetrieveClient().retrieve(
        stripeCheckoutSessionId,
        {
          expand: ["payment_intent"],
        },
      );
    const metadata = session.metadata ?? {};
    const userId = this.getMetadataString(metadata, "remora_user_id");
    const amountCents = this.getPositiveIntegerMetadata(
      metadata,
      "amount_cents",
    );
    const creditAmountUsdMicros = this.getPositiveIntegerMetadata(
      metadata,
      "credit_amount_usd_micros",
    );
    const purchaseKind = this.getMetadataString(metadata, "purchase_kind");
    const metadataVersion = this.getMetadataString(
      metadata,
      "metadata_version",
    );
    const stripeCustomerId = this.getStripeId(session.customer);
    const stripePaymentIntentId = this.getStripeId(session.payment_intent);
    const autoReload = this.getManualCreditPurchaseAutoReloadSettings({
      amountCents,
      creditAmountUsdMicros,
      metadata,
      session,
    });

    if (session.mode !== "payment") {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} was not a payment session`,
      );
    }

    if (session.payment_status !== "paid") {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} was not paid`,
      );
    }

    if (session.currency !== "usd") {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} did not use USD`,
      );
    }

    if (session.amount_total !== amountCents) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} amount did not match metadata`,
      );
    }

    if (creditAmountUsdMicros !== getUsdMicrosFromCents(amountCents)) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} credit amount did not match purchase amount`,
      );
    }

    if (purchaseKind !== manualCreditPurchaseKind) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} was not a manual credit purchase`,
      );
    }

    if (metadataVersion !== "1") {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} used an unsupported metadata version`,
      );
    }

    if (!stripeCustomerId) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} did not include a customer`,
      );
    }

    const billingProfile = await this.billing.getBillingProfileByUserId(userId);

    if (!billingProfile) {
      throw new ManualCreditPurchaseVerificationError(
        `Billing profile was not found for user ${userId}`,
      );
    }

    if (billingProfile.stripeCustomerId !== stripeCustomerId) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} customer did not match user billing profile`,
      );
    }

    return {
      userId,
      amountCents,
      creditAmountUsdMicros,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId,
      stripeEventId,
      autoReload,
    };
  }

  async grantManualCreditPurchase(
    input: VerifiedManualCreditPurchase,
  ): Promise<ManualCreditPurchaseGrantResult> {
    const command = this.buildManualCreditPurchase(input);
    const existingGrant =
      await this.repository.findManualCreditPurchaseGrantByIdempotencyKey(
        command.idempotencyKey,
      );

    if (existingGrant) {
      return this.buildAlreadyGrantedResult(existingGrant);
    }

    try {
      const grant = await this.applyCreditMutation(command);

      return {
        ...grant,
        alreadyGranted: false,
      };
    } catch (error) {
      if (!isCreditLedgerEntryIdempotencyKeyConflict(error)) {
        throw error;
      }

      const existingGrantAfterRace =
        await this.repository.findManualCreditPurchaseGrantByIdempotencyKey(
          command.idempotencyKey,
        );

      if (!existingGrantAfterRace) {
        throw error;
      }

      return this.buildAlreadyGrantedResult(existingGrantAfterRace);
    }
  }

  async grantCreditAutoTopUpPurchase(
    input: VerifiedCreditAutoTopUpPurchase,
  ): Promise<CreditAutoTopUpGrantResult> {
    const command = this.buildCreditAutoTopUpPurchase(input);
    const existingLedgerEntry =
      await this.repository.findCreditLedgerEntryByIdempotencyKey(
        command.idempotencyKey,
      );

    if (existingLedgerEntry) {
      return {
        ...this.toCreditBalanceMutationRecord(existingLedgerEntry),
        alreadyGranted: true,
      };
    }

    try {
      const grant = await this.applyCreditMutation(command);

      return {
        ...grant,
        alreadyGranted: false,
      };
    } catch (error) {
      if (!isCreditLedgerEntryIdempotencyKeyConflict(error)) {
        throw error;
      }

      const existingLedgerEntryAfterRace =
        await this.repository.findCreditLedgerEntryByIdempotencyKey(
          command.idempotencyKey,
        );

      if (!existingLedgerEntryAfterRace) {
        throw error;
      }

      return {
        ...this.toCreditBalanceMutationRecord(existingLedgerEntryAfterRace),
        alreadyGranted: true,
      };
    }
  }

  async reserveGenerationJobCostEstimate(
    input: ReserveGenerationJobCostEstimateInput,
  ): Promise<CreditBalanceMutationRecord | null> {
    if (input.estimatedCostUsdMicros === 0) {
      return null;
    }

    if (input.estimatedCostUsdMicros < 0) {
      throw new Error(
        `Generation job cost cannot be negative: ${input.estimatedCostUsdMicros}`,
      );
    }

    const command = this.buildGenerationCreditReservation(input);

    try {
      return await this.applyCreditMutation(command);
    } catch (error) {
      if (error instanceof CreditBalanceMutationRejectedError) {
        throw new InsufficientCreditBalanceError({
          userId: input.userId,
          requiredAmountUsdMicros: input.estimatedCostUsdMicros,
        });
      }

      throw error;
    }
  }

  async settleGenerationJobCost(
    input: SettleGenerationJobCostInput,
  ): Promise<CreditBalanceMutationRecord | null> {
    if (input.estimatedCostUsdMicros < 0) {
      throw new Error(
        `Generation job estimated cost cannot be negative: ${input.estimatedCostUsdMicros}`,
      );
    }

    if (input.finalCostUsdMicros < 0) {
      throw new Error(
        `Generation job final cost cannot be negative: ${input.finalCostUsdMicros}`,
      );
    }

    if (input.estimatedCostUsdMicros === 0 && input.finalCostUsdMicros === 0) {
      return null;
    }

    const command = this.buildGenerationCreditCharge(input);
    return this.transactionManager.transaction(async (activeTx) => {
      const existingLedgerEntry =
        await activeTx.credits.findCreditLedgerEntryByIdempotencyKey(
          command.idempotencyKey,
        );

      if (existingLedgerEntry) {
        // TODO: Once we figure out logging this needs to be included, and possibly alerted? Should never happen.
        this.assertExistingGenerationCreditChargeMatches({
          command,
          existingLedgerEntry,
        });

        return {
          userId: existingLedgerEntry.userId,
          availableCreditAmountUsdMicros:
            existingLedgerEntry.availableCreditAmountUsdMicrosAfter,
          reservedCreditAmountUsdMicros:
            existingLedgerEntry.reservedCreditAmountUsdMicrosAfter,
          ledgerEntryId: existingLedgerEntry.id,
        };
      }

      return this.applyCreditMutationInTransaction(command, activeTx);
    });
  }

  async releaseGenerationJobCostReservation(
    input: ReleaseGenerationJobCostReservationInput,
  ): Promise<CreditBalanceMutationRecord | null> {
    if (input.estimatedCostUsdMicros < 0) {
      throw new Error(
        `Generation job reservation release cannot be negative: ${input.estimatedCostUsdMicros}`,
      );
    }

    if (input.estimatedCostUsdMicros === 0) {
      return null;
    }

    const command = this.buildGenerationCreditReservationRelease(input);
    return this.transactionManager.transaction(async (activeTx) => {
      const existingLedgerEntry =
        await activeTx.credits.findCreditLedgerEntryByIdempotencyKey(
          command.idempotencyKey,
        );

      if (existingLedgerEntry) {
        this.assertExistingGenerationCreditReservationReleaseMatches({
          command,
          existingLedgerEntry,
        });

        return {
          userId: existingLedgerEntry.userId,
          availableCreditAmountUsdMicros:
            existingLedgerEntry.availableCreditAmountUsdMicrosAfter,
          reservedCreditAmountUsdMicros:
            existingLedgerEntry.reservedCreditAmountUsdMicrosAfter,
          ledgerEntryId: existingLedgerEntry.id,
        };
      }

      return this.applyCreditMutationInTransaction(command, activeTx);
    });
  }

  private buildManualCreditPurchase(
    input: VerifiedManualCreditPurchase,
  ): CreditMutationCommand {
    return {
      userId: input.userId,
      entryType: manualCreditPurchaseKind,
      availableCreditDeltaUsdMicros: input.creditAmountUsdMicros,
      reservedCreditDeltaUsdMicros: 0,
      generationJobId: null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeEventId: input.stripeEventId,
      idempotencyKey: createManualCreditPurchaseIdempotencyKey(input),
      metadata: createManualCreditPurchaseLedgerMetadata(input),
      allowNegativeAvailableCreditBalance: true,
    };
  }

  private buildCreditAutoTopUpPurchase(
    input: VerifiedCreditAutoTopUpPurchase,
  ): CreditMutationCommand {
    return {
      userId: input.userId,
      entryType: autoTopUpCreditPurchaseKind,
      availableCreditDeltaUsdMicros: input.creditAmountUsdMicros,
      reservedCreditDeltaUsdMicros: 0,
      generationJobId: null,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeEventId: null,
      idempotencyKey: createCreditAutoTopUpPurchaseIdempotencyKey(input),
      metadata: createCreditAutoTopUpPurchaseLedgerMetadata(input),
      allowNegativeAvailableCreditBalance: true,
    };
  }

  private buildGenerationCreditReservation({
    estimatedCostUsdMicros,
    generationJobCostId,
    generationJobId,
    generationSubmissionId,
    userId,
  }: ReserveGenerationJobCostEstimateInput): CreditMutationCommand {
    return {
      userId,
      entryType: generationCreditReservationKind,
      availableCreditDeltaUsdMicros: -estimatedCostUsdMicros,
      reservedCreditDeltaUsdMicros: estimatedCostUsdMicros,
      generationJobId,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      idempotencyKey: createGenerationCreditReservationIdempotencyKey({
        generationJobId,
      }),
      metadata: createGenerationCreditReservationLedgerMetadata({
        estimatedCostUsdMicros,
        generationJobCostId,
        generationSubmissionId,
      }),
      allowNegativeAvailableCreditBalance: false,
    };
  }

  private buildGenerationCreditCharge({
    estimatedCostUsdMicros,
    finalCostUsdMicros,
    generationJobCostId,
    generationJobId,
    userId,
  }: SettleGenerationJobCostInput): CreditMutationCommand {
    return {
      userId,
      entryType: generationCreditChargeKind,
      availableCreditDeltaUsdMicros:
        estimatedCostUsdMicros - finalCostUsdMicros,
      reservedCreditDeltaUsdMicros: -estimatedCostUsdMicros,
      generationJobId,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      idempotencyKey: createGenerationCreditChargeIdempotencyKey({
        generationJobId,
      }),
      metadata: createGenerationCreditChargeLedgerMetadata({
        estimatedCostUsdMicros,
        finalCostUsdMicros,
        generationJobCostId,
      }),
      allowNegativeAvailableCreditBalance: true,
    };
  }

  private buildGenerationCreditReservationRelease({
    estimatedCostUsdMicros,
    generationJobCostId,
    generationJobId,
    userId,
  }: ReleaseGenerationJobCostReservationInput): CreditMutationCommand {
    return {
      userId,
      entryType: generationCreditReservationReleaseKind,
      availableCreditDeltaUsdMicros: estimatedCostUsdMicros,
      reservedCreditDeltaUsdMicros: -estimatedCostUsdMicros,
      generationJobId,
      stripeCheckoutSessionId: null,
      stripePaymentIntentId: null,
      stripeEventId: null,
      idempotencyKey: createGenerationCreditReservationReleaseIdempotencyKey({
        generationJobId,
      }),
      metadata: createGenerationCreditReservationReleaseLedgerMetadata({
        estimatedCostUsdMicros,
        generationJobCostId,
      }),
      allowNegativeAvailableCreditBalance: true,
    };
  }

  private assertExistingGenerationCreditChargeMatches({
    command,
    existingLedgerEntry,
  }: {
    command: CreditMutationCommand;
    existingLedgerEntry: CreditLedgerEntryRecord;
  }) {
    if (
      existingLedgerEntry.entryType !== command.entryType ||
      existingLedgerEntry.userId !== command.userId ||
      existingLedgerEntry.availableCreditDeltaUsdMicros !==
        command.availableCreditDeltaUsdMicros ||
      existingLedgerEntry.reservedCreditDeltaUsdMicros !==
        command.reservedCreditDeltaUsdMicros ||
      existingLedgerEntry.generationJobId !== command.generationJobId
    ) {
      throw new Error(
        `Generation job credit charge already exists with conflicting values: ${command.generationJobId}`,
      );
    }
  }

  private assertExistingGenerationCreditReservationReleaseMatches({
    command,
    existingLedgerEntry,
  }: {
    command: CreditMutationCommand;
    existingLedgerEntry: CreditLedgerEntryRecord;
  }) {
    if (
      existingLedgerEntry.entryType !== command.entryType ||
      existingLedgerEntry.userId !== command.userId ||
      existingLedgerEntry.availableCreditDeltaUsdMicros !==
        command.availableCreditDeltaUsdMicros ||
      existingLedgerEntry.reservedCreditDeltaUsdMicros !==
        command.reservedCreditDeltaUsdMicros ||
      existingLedgerEntry.generationJobId !== command.generationJobId
    ) {
      throw new Error(
        `Generation job credit reservation release already exists with conflicting values: ${command.generationJobId}`,
      );
    }
  }

  private buildAlreadyGrantedResult(
    grant: ManualCreditPurchaseGrantRecord,
  ): ManualCreditPurchaseGrantResult {
    return {
      ...grant,
      alreadyGranted: true,
    };
  }

  private async applyCreditMutation(
    command: CreditMutationCommand,
  ): Promise<CreditBalanceMutationRecord> {
    return this.transactionManager.transaction((activeTx) =>
      this.applyCreditMutationInTransaction(command, activeTx),
    );
  }

  private async applyCreditMutationInTransaction(
    command: CreditMutationCommand,
    activeTx: TransactionManager,
  ): Promise<CreditBalanceMutationRecord> {
    const balance = await activeTx.credits.updateCreditBalance(command);
    const ledgerEntry = await activeTx.credits.createCreditLedgerEntry({
      ...this.toCreditLedgerEntryCommand(command),
      availableCreditAmountUsdMicrosAfter:
        balance.availableCreditAmountUsdMicros,
      reservedCreditAmountUsdMicrosAfter: balance.reservedCreditAmountUsdMicros,
    });
    const result = {
      userId: balance.userId,
      availableCreditAmountUsdMicros: balance.availableCreditAmountUsdMicros,
      reservedCreditAmountUsdMicros: balance.reservedCreditAmountUsdMicros,
      ledgerEntryId: ledgerEntry.id,
    };

    await activeTx.services.creditAutoTopUpSettings.maybeTriggerCreditAutoTopUp(
      {
        userId: command.userId,
        entryType: command.entryType,
        availableCreditDeltaUsdMicros: command.availableCreditDeltaUsdMicros,
        availableCreditAmountUsdMicros: balance.availableCreditAmountUsdMicros,
        ledgerEntryId: ledgerEntry.id,
      },
    );

    activeTx.afterCommit(
      () => this.publishCreditBalanceUpdated(result.userId),
      {
        key: `credits.balance.updated:${result.userId}`,
      },
    );

    return result;
  }

  private toCreditLedgerEntryCommand(command: CreditMutationCommand) {
    return {
      userId: command.userId,
      entryType: command.entryType,
      availableCreditDeltaUsdMicros: command.availableCreditDeltaUsdMicros,
      reservedCreditDeltaUsdMicros: command.reservedCreditDeltaUsdMicros,
      generationJobId: command.generationJobId,
      stripeCheckoutSessionId: command.stripeCheckoutSessionId,
      stripePaymentIntentId: command.stripePaymentIntentId,
      stripeEventId: command.stripeEventId,
      idempotencyKey: command.idempotencyKey,
      metadata: command.metadata,
    };
  }

  private async publishCreditBalanceUpdated(userId: string) {
    try {
      await this.realtime.publishInternalEvent(
        createCreditsBalanceUpdatedRealtimeInternalEvent({
          userId,
          occurredAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Realtime events are best-effort. The database balance is authoritative.
    }
  }

  private getStripeCheckoutSessionCreateClient() {
    return (
      this.stripeCheckoutSessionCreateClient ??
      getStripeClient().checkout.sessions
    );
  }

  private getStripeCheckoutSessionRetrieveClient() {
    return (
      this.stripeCheckoutSessionRetrieveClient ??
      getStripeClient().checkout.sessions
    );
  }

  private createCreditPurchaseMetadata({
    amountCents,
    autoReload,
    userId,
  }: {
    amountCents: number;
    autoReload: NonNullable<CreateCreditCheckoutSessionInput["autoReload"]>;
    userId: string;
  }): Stripe.MetadataParam {
    const amount = String(amountCents);
    const creditAmountUsdMicros = String(getUsdMicrosFromCents(amountCents));
    const metadata = {
      remora_user_id: userId,
      amount_cents: amount,
      credit_amount_usd_micros: creditAmountUsdMicros,
      purchase_kind: manualCreditPurchaseKind,
      metadata_version: "1",
    };

    if (autoReload.enabled) {
      return {
        ...metadata,
        auto_reload_enabled: "true",
        auto_reload_top_up_floor_usd_micros: String(
          getUsdMicrosFromCents(autoReload.minimumBalanceCents),
        ),
        auto_reload_top_up_amount_usd_micros: creditAmountUsdMicros,
      };
    }

    return {
      ...metadata,
      auto_reload_enabled: "false",
    };
  }

  private getManualCreditPurchaseAutoReloadSettings({
    amountCents,
    creditAmountUsdMicros,
    metadata,
    session,
  }: {
    amountCents: number;
    creditAmountUsdMicros: number;
    metadata: Stripe.Metadata;
    session: Stripe.Checkout.Session;
  }): ManualCreditPurchaseAutoReloadSettings {
    const enabled = metadata.auto_reload_enabled;

    if (!enabled || enabled === "false") {
      return { enabled: false };
    }

    if (enabled !== "true") {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} used an unsupported auto-reload value`,
      );
    }

    const topUpFloorUsdMicros = this.getPositiveIntegerMetadata(
      metadata,
      "auto_reload_top_up_floor_usd_micros",
    );
    const topUpAmountUsdMicros = this.getPositiveIntegerMetadata(
      metadata,
      "auto_reload_top_up_amount_usd_micros",
    );

    if (topUpAmountUsdMicros !== creditAmountUsdMicros) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} auto-reload amount did not match purchase amount`,
      );
    }

    if (topUpAmountUsdMicros !== getUsdMicrosFromCents(amountCents)) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session ${session.id} auto-reload amount did not match checkout amount`,
      );
    }

    return {
      enabled: true,
      topUpFloorUsdMicros,
      topUpAmountUsdMicros,
      stripePaymentMethodId:
        this.getStripePaymentMethodIdFromCheckoutSession(session),
    };
  }

  private getStripePaymentMethodIdFromCheckoutSession(
    session: Stripe.Checkout.Session,
  ) {
    if (!session.payment_intent || typeof session.payment_intent === "string") {
      return null;
    }

    return this.getStripeId(session.payment_intent.payment_method);
  }

  private toCreditBalanceMutationRecord(
    ledgerEntry: CreditLedgerEntryRecord,
  ): CreditBalanceMutationRecord {
    return {
      userId: ledgerEntry.userId,
      availableCreditAmountUsdMicros:
        ledgerEntry.availableCreditAmountUsdMicrosAfter,
      reservedCreditAmountUsdMicros:
        ledgerEntry.reservedCreditAmountUsdMicrosAfter,
      ledgerEntryId: ledgerEntry.id,
    };
  }

  private createCheckoutReturnUrl(
    status: "success" | "cancel",
    desktopReturnUrl?: string,
  ) {
    const url = desktopReturnUrl
      ? new URL(desktopReturnUrl)
      : new URL("/", this.webOrigin);

    url.searchParams.set("credit_checkout", status);

    return url.toString();
  }

  private getMetadataString(
    metadata: Stripe.Metadata,
    key: keyof Stripe.Metadata,
  ) {
    const value = metadata[key];

    if (!value) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session metadata was missing ${key}`,
      );
    }

    return value;
  }

  private getPositiveIntegerMetadata(metadata: Stripe.Metadata, key: string) {
    const value = this.getMetadataString(metadata, key);
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== value) {
      throw new ManualCreditPurchaseVerificationError(
        `Stripe checkout session metadata ${key} was not a positive integer`,
      );
    }

    return parsed;
  }

  private getStripeId(value: string | { id: string } | null | undefined) {
    if (typeof value === "string") {
      return value;
    }

    return value?.id ?? null;
  }
}

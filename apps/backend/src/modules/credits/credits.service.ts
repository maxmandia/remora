import { parseBackendHttpEnv } from "@remora/env";
import { getUsdMicrosFromCents } from "@remora/utils/currency";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripe/stripe.ts";
import {
  transactionManager,
  type TransactionManager,
} from "../../db/transaction-manager.ts";
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
  CreditBalanceMutationRejectedError,
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
  generationCreditReservationKind,
  InsufficientCreditBalanceError,
  manualCreditPurchaseKind,
  ManualCreditPurchaseVerificationError,
} from "./credits.types.ts";
import {
  createGenerationCreditReservationIdempotencyKey,
  createGenerationCreditReservationLedgerMetadata,
  createManualCreditPurchaseIdempotencyKey,
  createManualCreditPurchaseLedgerMetadata,
  isCreditLedgerEntryIdempotencyKeyConflict,
} from "./credits.utils.ts";

import type {
  CreditBalanceMutationRecord,
  CreditMutationCommand,
  ManualCreditPurchaseGrantRecord,
  ManualCreditPurchaseGrantResult,
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
      transactionManager?: TransactionManager;
      stripeCheckoutSessionClient?: StripeCheckoutSessionCreateClient;
      stripeCheckoutSessionRetrieveClient?: StripeCheckoutSessionRetrieveClient;
      webOrigin?: string;
    } = {},
  ) {
    this.repository = options.creditsRepository ?? creditsRepository;
    this.realtime = options.realtimeRepository ?? realtimeRepository;
    this.transactionManager = options.transactionManager ?? transactionManager;
    this.stripeCheckoutSessionCreateClient =
      options.stripeCheckoutSessionClient ?? null;
    this.stripeCheckoutSessionRetrieveClient =
      options.stripeCheckoutSessionRetrieveClient ?? null;
    this.webOrigin =
      options.webOrigin ?? parseBackendHttpEnv(process.env).WEB_ORIGIN;
  }

  async createCheckoutSession({
    amountCents,
    userId,
  }: {
    amountCents: number;
    userId: string;
  }) {
    const billingProfile = await this.billing.getBillingProfileByUserId(userId);

    if (!billingProfile) {
      throw new CreditCheckoutBillingProfileMissingError(userId);
    }

    const metadata = this.createCreditPurchaseMetadata({
      amountCents,
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
            },
          },
          quantity: 1,
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
      },
      success_url: this.createCheckoutReturnUrl("success"),
      cancel_url: this.createCheckoutReturnUrl("cancel"),
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

  async reserveGenerationJobCostEstimate(
    input: ReserveGenerationJobCostEstimateInput,
    tx: TransactionManager,
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
      return await this.applyCreditMutation(command, tx);
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
    };
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
    tx: TransactionManager = this.transactionManager,
  ): Promise<CreditBalanceMutationRecord> {
    return tx.transaction(async (activeTx) => {
      const balance = await activeTx.credits.updateCreditBalance(command);
      const ledgerEntry = await activeTx.credits.createCreditLedgerEntry({
        ...command,
        availableCreditAmountUsdMicrosAfter:
          balance.availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicrosAfter:
          balance.reservedCreditAmountUsdMicros,
      });
      const result = {
        userId: balance.userId,
        availableCreditAmountUsdMicros: balance.availableCreditAmountUsdMicros,
        reservedCreditAmountUsdMicros: balance.reservedCreditAmountUsdMicros,
        ledgerEntryId: ledgerEntry.id,
      };

      activeTx.afterCommit(
        () => this.publishCreditBalanceUpdated(result.userId),
        {
          key: `credits.balance.updated:${result.userId}`,
        },
      );

      return result;
    });
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
    userId,
  }: {
    amountCents: number;
    userId: string;
  }): Stripe.MetadataParam {
    const amount = String(amountCents);
    const creditAmountUsdMicros = String(getUsdMicrosFromCents(amountCents));

    return {
      remora_user_id: userId,
      amount_cents: amount,
      credit_amount_usd_micros: creditAmountUsdMicros,
      purchase_kind: manualCreditPurchaseKind,
      metadata_version: "1",
    };
  }

  private createCheckoutReturnUrl(status: "success" | "cancel") {
    const url = new URL("/", this.webOrigin);

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

  private getStripeId(value: string | { id: string } | null) {
    if (typeof value === "string") {
      return value;
    }

    return value?.id ?? null;
  }
}

export const creditsService = new CreditsService();

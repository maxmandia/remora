import { parseBackendHttpEnv } from "@remora/env";
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
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
  ManualCreditPurchaseVerificationError,
  manualCreditPurchaseKind,
} from "./credits.types.ts";
import {
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
    const creditAmount = this.getPositiveIntegerMetadata(
      metadata,
      "credit_amount",
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

    if (creditAmount !== amountCents) {
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
      creditAmount,
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

  private buildManualCreditPurchase(
    input: VerifiedManualCreditPurchase,
  ): CreditMutationCommand {
    return {
      userId: input.userId,
      entryType: manualCreditPurchaseKind,
      availableCreditDelta: input.creditAmount,
      reservedCreditDelta: 0,
      generationJobId: null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePaymentIntentId: input.stripePaymentIntentId,
      stripeEventId: input.stripeEventId,
      idempotencyKey: createManualCreditPurchaseIdempotencyKey(input),
      metadata: createManualCreditPurchaseLedgerMetadata(input),
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
  ): Promise<CreditBalanceMutationRecord> {
    const result = await this.transactionManager.transaction(async (tx) => {
      const balance = await tx.credits.updateCreditBalance(command);
      const ledgerEntry = await tx.credits.createCreditLedgerEntry({
        ...command,
        availableCreditAmountAfter: balance.availableCreditAmount,
        reservedCreditAmountAfter: balance.reservedCreditAmount,
      });

      return {
        userId: balance.userId,
        availableCreditAmount: balance.availableCreditAmount,
        reservedCreditAmount: balance.reservedCreditAmount,
        ledgerEntryId: ledgerEntry.id,
      };
    });

    await this.publishCreditBalanceUpdatedEvent(result.userId);

    return result;
  }

  private async publishCreditBalanceUpdatedEvent(userId: string) {
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

    return {
      remora_user_id: userId,
      amount_cents: amount,
      credit_amount: amount,
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

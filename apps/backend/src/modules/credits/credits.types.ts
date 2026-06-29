export const creditLedgerEntryTypes = [
  "manual_credit_purchase",
  "auto_top_up_credit_purchase",
  "generation_credit_reservation",
  "generation_credit_charge",
  "generation_credit_reservation_release",
  "generation_credit_refund",
  "admin_credit_adjustment",
] as const;

export type CreditLedgerEntryType = (typeof creditLedgerEntryTypes)[number];

export const manualCreditPurchaseKind = creditLedgerEntryTypes[0];
export type ManualCreditPurchaseKind = typeof manualCreditPurchaseKind;
export const autoTopUpCreditPurchaseKind = creditLedgerEntryTypes[1];
export type AutoTopUpCreditPurchaseKind = typeof autoTopUpCreditPurchaseKind;
export const generationCreditReservationKind = creditLedgerEntryTypes[2];
export type GenerationCreditReservationKind =
  typeof generationCreditReservationKind;
export const generationCreditChargeKind = creditLedgerEntryTypes[3];
export type GenerationCreditChargeKind = typeof generationCreditChargeKind;
export const generationCreditReservationReleaseKind = creditLedgerEntryTypes[4];
export type GenerationCreditReservationReleaseKind =
  typeof generationCreditReservationReleaseKind;

export type CreditLedgerEntryMetadata = Record<string, unknown>;

export type GenerationCreditReservationLedgerMetadata = {
  generation_submission_id: string;
  generation_job_cost_estimate_id: string;
  estimated_cost_usd_micros: number;
  credit_reservation_kind: GenerationCreditReservationKind;
  metadata_version: "1";
};

export type GenerationCreditChargeLedgerMetadata = {
  generation_job_cost_id: string;
  estimated_cost_usd_micros: number;
  final_cost_usd_micros: number;
  credit_charge_kind: GenerationCreditChargeKind;
  metadata_version: "1";
};

export type GenerationCreditReservationReleaseLedgerMetadata = {
  generation_job_cost_id: string;
  estimated_cost_usd_micros: number;
  credit_reservation_release_kind: GenerationCreditReservationReleaseKind;
  metadata_version: "1";
};

export type ManualCreditPurchaseAutoReloadSettings =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      topUpFloorUsdMicros: number;
      topUpAmountUsdMicros: number;
      stripePaymentMethodId: string | null;
    };

export type VerifiedManualCreditPurchase = {
  userId: string;
  amountCents: number;
  creditAmountUsdMicros: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeEventId: string;
  autoReload: ManualCreditPurchaseAutoReloadSettings;
};

export type VerifiedCreditAutoTopUpPurchase = {
  userId: string;
  amountCents: number;
  creditAmountUsdMicros: number;
  topUpFloorUsdMicros: number;
  triggerLedgerEntryId: string;
  stripePaymentIntentId: string;
};

export type CreditMutationCommand = {
  userId: string;
  entryType: CreditLedgerEntryType;
  availableCreditDeltaUsdMicros: number;
  reservedCreditDeltaUsdMicros: number;
  generationJobId: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeEventId: string | null;
  idempotencyKey: string;
  metadata: CreditLedgerEntryMetadata;
  allowNegativeAvailableCreditBalance: boolean;
};

export type CreditLedgerEntryCreateCommand = Omit<
  CreditMutationCommand,
  "allowNegativeAvailableCreditBalance"
> & {
  availableCreditAmountUsdMicrosAfter: number;
  reservedCreditAmountUsdMicrosAfter: number;
};

export type CreditBalanceMutationRecord = {
  userId: string;
  availableCreditAmountUsdMicros: number;
  reservedCreditAmountUsdMicros: number;
  ledgerEntryId: string;
};

export type ManualCreditPurchaseGrantRecord = CreditBalanceMutationRecord;
export type CreditAutoTopUpGrantRecord = CreditBalanceMutationRecord;

export type UserCreditBalance = {
  userId: string;
  availableCreditAmountUsdMicros: number;
  reservedCreditAmountUsdMicros: number;
};

export type ManualCreditPurchaseGrantResult =
  ManualCreditPurchaseGrantRecord & {
    alreadyGranted: boolean;
  };

export type CreditAutoTopUpGrantResult = CreditAutoTopUpGrantRecord & {
  alreadyGranted: boolean;
};

export class CreditCheckoutBillingProfileMissingError extends Error {
  constructor(userId: string) {
    super(`Billing profile was not found for user ${userId}`);
    this.name = "CreditCheckoutBillingProfileMissingError";
  }
}

export class CreditCheckoutSessionUrlMissingError extends Error {
  constructor() {
    super("Stripe checkout session did not include a URL");
    this.name = "CreditCheckoutSessionUrlMissingError";
  }
}

export class ManualCreditPurchaseVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManualCreditPurchaseVerificationError";
  }
}

export class CreditBalanceMutationRejectedError extends Error {
  constructor(userId: string) {
    super(`Credit balance mutation was rejected for user ${userId}`);
    this.name = "CreditBalanceMutationRejectedError";
  }
}

export class InsufficientCreditBalanceError extends Error {
  readonly code = "INSUFFICIENT_CREDIT_BALANCE";

  constructor({
    requiredAmountUsdMicros,
    userId,
  }: {
    requiredAmountUsdMicros: number;
    userId: string;
  }) {
    super(
      `Insufficient credit balance for user ${userId}: ${requiredAmountUsdMicros} USD micros required`,
    );
    this.name = "InsufficientCreditBalanceError";
  }
}

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

export type CreditLedgerEntryMetadata = Record<string, unknown>;

export type VerifiedManualCreditPurchase = {
  userId: string;
  amountCents: number;
  creditAmount: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeEventId: string;
};

export type ManualCreditPurchaseGrantCommand = {
  userId: string;
  entryType: CreditLedgerEntryType;
  creditAmount: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  stripeEventId: string;
  idempotencyKey: string;
  metadata: CreditLedgerEntryMetadata;
};

export type ManualCreditPurchaseGrantRecord = {
  userId: string;
  availableCreditAmount: number;
  reservedCreditAmount: number;
  ledgerEntryId: string;
};

export type ManualCreditPurchaseGrantResult = ManualCreditPurchaseGrantRecord & {
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

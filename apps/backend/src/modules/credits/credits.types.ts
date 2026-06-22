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

export type CreditLedgerEntryMetadata = Record<string, unknown>;

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

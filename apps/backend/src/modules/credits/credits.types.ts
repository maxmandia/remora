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

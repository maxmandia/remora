export const billingPaymentMethodStatuses = [
  "none",
  "active",
  "requires_action",
  "failed",
] as const;

export type BillingPaymentMethodStatus =
  (typeof billingPaymentMethodStatuses)[number];

export const billingPaymentMethodStatuses = [
  "none",
  "active",
  "requires_action",
  "failed",
] as const;

export type BillingPaymentMethodStatus =
  (typeof billingPaymentMethodStatuses)[number];

export type BillingProfile = {
  userId: string;
  stripeCustomerId: string;
  defaultStripePaymentMethodId: string | null;
  offSessionPaymentsEnabled: boolean;
  offSessionConsentAt: Date | null;
  paymentMethodStatus: BillingPaymentMethodStatus;
};

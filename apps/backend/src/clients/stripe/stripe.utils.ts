import type Stripe from "stripe";
import { manualCreditPurchaseKind } from "../../modules/credits/credits.types";

export function validateStripeCheckoutSessionEvent(event: Stripe.Event) {
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded"
  ) {
    return null;
  }

  const checkoutSession = event.data.object as Stripe.Checkout.Session;

  if (checkoutSession.object !== "checkout.session") {
    return null;
  }

  if (
    checkoutSession.metadata?.purchase_kind !== manualCreditPurchaseKind ||
    checkoutSession.metadata.metadata_version !== "1"
  ) {
    return null;
  }

  if (checkoutSession.payment_status !== "paid") {
    return null;
  }

  return checkoutSession;
}

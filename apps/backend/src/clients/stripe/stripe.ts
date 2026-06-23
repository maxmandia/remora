import { parseStripeEnv } from "@remora/env";
import Stripe from "stripe";

export const stripeApiVersion = "2026-05-27.dahlia";

export type StripeEnv = ReturnType<typeof parseStripeEnv>;
export type StripeCustomerClient = Pick<Stripe["customers"], "create" | "del">;

let configuredStripeClient: Stripe | null = null;

export function createStripeClient(
  env: StripeEnv = parseStripeEnv(process.env),
) {
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: stripeApiVersion,
  });
}

export function getStripeClient() {
  configuredStripeClient ??= createStripeClient();

  return configuredStripeClient;
}

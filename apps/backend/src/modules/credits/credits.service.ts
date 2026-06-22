import { parseBackendHttpEnv } from "@remora/env";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripe.ts";
import {
  billingRepository,
  type BillingRepository,
} from "../billing/billing.repository.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
} from "./credits.types.ts";

type StripeCheckoutSessionClient = Pick<
  Stripe["checkout"]["sessions"],
  "create"
>;

export class CreditsService {
  private readonly stripeCheckoutSessionClient: StripeCheckoutSessionClient | null;
  private readonly webOrigin: string;

  constructor(
    private readonly billing: BillingRepository = billingRepository,
    options: {
      stripeCheckoutSessionClient?: StripeCheckoutSessionClient;
      webOrigin?: string;
    } = {},
  ) {
    this.stripeCheckoutSessionClient =
      options.stripeCheckoutSessionClient ?? null;
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
    const session = await this.getStripeCheckoutSessionClient().create({
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

  private getStripeCheckoutSessionClient() {
    return (
      this.stripeCheckoutSessionClient ?? getStripeClient().checkout.sessions
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
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    };
  }

  private createCheckoutReturnUrl(status: "success" | "cancel") {
    const url = new URL("/", this.webOrigin);

    url.searchParams.set("credit_checkout", status);

    return url.toString();
  }
}

export const creditsService = new CreditsService();

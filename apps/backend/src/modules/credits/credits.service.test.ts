import { describe, expect, it, vi } from "vitest";

import type { BillingRepository } from "../billing/billing.repository.ts";
import { CreditsService } from "./credits.service.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
} from "./credits.types.ts";

vi.mock("../billing/billing.repository.ts", () => ({
  billingRepository: {
    getBillingProfileByUserId: vi.fn(),
  },
}));

describe("CreditsService", () => {
  it("creates Stripe checkout sessions for manual credit purchases", async () => {
    const stripeCheckoutSessionClient = {
      create: vi.fn().mockResolvedValue({
        url: "https://checkout.stripe.test/session_1",
      }),
    };
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionClient,
      webOrigin: "https://app.example.test",
    });

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    expect(stripeCheckoutSessionClient.create).toHaveBeenCalledWith({
      mode: "payment",
      customer: "cus_123",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: 2500,
            product_data: {
              name: "Remora credits",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        remora_user_id: "user_1",
        amount_cents: "2500",
        credit_amount: "2500",
        purchase_kind: "manual_credit_purchase",
        metadata_version: "1",
      },
      payment_intent_data: {
        metadata: {
          remora_user_id: "user_1",
          amount_cents: "2500",
          credit_amount: "2500",
          purchase_kind: "manual_credit_purchase",
          metadata_version: "1",
        },
      },
      success_url: "https://app.example.test/?credit_checkout=success",
      cancel_url: "https://app.example.test/?credit_checkout=cancel",
    });
  });

  it("requires a billing profile before creating checkout", async () => {
    const stripeCheckoutSessionClient = {
      create: vi.fn(),
    };
    const service = new CreditsService(
      createBillingRepository({ stripeCustomerId: null }),
      {
        stripeCheckoutSessionClient,
        webOrigin: "https://app.example.test",
      },
    );

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).rejects.toBeInstanceOf(CreditCheckoutBillingProfileMissingError);
    expect(stripeCheckoutSessionClient.create).not.toHaveBeenCalled();
  });

  it("requires Stripe checkout sessions to include a URL", async () => {
    const service = new CreditsService(createBillingRepository(), {
      stripeCheckoutSessionClient: {
        create: vi.fn().mockResolvedValue({
          url: null,
        }),
      },
      webOrigin: "https://app.example.test",
    });

    await expect(
      service.createCheckoutSession({
        userId: "user_1",
        amountCents: 2500,
      }),
    ).rejects.toBeInstanceOf(CreditCheckoutSessionUrlMissingError);
  });
});

function createBillingRepository({
  stripeCustomerId = "cus_123",
}: {
  stripeCustomerId?: string | null;
} = {}) {
  return {
    getBillingProfileByUserId: vi.fn().mockResolvedValue(
      stripeCustomerId
        ? {
            userId: "user_1",
            stripeCustomerId,
          }
        : null,
    ),
  } as unknown as BillingRepository;
}

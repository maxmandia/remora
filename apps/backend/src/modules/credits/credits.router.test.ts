import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
} from "@remora/domain/credits/validator";

import { creditsRouter } from "./credits.router.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
} from "./credits.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock("./credits.service.ts", () => ({
  creditsService: {
    createCheckoutSession: mocks.createCheckoutSession,
  },
}));

describe("credits router", () => {
  beforeEach(() => {
    mocks.createCheckoutSession.mockReset();
    mocks.createCheckoutSession.mockResolvedValue({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
  });

  it("creates checkout sessions for signed-in users", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());

    await expect(
      caller.createCheckoutSession({ amountCents: 2500 }),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      userId: "user_1",
      amountCents: 2500,
    });
  });

  it("rejects invalid checkout amounts", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());

    for (const amountCents of [
      minCreditPurchaseAmountCents - 1,
      100.5,
      maxCreditPurchaseAmountCents + 1,
    ]) {
      await expect(
        caller.createCheckoutSession({ amountCents }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    }
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    const caller = creditsRouter.createCaller(createSignedOutContext());

    await expect(
      caller.createCheckoutSession({ amountCents: 2500 }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("maps missing billing profiles to not found errors", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());
    mocks.createCheckoutSession.mockRejectedValue(
      new CreditCheckoutBillingProfileMissingError("user_1"),
    );

    await expect(
      caller.createCheckoutSession({ amountCents: 2500 }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Billing profile was not found.",
    });
  });

  it("maps missing Stripe checkout URLs to internal errors", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());
    mocks.createCheckoutSession.mockRejectedValue(
      new CreditCheckoutSessionUrlMissingError(),
    );

    await expect(
      caller.createCheckoutSession({ amountCents: 2500 }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Stripe checkout session did not include a URL.",
    });
  });
});

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}

function createSignedOutContext(): TRPCContext {
  return {
    session: null,
    user: null,
  } as unknown as TRPCContext;
}

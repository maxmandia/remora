import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import Fastify from "fastify";
import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
} from "@remora/domain/credits/validator";
import { stripeApiVersion } from "../../clients/stripe/stripe.ts";

import {
  creditsRouter,
  registerStripeWebhookRoutes,
} from "./credits.router.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
} from "./credits.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

type StartManualCreditPurchaseWorkflow = (input: {
  stripeCheckoutSessionId: string;
  stripeEventId: string;
  receivedAt: string;
}) => Promise<{
  workflowId: string;
  runId: string | null;
  alreadyStarted: boolean;
}>;

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  getBalanceByUserId: vi.fn(),
}));

vi.mock("./credits.repository.ts", () => ({
  creditsRepository: {
    getBalanceByUserId: mocks.getBalanceByUserId,
  },
}));

vi.mock("../../app.service.ts", () => ({
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
    mocks.getBalanceByUserId.mockReset();
    mocks.getBalanceByUserId.mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
  });

  it("gets the signed-in user's credit balance", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());

    await expect(caller.getBalance()).resolves.toEqual({
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    expect(mocks.getBalanceByUserId).toHaveBeenCalledWith("user_1");
  });

  it("requires authentication before getting credit balances", async () => {
    const caller = creditsRouter.createCaller(createSignedOutContext());

    await expect(caller.getBalance()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(mocks.getBalanceByUserId).not.toHaveBeenCalled();
  });

  it("maps missing credit balances to not found errors", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());
    mocks.getBalanceByUserId.mockResolvedValue(null);

    await expect(caller.getBalance()).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Credit balance was not found.",
    });
    expect(mocks.getBalanceByUserId).toHaveBeenCalledWith("user_1");
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

  it("forwards auto-reload settings when creating checkout sessions", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());

    await expect(
      caller.createCheckoutSession({
        amountCents: 2500,
        autoReload: {
          enabled: true,
          minimumBalanceCents: 500,
        },
      }),
    ).resolves.toEqual({
      checkoutUrl: "https://checkout.stripe.test/session_1",
    });
    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      userId: "user_1",
      amountCents: 2500,
      autoReload: {
        enabled: true,
        minimumBalanceCents: 500,
      },
    });
  });

  it("forwards validated desktop checkout return URLs", async () => {
    const caller = creditsRouter.createCaller(createSignedInContext());
    const desktopReturnUrl =
      "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678";

    await caller.createCheckoutSession({
      amountCents: 2500,
      desktopReturnUrl,
    });

    expect(mocks.createCheckoutSession).toHaveBeenCalledWith({
      userId: "user_1",
      amountCents: 2500,
      desktopReturnUrl,
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

describe("Stripe credit purchase webhooks", () => {
  it("accepts paid checkout session events and starts credit fulfillment", async () => {
    const { server, startWorkflow, signedPayload } =
      await createStripeWebhookServer(
        createStripeEvent({
          id: "evt_paid",
          type: "checkout.session.completed",
        }),
      );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: signedPayload.headers,
        payload: signedPayload.payload,
      });

      expect(response.statusCode).toBe(202);
      expect(startWorkflow).toHaveBeenCalledWith({
        stripeCheckoutSessionId: "cs_123",
        stripeEventId: "evt_paid",
        receivedAt: expect.any(String),
      });
    } finally {
      await server.close();
    }
  });

  it("accepts duplicate workflow starts as successful webhook deliveries", async () => {
    const alreadyStartedError = new WorkflowExecutionAlreadyStartedError(
      "Workflow execution already started",
      "credit-purchase:checkout-session:cs_123",
      "createManualCreditPurchaseWorkflow",
    );
    const { server, signedPayload } = await createStripeWebhookServer(
      createStripeEvent(),
      {
        startWorkflow: vi.fn().mockRejectedValue(alreadyStartedError),
      },
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: signedPayload.headers,
        payload: signedPayload.payload,
      });

      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual({
        ok: true,
        alreadyStarted: true,
      });
    } finally {
      await server.close();
    }
  });

  it("rejects invalid webhook signatures", async () => {
    const { server, startWorkflow, signedPayload } =
      await createStripeWebhookServer(createStripeEvent());

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: {
          ...signedPayload.headers,
          "stripe-signature": "invalid",
        },
        payload: signedPayload.payload,
      });

      expect(response.statusCode).toBe(400);
      expect(startWorkflow).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("ignores unrelated and unpaid webhook events", async () => {
    const { server, startWorkflow, stripe, webhookSecret } =
      await createStripeWebhookServer(createStripeEvent());
    const unrelatedPayload = signStripeEvent({
      stripe,
      webhookSecret,
      event: createStripeEvent({
        type: "payment_intent.succeeded",
      }),
    });
    const unpaidPayload = signStripeEvent({
      stripe,
      webhookSecret,
      event: createStripeEvent({
        type: "checkout.session.completed",
        session: createCheckoutSession({ payment_status: "unpaid" }),
      }),
    });

    try {
      const unrelatedResponse = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: unrelatedPayload.headers,
        payload: unrelatedPayload.payload,
      });
      const unpaidResponse = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: unpaidPayload.headers,
        payload: unpaidPayload.payload,
      });

      expect(unrelatedResponse.statusCode).toBe(200);
      expect(unpaidResponse.statusCode).toBe(200);
      expect(startWorkflow).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });

  it("returns a retryable status when Temporal cannot start fulfillment", async () => {
    const { server, signedPayload } = await createStripeWebhookServer(
      createStripeEvent(),
      {
        startWorkflow: vi.fn().mockRejectedValue(new Error("Temporal down")),
      },
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/api/stripe/webhooks",
        headers: signedPayload.headers,
        payload: signedPayload.payload,
      });

      expect(response.statusCode).toBe(503);
    } finally {
      await server.close();
    }
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

async function createStripeWebhookServer(
  event: Stripe.Event,
  {
    startWorkflow = vi.fn(async () => ({
      workflowId: "credit-purchase:checkout-session:cs_123",
      runId: "run_123",
      alreadyStarted: false,
    })),
  }: {
    startWorkflow?: StartManualCreditPurchaseWorkflow;
  } = {},
) {
  const server = Fastify({ logger: false });
  const stripe = new Stripe("sk_test_123", {
    apiVersion: stripeApiVersion,
  });
  const webhookSecret = "whsec_test_secret";
  const signedPayload = signStripeEvent({
    stripe,
    webhookSecret,
    event,
  });

  await registerStripeWebhookRoutes(server, {
    stripeWebhookClient: stripe.webhooks,
    stripeWebhookSecret: webhookSecret,
    startWorkflow,
  });

  return {
    server,
    stripe,
    webhookSecret,
    signedPayload,
    startWorkflow,
  };
}

function signStripeEvent({
  stripe,
  webhookSecret,
  event,
}: {
  stripe: Stripe;
  webhookSecret: string;
  event: Stripe.Event;
}) {
  const payload = JSON.stringify(event);

  return {
    payload,
    headers: {
      "content-type": "application/json",
      "stripe-signature": stripe.webhooks.generateTestHeaderString({
        payload,
        secret: webhookSecret,
      }),
    },
  };
}

function createStripeEvent({
  id = "evt_123",
  type = "checkout.session.completed",
  session = createCheckoutSession(),
}: {
  id?: string;
  type?: Stripe.Event.Type;
  session?: Stripe.Checkout.Session;
} = {}): Stripe.Event {
  return {
    id,
    object: "event",
    api_version: stripeApiVersion,
    created: 1_780_000_000,
    data: {
      object: session,
    },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type,
  } as Stripe.Event;
}

function createCheckoutSession(
  overrides: Partial<Stripe.Checkout.Session> = {},
): Stripe.Checkout.Session {
  return {
    id: "cs_123",
    object: "checkout.session",
    payment_status: "paid",
    metadata: {
      remora_user_id: "user_1",
      amount_cents: "2500",
      credit_amount_usd_micros: "25000000",
      purchase_kind: "manual_credit_purchase",
      metadata_version: "1",
    },
    ...overrides,
  } as Stripe.Checkout.Session;
}

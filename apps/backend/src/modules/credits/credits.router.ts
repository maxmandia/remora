import { createCreditCheckoutSessionInputSchema } from "@remora/domain/credits/validator";
import { parseStripeWebhookEnv } from "@remora/env";
import { WorkflowExecutionAlreadyStartedError } from "@temporalio/client";
import { TRPCError } from "@trpc/server";
import type { FastifyInstance } from "fastify";
import type Stripe from "stripe";

import { getStripeClient } from "../../clients/stripe/stripe.ts";
import { validateStripeCheckoutSessionEvent } from "../../clients/stripe/stripe.utils.ts";
import { startManualCreditPurchaseWorkflow } from "../../temporal/client.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { creditsService } from "./credits.service.ts";
import {
  CreditCheckoutBillingProfileMissingError,
  CreditCheckoutSessionUrlMissingError,
} from "./credits.types.ts";

export const creditsRouter = router({
  createCheckoutSession: protectedProcedure
    .input(createCreditCheckoutSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await creditsService.createCheckoutSession({
          userId: ctx.user.id,
          amountCents: input.amountCents,
        });
      } catch (error) {
        if (error instanceof CreditCheckoutBillingProfileMissingError) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Billing profile was not found.",
            cause: error,
          });
        }

        if (error instanceof CreditCheckoutSessionUrlMissingError) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Stripe checkout session did not include a URL.",
            cause: error,
          });
        }

        throw error;
      }
    }),
});

type StripeWebhookClient = Pick<Stripe["webhooks"], "constructEvent">;
type StartManualCreditPurchaseWorkflow =
  typeof startManualCreditPurchaseWorkflow;

type StripeWebhookRouteOptions = {
  stripeWebhookClient?: StripeWebhookClient;
  stripeWebhookSecret?: string;
  startWorkflow?: StartManualCreditPurchaseWorkflow;
};

export async function registerStripeWebhookRoutes(
  server: FastifyInstance,
  options: StripeWebhookRouteOptions = {},
) {
  const stripeWebhookClient =
    options.stripeWebhookClient ?? getStripeClient().webhooks;
  const stripeWebhookSecret =
    options.stripeWebhookSecret ??
    parseStripeWebhookEnv(process.env).STRIPE_WEBHOOK_SECRET;
  const startWorkflow =
    options.startWorkflow ?? startManualCreditPurchaseWorkflow;

  await server.register(async (stripeRoutes) => {
    stripeRoutes.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => {
        done(null, body);
      },
    );

    stripeRoutes.post("/api/stripe/webhooks", async (request, reply) => {
      if (!Buffer.isBuffer(request.body)) {
        return reply.status(400).send({
          error: "Stripe webhook payload must be a raw request body",
        });
      }

      const stripeSignatureHeader = request.headers["stripe-signature"];
      const signature = Array.isArray(stripeSignatureHeader)
        ? (stripeSignatureHeader[0] ?? null)
        : (stripeSignatureHeader ?? null);

      if (!signature) {
        return reply.status(400).send({
          error: "Missing Stripe webhook signature",
        });
      }

      let event: Stripe.Event;

      try {
        event = stripeWebhookClient.constructEvent(
          request.body,
          signature,
          stripeWebhookSecret,
        );
      } catch (error) {
        request.log.warn(
          { error },
          "Stripe webhook signature verification failed",
        );

        return reply.status(400).send({
          error: "Invalid Stripe webhook signature",
        });
      }

      const checkoutSession = validateStripeCheckoutSessionEvent(event);

      if (!checkoutSession) {
        return reply.status(200).send({ ok: true, ignored: true });
      }

      try {
        await startWorkflow({
          stripeCheckoutSessionId: checkoutSession.id,
          stripeEventId: event.id,
          receivedAt: new Date().toISOString(),
        });
      } catch (error) {
        if (error instanceof WorkflowExecutionAlreadyStartedError) {
          return reply.status(202).send({ ok: true, alreadyStarted: true });
        }

        request.log.error(
          { error, stripeEventId: event.id },
          "Stripe credit purchase workflow start failed",
        );

        return reply.status(503).send({
          error: "Credit purchase workflow could not be started",
        });
      }

      return reply.status(202).send({ ok: true });
    });
  });
}

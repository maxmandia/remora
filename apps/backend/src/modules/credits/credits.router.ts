import { createCreditCheckoutSessionInputSchema } from "@remora/domain/credits/validator";
import { TRPCError } from "@trpc/server";

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

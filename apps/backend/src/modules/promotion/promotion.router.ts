import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { promotionService } from "../../app.service.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure, publicProcedure } from "../../trpc/procedures.ts";
import {
  InvalidPromotionTicketError,
  PromotionAccountIneligibleError,
  PromotionClaimConflictError,
  PromotionClaimNotFoundError,
  PromotionDisabledError,
  PromotionVerificationRequiredError,
} from "./promotion.types.ts";

const promotionTicketInputSchema = z.strictObject({
  ticket: z.string().min(1).max(4_096),
});

export const promotionRouter = router({
  issueTicket: publicProcedure.mutation(() => {
    try {
      return promotionService.issueTicket();
    } catch (error) {
      throw mapPromotionError(error);
    }
  }),
  claim: protectedProcedure
    .input(promotionTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await promotionService.claim({
          userId: ctx.user.id,
          ticket: input.ticket,
        });
      } catch (error) {
        throw mapPromotionError(error);
      }
    }),
  getStatus: protectedProcedure.query(({ ctx }) =>
    promotionService.getStatus(ctx.user.id),
  ),
  redeem: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      return await promotionService.redeem(ctx.user.id);
    } catch (error) {
      throw mapPromotionError(error);
    }
  }),
});

function mapPromotionError(error: unknown): unknown {
  if (error instanceof PromotionDisabledError) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof InvalidPromotionTicketError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PromotionAccountIneligibleError) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PromotionClaimConflictError) {
    return new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PromotionClaimNotFoundError) {
    return new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof PromotionVerificationRequiredError) {
    return new TRPCError({
      code: "PRECONDITION_FAILED",
      message: error.message,
      cause: error,
    });
  }

  return error;
}

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { googleAdsService } from "./google_ads.service.ts";
import {
  GoogleAdsAttributionValidationError,
  googleAdsClickIdTypes,
} from "./google_ads.types.ts";

export const googleAdsRouter = router({
  // This is being used even though no references are shown in the IDE
  captureClickAttribution: protectedProcedure
    .input(
      z.object({
        clickIdType: z.enum(googleAdsClickIdTypes),
        clickId: z.string().min(1).max(512),
        capturedAt: z.coerce.date(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.session.impersonatedBy) {
        return { captured: false as const };
      }

      try {
        const attribution = await googleAdsService.captureClickAttribution({
          ...input,
          userId: ctx.user.id,
        });

        return {
          captured: true as const,
          expiresAt: attribution.expiresAt,
        };
      } catch (error) {
        if (error instanceof GoogleAdsAttributionValidationError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: error,
          });
        }

        throw error;
      }
    }),
});

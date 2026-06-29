import { updateCreditAutoTopUpSettingsInputSchema } from "@remora/domain/credits/validator";
import { getUsdMicrosFromCents } from "@remora/utils/currency";
import { TRPCError } from "@trpc/server";

import { creditAutoTopUpSettingsService } from "../../app.service.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { creditAutoTopUpSettingsRepository } from "./credit_auto_top_up_settings.repository.ts";
import { CreditAutoTopUpSettingsNotEditableError } from "./credit_auto_top_up_settings.types.ts";

export const creditAutoTopUpSettingsRouter = router({
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings =
      await creditAutoTopUpSettingsRepository.getSettingsByUserId(ctx.user.id);

    if (!settings) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Credit auto-reload settings were not found.",
      });
    }

    return {
      enabled: settings.enabled,
      topUpFloorUsdMicros: settings.topUpFloorUsdMicros,
      topUpAmountUsdMicros: settings.topUpAmountUsdMicros,
    };
  }),

  updateSettings: protectedProcedure
    .input(updateCreditAutoTopUpSettingsInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await creditAutoTopUpSettingsService.updateSettings(
          input.enabled
            ? {
                userId: ctx.user.id,
                enabled: true,
                topUpFloorUsdMicros: getUsdMicrosFromCents(
                  input.topUpFloorCents,
                ),
                topUpAmountUsdMicros: getUsdMicrosFromCents(
                  input.topUpAmountCents,
                ),
              }
            : {
                userId: ctx.user.id,
                enabled: false,
              },
        );
      } catch (error) {
        if (error instanceof CreditAutoTopUpSettingsNotEditableError) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
            cause: error,
          });
        }

        throw error;
      }
    }),
});

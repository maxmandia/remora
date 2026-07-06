import { TRPCError } from "@trpc/server";

import { captureObservabilityException } from "../modules/observability/observability.service.ts";
import { t } from "./init.ts";

export const publicProcedure = t.procedure.use(async ({ ctx, next, path }) => {
  try {
    return await next();
  } catch (error) {
    captureObservabilityException(error, {
      requestId: ctx.requestId,
      userId: ctx.user?.id,
      trpcPath: path,
    });

    throw error;
  }
});

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  });
});

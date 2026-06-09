import { router } from "../../trpc/init.ts";
import { publicProcedure } from "../../trpc/procedures.ts";

export const systemRouter = router({
  ping: publicProcedure.query(() => ({
    ok: true,
  })),
});

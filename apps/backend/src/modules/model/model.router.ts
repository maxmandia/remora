import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { modelRepository } from "./model.repository.ts";

export const modelRouter = router({
  listPublished: protectedProcedure.query(() => modelRepository.listPublished()),
});

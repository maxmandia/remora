import { router } from "../../trpc/init.ts";
import { publicProcedure } from "../../trpc/procedures.ts";
import { modelRepository } from "./model.repository.ts";

export const modelRouter = router({
  listPublished: publicProcedure.query(() => modelRepository.listPublished()),
});

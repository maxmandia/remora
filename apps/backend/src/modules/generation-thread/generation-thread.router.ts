import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { generationThreadRepository } from "./generation-thread.repository.ts";

export const generationThreadRouter = router({
  listWithoutProject: protectedProcedure.query(({ ctx }) =>
    generationThreadRepository.listThreadsWithoutProjectForUser(ctx.user.id),
  ),
});

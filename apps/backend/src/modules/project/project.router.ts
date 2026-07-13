import { createProjectInputSchema } from "@remora/domain/project/validator";
import { TRPCError } from "@trpc/server";

import { projectService } from "../../app.service.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { projectRepository } from "./project.repository.ts";
import { DuplicateProjectNameError } from "./project.types.ts";

export const projectRouter = router({
  listProjects: protectedProcedure.query(({ ctx }) =>
    projectRepository.listProjectsForUser(ctx.user.id),
  ),

  createProject: protectedProcedure
    .input(createProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await projectService.createProject({
          userId: ctx.user.id,
          name: input.name,
        });
      } catch (error) {
        if (error instanceof DuplicateProjectNameError) {
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

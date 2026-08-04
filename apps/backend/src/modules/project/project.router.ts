import {
  createProjectInputSchema,
  renameProjectInputSchema,
} from "@remora/domain/project/validator";
import { TRPCError } from "@trpc/server";

import { projectService } from "../../app.service.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";
import { projectRepository } from "./project.repository.ts";
import {
  DuplicateProjectNameError,
  ProjectNotFoundError,
} from "./project.types.ts";

export const projectRouter = router({
  listProjects: protectedProcedure.query(({ ctx }) =>
    projectRepository.listProjectsForUser(ctx.user.id),
  ),

  createProject: protectedProcedure
    .input(createProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await projectService.createProject({
          analyticsContext: {
            suppressed: Boolean(ctx.session.impersonatedBy),
          },
          userId: ctx.user.id,
          name: input.name,
        });
      } catch (error) {
        throwProjectMutationError(error);
      }
    }),

  renameProject: protectedProcedure
    .input(renameProjectInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await projectRepository.renameProject({
          userId: ctx.user.id,
          projectId: input.projectId,
          name: input.name,
        });
      } catch (error) {
        throwProjectMutationError(error);
      }
    }),
});

function throwProjectMutationError(error: unknown): never {
  if (error instanceof DuplicateProjectNameError) {
    throw new TRPCError({
      code: "CONFLICT",
      message: error.message,
      cause: error,
    });
  }

  if (error instanceof ProjectNotFoundError) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: error.message,
      cause: error,
    });
  }

  throw error;
}

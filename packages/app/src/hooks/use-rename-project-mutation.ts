import type { ProjectSummary } from "@remora/domain/project/dto";
import type { RenameProjectInput } from "@remora/domain/project/validator";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { AppTRPCError } from "../lib/error.ts";
import {
  renameProjectInList,
  restoreProjectInList,
} from "../lib/project/project-cache.ts";
import { useTRPC } from "../trpc.ts";

export type UseRenameProjectMutationOptions = {
  onError?: (context: {
    error: AppTRPCError;
    input: RenameProjectInput;
  }) => void;
  onSuccess?: () => void;
};

type RenameProjectMutationContext = {
  previousProject?: ProjectSummary;
  previousProjectIndex: number;
};

export function useRenameProjectMutation({
  onError,
  onSuccess,
}: UseRenameProjectMutationOptions = {}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const projectListQueryFilter = trpc.project.listProjects.queryFilter();
  const projectListQueryKey = projectListQueryFilter.queryKey;

  return useMutation(
    trpc.project.renameProject.mutationOptions({
      onMutate: async (input): Promise<RenameProjectMutationContext> => {
        await queryClient.cancelQueries(projectListQueryFilter);

        const currentProjects =
          queryClient.getQueryData<ProjectSummary[]>(projectListQueryKey);
        const previousProjectIndex =
          currentProjects?.findIndex(({ id }) => id === input.projectId) ?? -1;
        const previousProject =
          previousProjectIndex >= 0
            ? currentProjects?.[previousProjectIndex]
            : undefined;

        queryClient.setQueryData<ProjectSummary[]>(
          projectListQueryKey,
          (projects) =>
            renameProjectInList(projects, {
              id: input.projectId,
              name: input.name,
              updatedAt: new Date().toISOString(),
            }),
        );

        return { previousProject, previousProjectIndex };
      },
      onSuccess: (renamedProject) => {
        queryClient.setQueryData<ProjectSummary[]>(
          projectListQueryKey,
          (projects) => renameProjectInList(projects, renamedProject),
        );
        onSuccess?.();
      },
      onError: (error, input, context) => {
        const previousProject = context?.previousProject;

        if (previousProject && context.previousProjectIndex >= 0) {
          queryClient.setQueryData<ProjectSummary[]>(
            projectListQueryKey,
            (projects) =>
              restoreProjectInList(
                projects,
                previousProject,
                context.previousProjectIndex,
              ),
          );
        }

        onError?.({ error, input });
      },
      onSettled: async () => {
        await queryClient.invalidateQueries(projectListQueryFilter);
      },
      meta: {
        suppressErrorToast: true,
      },
    }),
  );
}

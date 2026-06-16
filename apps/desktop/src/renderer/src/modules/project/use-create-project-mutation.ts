import type { ProjectSummary } from "@remora/domain/project/dto";
import type { CreateProjectInput } from "@remora/domain/project/validator";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { type AppTRPCError, useTRPC } from "../../lib/trpc.ts";
import {
  createOptimisticProject,
  prependProject,
  removeProjectById,
  replaceOptimisticProject,
} from "./project-cache.ts";

type UseCreateProjectMutationOptions = {
  onError?: (context: {
    error: AppTRPCError;
    input: CreateProjectInput;
  }) => void;
};

type CreateProjectMutationContext = {
  optimisticProjectId: string;
};

export function useCreateProjectMutation({
  onError,
}: UseCreateProjectMutationOptions = {}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const projectListQueryFilter = trpc.project.listProjects.queryFilter();
  const projectListQueryKey = projectListQueryFilter.queryKey;

  return useMutation(
    trpc.project.createProject.mutationOptions({
      onMutate: async (input): Promise<CreateProjectMutationContext> => {
        await queryClient.cancelQueries(projectListQueryFilter);

        const optimisticProject = createOptimisticProject(input);

        queryClient.setQueryData<ProjectSummary[]>(
          projectListQueryKey,
          (currentProjects) =>
            prependProject(currentProjects, optimisticProject),
        );

        return {
          optimisticProjectId: optimisticProject.id,
        };
      },
      onSuccess: (createdProject, _input, context) => {
        queryClient.setQueryData<ProjectSummary[]>(
          projectListQueryKey,
          (currentProjects) =>
            replaceOptimisticProject(
              currentProjects,
              context?.optimisticProjectId,
              createdProject,
            ),
        );
      },
      onError: (error, input, context) => {
        if (context?.optimisticProjectId) {
          queryClient.setQueryData<ProjectSummary[]>(
            projectListQueryKey,
            (currentProjects) =>
              removeProjectById(currentProjects, context.optimisticProjectId),
          );
        }

        onError?.({ error, input });
      },
      onSettled: async () => {
        await queryClient.invalidateQueries(projectListQueryFilter);
      },
    }),
  );
}

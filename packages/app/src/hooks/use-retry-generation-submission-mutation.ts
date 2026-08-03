import type {
  CreatedGenerationSubmission,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  appendGenerationSubmission,
  createOptimisticGenerationSubmissionRetry,
  reconcileOptimisticGenerationSubmission,
  removeGenerationSubmission,
  replaceGenerationSubmission,
} from "../lib/generation/generation-submission-cache.ts";
import { useTRPC } from "../trpc.ts";

export function useRetryGenerationSubmissionMutation() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const mutation = useMutation(trpc.generation.retry.mutationOptions({}));

  const retryGeneration = useCallback(
    async (
      submission: GenerationThreadSubmission,
    ): Promise<CreatedGenerationSubmission> => {
      const queryOptions =
        trpc.generation.listSubmissionsFromThread.queryOptions({
          threadId: submission.threadId,
        });
      const optimisticSubmission =
        createOptimisticGenerationSubmissionRetry(submission);

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey });
      queryClient.setQueryData<GenerationThreadSubmission[]>(
        queryOptions.queryKey,
        (currentSubmissions) =>
          appendGenerationSubmission(currentSubmissions, optimisticSubmission),
      );

      try {
        const createdSubmission = await mutation.mutateAsync({
          submissionId: submission.id,
        });
        const reconciledSubmission = reconcileOptimisticGenerationSubmission(
          optimisticSubmission,
          createdSubmission,
        );

        queryClient.setQueryData<GenerationThreadSubmission[]>(
          queryOptions.queryKey,
          (currentSubmissions) =>
            replaceGenerationSubmission(
              currentSubmissions,
              optimisticSubmission.id,
              reconciledSubmission,
            ),
        );

        void queryClient.invalidateQueries({
          queryKey: queryOptions.queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey:
            trpc.generationThread.listWithoutProject.queryOptions(undefined)
              .queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.project.listProjects.queryOptions(undefined).queryKey,
        });

        return createdSubmission;
      } catch (error) {
        queryClient.setQueryData<GenerationThreadSubmission[]>(
          queryOptions.queryKey,
          (currentSubmissions) =>
            removeGenerationSubmission(
              currentSubmissions,
              optimisticSubmission.id,
            ),
        );

        throw error;
      }
    },
    [mutation, queryClient, trpc],
  );

  return {
    isPending: mutation.isPending,
    retryGeneration,
  };
}

import type {
  CreatedGenerationSubmission,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  appendGenerationSubmission,
  createOptimisticGenerationDraftEnhancement,
  reconcileOptimisticGenerationSubmission,
  removeGenerationSubmission,
  replaceGenerationSubmission,
} from "../lib/generation/generation-submission-cache.ts";
import { useTRPC } from "../trpc.ts";

export function useEnhanceGenerationDraftMutation() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const mutation = useMutation(
    trpc.generation.enhanceDraft.mutationOptions({}),
  );

  const enhanceDraft = useCallback(
    async ({
      eligibleDraftCount,
      sourceJobId,
      submission,
    }: {
      eligibleDraftCount: number;
      sourceJobId?: string;
      submission: Extract<GenerationThreadSubmission, { modelType: "video" }>;
    }): Promise<CreatedGenerationSubmission> => {
      const queryOptions =
        trpc.generation.listSubmissionsFromThread.queryOptions({
          threadId: submission.threadId,
        });
      const optimisticSubmission = createOptimisticGenerationDraftEnhancement(
        submission,
        eligibleDraftCount,
      );

      await queryClient.cancelQueries({ queryKey: queryOptions.queryKey });
      queryClient.setQueryData<GenerationThreadSubmission[]>(
        queryOptions.queryKey,
        (currentSubmissions) =>
          appendGenerationSubmission(currentSubmissions, optimisticSubmission),
      );

      try {
        const createdSubmission = await mutation.mutateAsync({
          submissionId: submission.id,
          ...(sourceJobId ? { sourceJobId } : {}),
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

        void queryClient.invalidateQueries({ queryKey: queryOptions.queryKey });
        void queryClient.invalidateQueries({
          queryKey:
            trpc.generationThread.listWithoutProject.queryOptions(undefined)
              .queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.project.listProjects.queryOptions(undefined).queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.credits.getBalance.queryOptions().queryKey,
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
    enhanceDraft,
    error: mutation.error,
    isPending: mutation.isPending,
    reset: mutation.reset,
  };
}

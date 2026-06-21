import type {
  CreateVideoGenerationInput,
  GenerationThreadSubmission,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  useGenerationAttachmentMediaUpload,
  type UploadedGenerationAttachmentMediaValue,
} from "../../hooks/use-generation-attachment-media-upload.ts";
import type { GenerationSettingsValue } from "../../lib/generation/index.ts";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import { useTRPC } from "../../lib/trpc.ts";
import {
  createOptimisticGenerationSubmission,
  prependGenerationSubmission,
  reconcileOptimisticGenerationSubmission,
  removeGenerationSubmission,
  replaceGenerationSubmission,
} from "./generation-submission-cache.ts";

export type GenerationSubmissionTarget =
  | { kind: "existing-thread"; threadId: string }
  | { kind: "new-thread"; projectId: string | null };

export type GenerationSubmissionDraft = {
  model: PublishedGenerationModelSummary;
  prompt: string;
  attachmentMedia: GenerationAttachmentMediaValue;
  settings: GenerationSettingsValue;
  target: GenerationSubmissionTarget;
  userId: string;
};

export function useCreateGenerationSubmissionMutation() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [pendingFreshThreadSubmission, setPendingFreshThreadSubmission] =
    useState<GenerationThreadSubmission | null>(null);
  const { isAttachmentMediaUploadPending, uploadAttachmentMedia } =
    useGenerationAttachmentMediaUpload();
  const createVideoMutation = useMutation(
    trpc.generation.createVideo.mutationOptions({}),
  );
  const clearPendingFreshThreadSubmission = useCallback(() => {
    setPendingFreshThreadSubmission(null);
  }, []);

  const submitGeneration = useCallback(
    async (draft: GenerationSubmissionDraft) => {
      const optimisticSubmission = createOptimisticGenerationSubmission({
        model: draft.model,
        prompt: draft.prompt,
        requestedGenerations: draft.settings.requestedGenerations,
        settings: draft.settings,
        ...(draft.target.kind === "existing-thread"
          ? { threadId: draft.target.threadId }
          : {}),
        userId: draft.userId,
      });
      const existingThreadQueryOptions =
        draft.target.kind === "existing-thread"
          ? trpc.generation.listSubmissionsFromThread.queryOptions({
              threadId: draft.target.threadId,
            })
          : null;

      try {
        if (existingThreadQueryOptions) {
          await queryClient.cancelQueries({
            queryKey: existingThreadQueryOptions.queryKey,
          });
          queryClient.setQueryData<GenerationThreadSubmission[]>(
            existingThreadQueryOptions.queryKey,
            (currentSubmissions) =>
              prependGenerationSubmission(
                currentSubmissions,
                optimisticSubmission,
              ),
          );
        } else {
          setPendingFreshThreadSubmission(optimisticSubmission);
        }

        const attachmentMedia = await uploadAttachmentMedia(
          draft.attachmentMedia,
        );
        const createVideoAttachmentMedia =
          toCreateVideoAttachmentMediaInput(attachmentMedia);
        const createdSubmission = await createVideoMutation.mutateAsync({
          modelId: draft.model.id,
          modelSpecId: draft.model.latestSpecId,
          prompt: draft.prompt,
          attachmentMedia: createVideoAttachmentMedia,
          ...draft.settings,
          ...(draft.target.kind === "existing-thread"
            ? { threadId: draft.target.threadId }
            : {}),
          ...(draft.target.kind === "new-thread" && draft.target.projectId
            ? { projectId: draft.target.projectId }
            : {}),
        });
        const reconciledSubmission = reconcileOptimisticGenerationSubmission(
          optimisticSubmission,
          createdSubmission,
        );
        const createdThreadQueryOptions =
          trpc.generation.listSubmissionsFromThread.queryOptions({
            threadId: createdSubmission.threadId,
          });

        queryClient.setQueryData<GenerationThreadSubmission[]>(
          createdThreadQueryOptions.queryKey,
          (currentSubmissions) =>
            replaceGenerationSubmission(
              currentSubmissions,
              optimisticSubmission.id,
              reconciledSubmission,
            ),
        );

        void queryClient.invalidateQueries({
          queryKey:
            trpc.generation.listThreadsWithoutProject.queryOptions(undefined)
              .queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: trpc.project.listProjects.queryOptions(undefined).queryKey,
        });
        void queryClient.invalidateQueries({
          queryKey: createdThreadQueryOptions.queryKey,
        });

        return createdSubmission;
      } catch (error) {
        if (existingThreadQueryOptions) {
          queryClient.setQueryData<GenerationThreadSubmission[]>(
            existingThreadQueryOptions.queryKey,
            (currentSubmissions) =>
              removeGenerationSubmission(
                currentSubmissions,
                optimisticSubmission.id,
              ),
          );
        } else {
          setPendingFreshThreadSubmission(null);
        }

        throw error;
      }
    },
    [createVideoMutation, queryClient, trpc, uploadAttachmentMedia],
  );

  return {
    isPending:
      isAttachmentMediaUploadPending ||
      createVideoMutation.isPending ||
      Boolean(pendingFreshThreadSubmission),
    clearPendingFreshThreadSubmission,
    pendingFreshThreadSubmission,
    submitGeneration,
  };
}

function toCreateVideoAttachmentMediaInput(
  attachmentMedia: UploadedGenerationAttachmentMediaValue,
): CreateVideoGenerationInput["attachmentMedia"] {
  return attachmentMedia as unknown as CreateVideoGenerationInput["attachmentMedia"];
}

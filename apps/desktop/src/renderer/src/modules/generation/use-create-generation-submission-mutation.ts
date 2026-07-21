import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
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
  const createImageMutation = useMutation(
    trpc.generation.createImage.mutationOptions({}),
  );
  const clearPendingFreshThreadSubmission = useCallback(() => {
    setPendingFreshThreadSubmission(null);
  }, []);

  const submitGeneration = useCallback(
    async (draft: GenerationSubmissionDraft) => {
      if (draft.model.type !== draft.settings.modelType) {
        throw new Error("Generation model and settings types do not match");
      }

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
        const createInputBase = {
          modelId: draft.model.id,
          modelSpecId: draft.model.latestSpecId,
          prompt: draft.prompt,
          resolution: draft.settings.resolution,
          aspectRatio: draft.settings.aspectRatio,
          requestedGenerations: draft.settings.requestedGenerations,
          ...(draft.target.kind === "existing-thread"
            ? { threadId: draft.target.threadId }
            : {}),
          ...(draft.target.kind === "new-thread" && draft.target.projectId
            ? { projectId: draft.target.projectId }
            : {}),
        };
        const createdSubmission =
          draft.settings.modelType === "image"
            ? await createImageMutation.mutateAsync({
                ...createInputBase,
                attachmentMedia:
                  toCreateImageAttachmentMediaInput(attachmentMedia),
              })
            : await createVideoMutation.mutateAsync({
                ...createInputBase,
                attachmentMedia:
                  toCreateVideoAttachmentMediaInput(attachmentMedia),
                duration: draft.settings.duration,
                generateAudio: draft.settings.generateAudio,
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
            trpc.generationThread.listWithoutProject.queryOptions(undefined)
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
    [
      createImageMutation,
      createVideoMutation,
      queryClient,
      trpc,
      uploadAttachmentMedia,
    ],
  );

  return {
    isPending:
      isAttachmentMediaUploadPending ||
      createImageMutation.isPending ||
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

function toCreateImageAttachmentMediaInput(
  attachmentMedia: UploadedGenerationAttachmentMediaValue,
): CreateImageGenerationInput["attachmentMedia"] {
  return attachmentMedia as unknown as CreateImageGenerationInput["attachmentMedia"];
}

import type {
  AttachmentMediaRole,
  GenerationAttachmentMediaFieldId,
  GenerationAttachmentMediaKind,
  GenerationAttachmentMediaUploadResult,
} from "@remora/domain/generation-attachment-media/dto";
import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
  GenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { useTRPC } from "../trpc.ts";
import type { GenerationAttachmentMediaValue } from "../lib/generation/attachment-media.ts";
import type { GenerationSettingsValue } from "../lib/generation/generation-settings.ts";
import {
  appendGenerationSubmission,
  createOptimisticGenerationSubmission,
  reconcileOptimisticGenerationSubmission,
  removeGenerationSubmission,
  replaceGenerationSubmission,
} from "../lib/generation/generation-submission-cache.ts";

export type GenerationAttachmentMediaFileUploader = (input: {
  kind: GenerationAttachmentMediaKind;
  file: File;
}) => Promise<GenerationAttachmentMediaUploadResult>;

type UploadedGenerationAttachmentMediaItem = {
  id: string;
  role: AttachmentMediaRole;
};

type UploadedGenerationAttachmentMediaValue = Partial<
  Record<
    GenerationAttachmentMediaFieldId,
    UploadedGenerationAttachmentMediaItem[]
  >
>;

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

export function useCreateGenerationSubmissionMutation({
  uploadAttachmentMediaFile,
}: {
  uploadAttachmentMediaFile: GenerationAttachmentMediaFileUploader;
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [isAttachmentMediaUploadPending, setIsAttachmentMediaUploadPending] =
    useState(false);
  const [pendingFreshThreadSubmission, setPendingFreshThreadSubmission] =
    useState<GenerationThreadSubmission | null>(null);
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
              appendGenerationSubmission(
                currentSubmissions,
                optimisticSubmission,
              ),
          );
        } else {
          setPendingFreshThreadSubmission(optimisticSubmission);
        }

        setIsAttachmentMediaUploadPending(true);
        const attachmentMedia = await uploadAttachmentMedia({
          uploadAttachmentMediaFile,
          value: draft.attachmentMedia,
        });
        setIsAttachmentMediaUploadPending(false);
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
        setIsAttachmentMediaUploadPending(false);

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
      uploadAttachmentMediaFile,
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

async function uploadAttachmentMedia({
  uploadAttachmentMediaFile,
  value,
}: {
  uploadAttachmentMediaFile: GenerationAttachmentMediaFileUploader;
  value: GenerationAttachmentMediaValue;
}): Promise<UploadedGenerationAttachmentMediaValue> {
  const uploaded: UploadedGenerationAttachmentMediaValue = {};

  for (const fieldId of [
    "images",
    "videos",
    "audios",
  ] satisfies GenerationAttachmentMediaFieldId[]) {
    const items = value[fieldId];

    if (items.length === 0) {
      continue;
    }

    const uploadedItems: UploadedGenerationAttachmentMediaItem[] = [];

    for (const item of items) {
      const result = await uploadAttachmentMediaFile({
        kind: getAttachmentMediaKindForFieldId(fieldId),
        file: item.file,
      });

      uploadedItems.push({ id: result.id, role: item.role });
    }

    uploaded[fieldId] = uploadedItems;
  }

  return uploaded;
}

function getAttachmentMediaKindForFieldId(
  fieldId: GenerationAttachmentMediaFieldId,
): GenerationAttachmentMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
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

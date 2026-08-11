import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { toast } from "@remora/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import {
  createStoredGenerationAttachmentMediaValue,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import {
  restoreGenerationSettingsFromSubmission,
  type GenerationSettingsValue,
} from "../lib/generation/generation-settings.ts";
import { useTRPC } from "../trpc.ts";

export type EditedGenerationSubmissionDraft = {
  attachmentMedia: GenerationAttachmentMediaValue;
  model: PublishedGenerationModelSummary;
  prompt: string;
  settings: GenerationSettingsValue;
};

export function useEditGenerationSubmission({
  models,
  onApply,
}: {
  models: PublishedGenerationModelSummary[];
  onApply: (draft: EditedGenerationSubmissionDraft) => void;
}) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const editGenerationSubmission = useCallback(
    async (submission: GenerationThreadSubmission) => {
      const model = models.find(
        (candidate) =>
          candidate.id === submission.modelId &&
          candidate.type === submission.modelType,
      );

      if (!model) {
        toast.error("This generation model is no longer available.");
        return;
      }

      const restoredSettings = restoreGenerationSettingsFromSubmission(
        model,
        submission,
      );

      if (!restoredSettings) {
        toast.error("This generation's settings could not be restored.");
        return;
      }

      try {
        const attachmentMedia = await queryClient.fetchQuery(
          trpc.generation.listAttachmentMediaFromSubmission.queryOptions(
            { submissionId: submission.id },
            { meta: { suppressErrorToast: true } },
          ),
        );

        onApply({
          attachmentMedia:
            createStoredGenerationAttachmentMediaValue(attachmentMedia),
          model,
          prompt: submission.submittedInput.prompt,
          settings: restoredSettings.settings,
        });

        if (restoredSettings.wasAdapted) {
          toast.info(
            "Some settings were updated to match the latest model version.",
          );
        }
      } catch {
        toast.error("This generation's references could not be loaded.");
      }
    },
    [models, onApply, queryClient, trpc],
  );

  return { editGenerationSubmission };
}

import type {
  EstimateGenerationCostInput,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";

import type { GenerationSettingsValue } from "../generation/index.ts";
import type { GenerationAttachmentMediaValue } from "../generation/attachment-media.ts";

export function toEstimateGenerationCostInput({
  attachmentMediaValue,
  generationSettings,
  selectedModel,
  videoDurationSecByFile,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings: GenerationSettingsValue;
  selectedModel: PublishedGenerationModelSummary;
  videoDurationSecByFile: ReadonlyMap<File, number | null>;
}): EstimateGenerationCostInput {
  return {
    modelId: selectedModel.id,
    modelSpecId: selectedModel.latestSpecId,
    aspectRatio: generationSettings.aspectRatio,
    resolution: generationSettings.resolution,
    duration: generationSettings.duration,
    generateAudio: generationSettings.generateAudio,
    requestedGenerations: generationSettings.requestedGenerations,
    attachmentMedia: toEstimateGenerationCostAttachmentMediaInput({
      attachmentMediaValue,
      videoDurationSecByFile,
    }),
  };
}

function toEstimateGenerationCostAttachmentMediaInput({
  attachmentMediaValue,
  videoDurationSecByFile,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  videoDurationSecByFile: ReadonlyMap<File, number | null>;
}): EstimateGenerationCostInput["attachmentMedia"] {
  const input: NonNullable<EstimateGenerationCostInput["attachmentMedia"]> = {};

  if (attachmentMediaValue.images.length > 0) {
    input.images = attachmentMediaValue.images.map((item) => ({
      role: item.role,
    }));
  }

  if (attachmentMediaValue.videos.length > 0) {
    input.videos = attachmentMediaValue.videos.map((item) => {
      const durationSec = videoDurationSecByFile.get(item.file);

      return {
        role: item.role,
        ...(durationSec !== undefined && durationSec !== null
          ? { durationSec }
          : {}),
      };
    });
  }

  if (attachmentMediaValue.audios.length > 0) {
    input.audios = attachmentMediaValue.audios.map((item) => ({
      role: item.role,
    }));
  }

  return input;
}

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { EstimateGenerationCostInput } from "@remora/domain/generation-pricing/dto";

import type { GenerationSettingsValue } from "../generation/generation-settings.ts";
import type {
  GenerationAttachmentMediaItem,
  GenerationAttachmentMediaValue,
} from "../generation/attachment-media.ts";

export function toEstimateGenerationCostInput({
  attachmentMediaValue,
  generationSettings,
  selectedModel,
  videoDurationSecByItem,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings: GenerationSettingsValue;
  selectedModel: PublishedGenerationModelSummary;
  videoDurationSecByItem: ReadonlyMap<
    GenerationAttachmentMediaItem,
    number | null
  >;
}): EstimateGenerationCostInput {
  const attachmentMedia = toEstimateGenerationCostAttachmentMediaInput({
    attachmentMediaValue,
    videoDurationSecByItem,
  });
  if (generationSettings.modelType === "model3d") {
    return {
      modelType: "model3d",
      modelId: selectedModel.id,
      modelSpecId: selectedModel.latestSpecId,
      requestedGenerations: generationSettings.requestedGenerations,
      textureLevel: generationSettings.textureLevel,
      geometryQuality: generationSettings.geometryQuality,
      attachmentMedia,
    };
  }

  const estimateInputBase = {
    modelId: selectedModel.id,
    modelSpecId: selectedModel.latestSpecId,
    aspectRatio: generationSettings.aspectRatio,
    resolution: generationSettings.resolution,
    requestedGenerations: generationSettings.requestedGenerations,
    attachmentMedia,
  };

  if (generationSettings.modelType === "image") {
    return {
      ...estimateInputBase,
      modelType: "image",
    };
  }

  return {
    ...estimateInputBase,
    modelType: "video",
    duration: generationSettings.duration,
    generateAudio: generationSettings.generateAudio,
    draft: generationSettings.draft ?? false,
  };
}

function toEstimateGenerationCostAttachmentMediaInput({
  attachmentMediaValue,
  videoDurationSecByItem,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  videoDurationSecByItem: ReadonlyMap<
    GenerationAttachmentMediaItem,
    number | null
  >;
}): EstimateGenerationCostInput["attachmentMedia"] {
  const input: NonNullable<EstimateGenerationCostInput["attachmentMedia"]> = {};

  if (attachmentMediaValue.images.length > 0) {
    input.images = attachmentMediaValue.images.map((item) => ({
      role: item.role,
    }));
  }

  if (attachmentMediaValue.videos.length > 0) {
    input.videos = attachmentMediaValue.videos.map((item) => {
      const durationSec = videoDurationSecByItem.get(item);

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

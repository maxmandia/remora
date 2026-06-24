import type {
  EstimateGenerationCostInput,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";

import type { GenerationSettingsValue } from "../generation/index.ts";
import {
  attachmentMediaFieldIds,
  type GenerationAttachmentMediaValue,
} from "../generation/attachment-media.ts";

export function toEstimateGenerationCostInput({
  attachmentMediaValue,
  generationSettings,
  selectedModel,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings: GenerationSettingsValue;
  selectedModel: PublishedGenerationModelSummary;
}): EstimateGenerationCostInput {
  return {
    modelId: selectedModel.id,
    modelSpecId: selectedModel.latestSpecId,
    aspectRatio: generationSettings.aspectRatio,
    resolution: generationSettings.resolution,
    duration: generationSettings.duration,
    generateAudio: generationSettings.generateAudio,
    requestedGenerations: generationSettings.requestedGenerations,
    attachmentMedia:
      toEstimateGenerationCostAttachmentMediaInput(attachmentMediaValue),
  };
}

function toEstimateGenerationCostAttachmentMediaInput(
  attachmentMediaValue: GenerationAttachmentMediaValue,
): EstimateGenerationCostInput["attachmentMedia"] {
  const input: NonNullable<EstimateGenerationCostInput["attachmentMedia"]> = {};

  for (const fieldId of attachmentMediaFieldIds) {
    const items = attachmentMediaValue[fieldId];

    if (items.length > 0) {
      input[fieldId] = items.map((item) => ({ role: item.role }));
    }
  }

  return input;
}

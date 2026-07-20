import type { GenerationAttachmentMediaInputItem } from "../generation-attachment-media/dto.ts";
import type { CreateVideoGenerationInput } from "../generation-submission/dto.ts";

type EstimateGenerationCostAttachmentMediaItem = Pick<
  GenerationAttachmentMediaInputItem,
  "role"
>;

export type EstimateGenerationCostAttachmentMediaInput = {
  images?: EstimateGenerationCostAttachmentMediaItem[];
  videos?: (EstimateGenerationCostAttachmentMediaItem & {
    durationSec?: number;
  })[];
  audios?: EstimateGenerationCostAttachmentMediaItem[];
};

export type EstimateGenerationCostInput = {
  modelId: string;
  modelSpecId: string;
  requestedGenerations: number;
  attachmentMedia?: EstimateGenerationCostAttachmentMediaInput;
} & Pick<
  CreateVideoGenerationInput,
  "aspectRatio" | "duration" | "generateAudio" | "resolution"
>;

export type GenerationCostEstimate = {
  estimatedCostUsdMicros: number;
  currencyCode: "USD";
};

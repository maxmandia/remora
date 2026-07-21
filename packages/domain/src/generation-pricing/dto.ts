import type { GenerationAttachmentMediaInputItem } from "../generation-attachment-media/dto.ts";
import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
} from "../generation-submission/dto.ts";

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

type EstimateGenerationCostInputBase = {
  modelId: string;
  modelSpecId: string;
  requestedGenerations: number;
  attachmentMedia?: EstimateGenerationCostAttachmentMediaInput;
};

export type EstimateVideoGenerationCostInput =
  EstimateGenerationCostInputBase & { modelType: "video" } & Pick<
      CreateVideoGenerationInput,
      "aspectRatio" | "duration" | "generateAudio" | "resolution"
    >;

export type EstimateImageGenerationCostInput =
  EstimateGenerationCostInputBase & { modelType: "image" } & Pick<
      CreateImageGenerationInput,
      "aspectRatio" | "resolution"
    >;

export type EstimateGenerationCostInput =
  | EstimateVideoGenerationCostInput
  | EstimateImageGenerationCostInput;

export type GenerationCostEstimate = {
  estimatedCostUsdMicros: number;
  currencyCode: "USD";
};

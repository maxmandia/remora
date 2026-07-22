import type { GenerationAttachmentMediaInputItem } from "../generation-attachment-media/dto.ts";
import type { GenerationModelType } from "../generation-model/dto.ts";
import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
} from "../generation-submission/dto.ts";

export const generationModelRateComponents = [
  "output_video",
  "input_video",
  "input_image",
  "provider_video_tokens",
  "output_image",
] as const;

export type GenerationModelRateComponent =
  (typeof generationModelRateComponents)[number];

export const generationModelRateQuantityUnits = [
  "second",
  "image",
  "token",
] as const;

export type GenerationModelRateQuantityUnit =
  (typeof generationModelRateQuantityUnits)[number];

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

export type PublicGenerationModelRateConditions = {
  outputResolution?: string | string[];
  inputVideoResolution?: string | string[];
  inputIncludesVideo?: boolean;
  nativeAudio?: boolean;
};

export type PublicGenerationPricingCatalog = {
  currencyCode: "USD";
  surchargeBasisPoints: number;
  models: Array<{
    id: string;
    providerId: string;
    providerName: string;
    displayName: string;
    modelType: GenerationModelType;
    modelSpecId: string;
    modelSpecVersion: number;
    rates: Array<{
      id: string;
      component: GenerationModelRateComponent;
      quantityUnit: GenerationModelRateQuantityUnit;
      unitQuantity: number;
      upstreamUnitPriceUsdMicros: number;
      remoraFeeUnitPriceUsdMicros: number;
      customerUnitPriceUsdMicros: number;
      conditions: PublicGenerationModelRateConditions;
    }>;
  }>;
};

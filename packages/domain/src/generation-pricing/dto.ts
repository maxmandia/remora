import type { GenerationAttachmentMediaInputItem } from "../generation-attachment-media/dto.ts";
import type { GenerationModelType } from "../generation-model/dto.ts";
import type {
  CreateImageGenerationInput,
  CreateModel3dGenerationInput,
  CreateVideoGenerationInput,
} from "../generation-submission/dto.ts";

export const generationModelRateComponents = [
  "input_text",
  "output_video",
  "input_video",
  "input_image",
  "provider_video_tokens",
  "output_image",
  "output_model3d",
] as const;

export type GenerationModelRateComponent =
  (typeof generationModelRateComponents)[number];

export const generationModelRateQuantityUnits = [
  "second",
  "image",
  "token",
  "model",
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
  EstimateGenerationCostInputBase & {
    modelType: "video";
    draft?: boolean;
  } & Pick<
      CreateVideoGenerationInput,
      "aspectRatio" | "duration" | "generateAudio" | "resolution"
    >;

export type EstimateImageGenerationCostInput =
  EstimateGenerationCostInputBase & {
    modelType: "image";
    prompt?: string;
  } & Pick<CreateImageGenerationInput, "aspectRatio" | "resolution">;

export type EstimateModel3dGenerationCostInput =
  EstimateGenerationCostInputBase & {
    modelType: "model3d";
  } & Pick<CreateModel3dGenerationInput, "textureLevel" | "geometryQuality">;

export type EstimateGenerationCostInput =
  | EstimateVideoGenerationCostInput
  | EstimateImageGenerationCostInput
  | EstimateModel3dGenerationCostInput;

export type GenerationCostEstimate = {
  estimatedCostUsdMicros: number;
  currencyCode: "USD";
};

export type PublicGenerationModelRateConditions = {
  outputResolution?: string | string[];
  inputVideoResolution?: string | string[];
  inputIncludesVideo?: boolean;
  nativeAudio?: boolean;
  draft?: boolean;
  textureLevel?: string | string[];
  geometryQuality?: string | string[];
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

import type { GenerationAttachmentMediaInputItem } from "../generation-attachment-media/generation-attachment-media.types.ts";
import type { CreateVideoGenerationInput } from "../generation/generation.types.ts";

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

export const generationJobFinalCostBases = [
  "provider_reported_cost",
  "provider_reported_units",
  "provider_usage",
  "pricing_formula",
  "not_charged",
] as const;

export type GenerationJobFinalCostBasis =
  (typeof generationJobFinalCostBases)[number];

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

export const generationModelRateQuantitySources = [
  "output_duration_seconds",
  "input_video_duration_seconds",
  "input_image_count",
  "seedance_estimated_video_tokens",
  "output_image_count",
] as const;

export type GenerationModelRateQuantitySource =
  (typeof generationModelRateQuantitySources)[number];

export const generationModelRateFinalQuantitySources = [
  "provider_completion_tokens",
] as const;

export type GenerationModelRateFinalQuantitySource =
  (typeof generationModelRateFinalQuantitySources)[number];

export type GenerationCostLineItemJobFactsV1 = {
  outputResolution: string;
  outputAspectRatio: string;
  outputDurationSeconds: number;
  nativeAudio: boolean;
  voiceControl: boolean;
  inputIncludesVideo: boolean;
  inputImageCount: number;
  requestedGenerations: number;
};

export type GenerationCostLineItemJobFacts =
  GenerationCostLineItemJobFactsV1 & {
    inputVideoDurationSeconds: number;
  };

export type GenerationCostLineItem = {
  rateId: string;
  component: GenerationModelRateComponent;
  quantitySource: GenerationModelRateQuantitySource;
  finalQuantitySource: GenerationModelRateFinalQuantitySource | null;
  quantity: number;
  quantityUnit: GenerationModelRateQuantityUnit;
  unitQuantity: number;
  unitPriceUsdMicros: number;
  estimatedCostUsdMicros: number;
};

export type GenerationPricingPolicy = {
  id: string;
  surchargeBasisPoints: number;
};

type GenerationJobEstimatedCostSnapshotData<JobFacts> = {
  jobFacts: JobFacts;
  lineItems: GenerationCostLineItem[];
  baseCostUsdMicros: number;
  surcharge: {
    pricingPolicyId: string;
    surchargeBasisPoints: number;
    surchargeUsdMicros: number;
  };
  estimatedCostUsdMicros: number;
};

export type GenerationJobEstimatedCostSnapshotV1 = {
  schemaVersion: 1;
} & GenerationJobEstimatedCostSnapshotData<GenerationCostLineItemJobFactsV1>;

export type GenerationJobEstimatedCostSnapshotV2 = {
  schemaVersion: 2;
} & GenerationJobEstimatedCostSnapshotData<GenerationCostLineItemJobFacts>;

export type GenerationJobEstimatedCostSnapshot =
  | GenerationJobEstimatedCostSnapshotV1
  | GenerationJobEstimatedCostSnapshotV2;

export type BytePlusGenerationJobProviderCostSnapshot = {
  schemaVersion: 1;
  source: "provider_usage";
  provider: "byteplus";
  providerTaskId: string;
  providerModelId: string | null;
  usage: {
    completionTokens: number;
    totalTokens: number | null;
  };
  lineItem: {
    rateId: string;
    component: GenerationModelRateComponent;
    finalQuantitySource: "provider_completion_tokens";
    quantityUnit: GenerationModelRateQuantityUnit;
    unitQuantity: number;
    unitPriceUsdMicros: number;
    amountUsdMicros: number;
  };
  amountUsdMicros: number;
};

export type GenerationJobPricingFormulaProviderCostLineItem = Omit<
  GenerationCostLineItem,
  "estimatedCostUsdMicros" | "finalQuantitySource"
> & {
  finalQuantitySource: null;
  amountUsdMicros: number;
};

export type KlingGenerationJobProviderCostSnapshot = {
  schemaVersion: 1;
  source: "pricing_formula";
  provider: "kling";
  providerTaskId: string;
  providerModelId: string | null;
  lineItems: GenerationJobPricingFormulaProviderCostLineItem[];
  amountUsdMicros: number;
};

export type GenerationJobProviderCostSnapshot =
  | BytePlusGenerationJobProviderCostSnapshot
  | KlingGenerationJobProviderCostSnapshot;

export type GenerationJobCost = GenerationCostEstimate & {
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
};

export type GenerationJobFinalCost = {
  finalCostUsdMicros: number;
  finalCostBasis: GenerationJobFinalCostBasis;
};

export type GenerationJobProviderCost = {
  providerCostUsdMicros: number;
  providerCostSnapshot: GenerationJobProviderCostSnapshot;
};

export type CreateGenerationJobCostInput = {
  jobId: string;
  estimatedCostUsdMicros: number;
  currencyCode: "USD";
  estimatedCostSnapshot: GenerationJobEstimatedCostSnapshot;
};

export type GenerationModelRateConditions = {
  outputResolution?: string | string[];
  inputVideoResolution?: string | string[];
  inputIncludesVideo?: boolean;
  nativeAudio?: boolean;
  voiceControl?: boolean;
};

export class GenerationModelRatesNotFoundError extends Error {
  readonly code = "GENERATION_MODEL_RATES_NOT_FOUND";

  constructor(modelId: string) {
    super(`Generation model rates were not found: ${modelId}`);
    this.name = "GenerationModelRatesNotFoundError";
  }
}

export class GenerationPricingPolicyNotFoundError extends Error {
  readonly code = "GENERATION_PRICING_POLICY_NOT_FOUND";

  constructor() {
    super("Generation pricing policy was not found");
    this.name = "GenerationPricingPolicyNotFoundError";
  }
}

export class GenerationModelRateConfigurationError extends Error {
  readonly code = "GENERATION_MODEL_RATE_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GenerationModelRateConfigurationError";
  }
}

export class GenerationJobFinalCostCalculationError extends Error {
  readonly code = "GENERATION_JOB_FINAL_COST_CALCULATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GenerationJobFinalCostCalculationError";
  }
}

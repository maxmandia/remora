import {
  generationModelRateComponents,
  generationModelRateQuantityUnits,
  type GenerationCostEstimate,
  type GenerationModelRateComponent,
  type GenerationModelRateQuantityUnit,
} from "@remora/domain/generation-pricing/dto";
export type {
  EstimateGenerationCostAttachmentMediaInput,
  EstimateGenerationCostInput,
  EstimateImageGenerationCostInput,
  EstimateVideoGenerationCostInput,
  GenerationCostEstimate,
  GenerationModelRateComponent,
  GenerationModelRateQuantityUnit,
} from "@remora/domain/generation-pricing/dto";
export { generationModelRateComponents, generationModelRateQuantityUnits };

export const generationJobFinalCostBases = [
  "provider_reported_cost",
  "provider_reported_units",
  "provider_usage",
  "pricing_formula",
  "not_charged",
] as const;

export type GenerationJobFinalCostBasis =
  (typeof generationJobFinalCostBases)[number];

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

export type ImageGenerationCostLineItemJobFacts = {
  modelType: "image";
  outputResolution: string;
  outputAspectRatio: string;
  inputImageCount: number;
  requestedGenerations: number;
};

export type VideoGenerationCostLineItemJobFacts =
  GenerationCostLineItemJobFacts & {
    modelType: "video";
  };

export type ModalityGenerationCostLineItemJobFacts =
  | VideoGenerationCostLineItemJobFacts
  | ImageGenerationCostLineItemJobFacts;

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

export type PublishedModelPricingRecord = {
  id: string;
  providerId: string;
  providerName: string;
  displayName: string;
  modelType: "image" | "video";
  modelSpecId: string;
  modelSpecVersion: number;
  rates: Array<{
    id: string;
    component: GenerationModelRateComponent;
    quantityUnit: GenerationModelRateQuantityUnit;
    unitQuantity: number;
    unitPriceUsdMicros: number;
    conditions: GenerationModelRateConditions;
  }>;
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

export type GenerationJobEstimatedCostSnapshotV3 = {
  schemaVersion: 3;
} & GenerationJobEstimatedCostSnapshotData<ModalityGenerationCostLineItemJobFacts>;

export type GenerationJobEstimatedCostSnapshot =
  | GenerationJobEstimatedCostSnapshotV1
  | GenerationJobEstimatedCostSnapshotV2
  | GenerationJobEstimatedCostSnapshotV3;

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

export type GoogleGenerationJobProviderCostSnapshot = {
  schemaVersion: 1;
  source: "provider_usage";
  provider: "google";
  providerTaskId: string;
  providerModelId: string | null;
  outputResolution: string;
  incompleteUsage: boolean;
  usage: {
    inputTokens: number | null;
    outputTextTokens: number | null;
    outputImageTokens: number | null;
    thoughtTokens: number | null;
    totalTokens: number | null;
  };
  lineItems: Array<{
    kind:
      | "input_tokens"
      | "output_text_and_thought_tokens"
      | "output_image_tokens"
      | "output_image_fallback";
    quantity: number;
    unitQuantity: number;
    unitPriceUsdMicros: number;
    amountUsdMicros: number;
  }>;
  amountUsdMicros: number;
};

export type GenerationJobProviderCostSnapshot =
  | BytePlusGenerationJobProviderCostSnapshot
  | KlingGenerationJobProviderCostSnapshot
  | GoogleGenerationJobProviderCostSnapshot;

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

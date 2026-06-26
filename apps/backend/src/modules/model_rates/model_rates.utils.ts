import {
  GenerationModelRateConfigurationError,
  generationModelRateQuantitySources,
  type EstimateGenerationCostInput,
  type GenerationCostLineItem,
  type GenerationCostLineItemJobFacts,
  type GenerationJobCost,
  type GenerationModelRateConditions,
  type GenerationModelRateQuantitySource,
  type GenerationPricingPolicy,
} from "./model_rates.types.ts";
import type { generationModelRate } from "./schema/table.ts";

type GenerationModelRateRecord = typeof generationModelRate.$inferSelect;

export type GenerationCostQuantityResolver = (
  jobFacts: GenerationCostLineItemJobFacts,
) => number;

const adaptiveDurationEstimateSeconds = 5;
const seedanceEstimatedFrameRate = 24;
const seedanceAdaptiveAspectRatioEstimate = "16:9";
const seedanceResolutionShortSidePx = {
  "480p": 480,
  "720p": 720,
  "1080p": 1080,
  "4k": 2160,
} as const;

const generationModelRateConditionKeys = [
  "outputResolution",
  "inputVideoResolution",
  "inputIncludesVideo",
  "nativeAudio",
  "voiceControl",
] as const satisfies readonly (keyof GenerationModelRateConditions)[];

type GenerationModelRateConditionKey =
  (typeof generationModelRateConditionKeys)[number];

const quantityResolvers = {
  output_duration_seconds: (jobFacts) => jobFacts.outputDurationSeconds,
  input_video_duration_seconds: () => 0,
  input_image_count: (jobFacts) => jobFacts.inputImageCount,
  seedance_estimated_video_tokens: (jobFacts) => {
    const dimensions = resolveSeedanceOutputDimensions(jobFacts);
    const inputVideoDurationSeconds = 0;

    return (
      ((inputVideoDurationSeconds + jobFacts.outputDurationSeconds) *
        dimensions.widthPx *
        dimensions.heightPx *
        seedanceEstimatedFrameRate) /
      1024
    );
  },
} satisfies Record<
  GenerationModelRateQuantitySource,
  GenerationCostQuantityResolver
>;

export function buildJobFactsForLineItems(
  input: EstimateGenerationCostInput,
): GenerationCostLineItemJobFacts {
  return {
    outputResolution: input.resolution,
    outputAspectRatio: input.aspectRatio,
    outputDurationSeconds:
      input.duration === -1 ? adaptiveDurationEstimateSeconds : input.duration,
    nativeAudio: input.generateAudio,
    voiceControl: false,
    inputIncludesVideo: (input.attachmentMedia?.videos?.length ?? 0) > 0,
    inputImageCount: input.attachmentMedia?.images?.length ?? 0,
    requestedGenerations: input.requestedGenerations,
  };
}

export function buildGenerationJobCostEstimate({
  input,
  pricingPolicy,
  rates,
}: {
  input: EstimateGenerationCostInput;
  pricingPolicy: GenerationPricingPolicy;
  rates: readonly GenerationModelRateRecord[];
}): GenerationJobCost {
  const jobFacts = buildJobFactsForLineItems({
    ...input,
    requestedGenerations: 1,
  });
  const lineItems = buildGenerationCostLineItems({
    rates,
    jobFacts,
  });
  const baseCostUsdMicros = lineItems.reduce(
    (totalCostUsdMicros, lineItem) =>
      totalCostUsdMicros + lineItem.estimatedCostUsdMicros,
    0,
  );
  const surchargeUsdMicros = calculateSurchargeUsdMicros({
    baseCostUsdMicros,
    surchargeBasisPoints: pricingPolicy.surchargeBasisPoints,
  });
  const estimatedCostUsdMicros = baseCostUsdMicros + surchargeUsdMicros;

  return {
    estimatedCostUsdMicros,
    currencyCode: "USD",
    estimatedCostSnapshot: {
      schemaVersion: 1,
      jobFacts,
      lineItems,
      baseCostUsdMicros,
      surcharge: {
        pricingPolicyId: pricingPolicy.id,
        surchargeBasisPoints: pricingPolicy.surchargeBasisPoints,
        surchargeUsdMicros,
      },
      estimatedCostUsdMicros,
    },
  };
}

export function calculateSurchargeUsdMicros({
  baseCostUsdMicros,
  surchargeBasisPoints,
}: {
  baseCostUsdMicros: number;
  surchargeBasisPoints: number;
}) {
  if (baseCostUsdMicros === 0) {
    return 0;
  }

  return Math.ceil((baseCostUsdMicros * surchargeBasisPoints) / 10_000);
}

export function buildGenerationCostLineItems({
  jobFacts,
  rates,
}: {
  jobFacts: GenerationCostLineItemJobFacts;
  rates: readonly GenerationModelRateRecord[];
}): GenerationCostLineItem[] {
  return rates.flatMap((rate): GenerationCostLineItem[] => {
    if (!matchesRateConditions(rate.conditions, jobFacts)) {
      return [];
    }

    const { quantity, quantitySource } = resolveRateQuantity({
      jobFacts,
      rate,
    });
    const totalQuantity = quantity * jobFacts.requestedGenerations;

    if (totalQuantity <= 0) {
      return [];
    }

    return [
      {
        rateId: rate.id,
        component: rate.component,
        quantitySource,
        finalQuantitySource: rate.finalQuantitySource,
        quantity: totalQuantity,
        quantityUnit: rate.quantityUnit,
        unitQuantity: rate.unitQuantity,
        unitPriceUsdMicros: rate.unitPriceUsdMicros,
        estimatedCostUsdMicros: Math.ceil(
          (totalQuantity * rate.unitPriceUsdMicros) / rate.unitQuantity,
        ),
      },
    ];
  });
}

function matchesRateConditions(
  conditions: GenerationModelRateConditions,
  jobFacts: GenerationCostLineItemJobFacts,
) {
  for (const [key, conditionValue] of Object.entries(conditions)) {
    // Making sure the key is a key we support
    const conditionKey = toGenerationModelRateConditionKey(key);

    if (
      !matchesConditionValue(
        conditionValue,
        getConditionFact(conditionKey, jobFacts),
      )
    ) {
      return false;
    }
  }

  return true;
}

function matchesConditionValue(conditionValue: unknown, factValue: unknown) {
  if (Array.isArray(conditionValue)) {
    return conditionValue.some((candidate) => candidate === factValue);
  }

  if (
    typeof conditionValue === "boolean" ||
    typeof conditionValue === "string"
  ) {
    return conditionValue === factValue;
  }

  throw new GenerationModelRateConfigurationError(
    `Unsupported generation model rate condition value: ${String(
      conditionValue,
    )}`,
  );
}

function getConditionFact(
  conditionKey: GenerationModelRateConditionKey,
  jobFacts: GenerationCostLineItemJobFacts,
) {
  switch (conditionKey) {
    case "outputResolution":
      return jobFacts.outputResolution;
    case "inputVideoResolution":
      return null;
    case "inputIncludesVideo":
      return jobFacts.inputIncludesVideo;
    case "nativeAudio":
      return jobFacts.nativeAudio;
    case "voiceControl":
      return jobFacts.voiceControl;
  }
}

function resolveRateQuantity({
  jobFacts,
  rate,
}: {
  jobFacts: GenerationCostLineItemJobFacts;
  rate: GenerationModelRateRecord;
}) {
  const quantitySource = toGenerationModelRateQuantitySource(
    rate.quantitySource,
  );

  return {
    quantitySource,
    quantity: quantityResolvers[quantitySource](jobFacts),
  };
}

function toGenerationModelRateQuantitySource(
  quantitySource: string,
): GenerationModelRateQuantitySource {
  if (
    generationModelRateQuantitySources.includes(
      quantitySource as GenerationModelRateQuantitySource,
    )
  ) {
    return quantitySource as GenerationModelRateQuantitySource;
  }

  throw new GenerationModelRateConfigurationError(
    `Unsupported generation model rate quantity source: ${quantitySource}`,
  );
}

function toGenerationModelRateConditionKey(
  key: string,
): GenerationModelRateConditionKey {
  if (
    generationModelRateConditionKeys.includes(
      key as GenerationModelRateConditionKey,
    )
  ) {
    return key as GenerationModelRateConditionKey;
  }

  throw new GenerationModelRateConfigurationError(
    `Unsupported generation model rate condition: ${key}`,
  );
}

function resolveSeedanceOutputDimensions(
  jobFacts: GenerationCostLineItemJobFacts,
) {
  const shortSidePx = resolveSeedanceResolutionShortSidePx(
    jobFacts.outputResolution,
  );
  const aspectRatio = parseSeedanceAspectRatio(jobFacts.outputAspectRatio);

  if (aspectRatio >= 1) {
    return {
      widthPx: Math.round(shortSidePx * aspectRatio),
      heightPx: shortSidePx,
    };
  }

  return {
    widthPx: shortSidePx,
    heightPx: Math.round(shortSidePx / aspectRatio),
  };
}

function resolveSeedanceResolutionShortSidePx(resolution: string) {
  const normalizedResolution = resolution.toLowerCase();
  const shortSidePx =
    seedanceResolutionShortSidePx[
      normalizedResolution as keyof typeof seedanceResolutionShortSidePx
    ];

  if (shortSidePx) {
    return shortSidePx;
  }

  throw new GenerationModelRateConfigurationError(
    `Unsupported Seedance output resolution for cost estimation: ${resolution}`,
  );
}

function parseSeedanceAspectRatio(aspectRatio: string) {
  const normalizedAspectRatio =
    aspectRatio === "adaptive"
      ? seedanceAdaptiveAspectRatioEstimate
      : aspectRatio;
  const [widthRatioText, heightRatioText] = normalizedAspectRatio.split(":");
  const widthRatio = Number(widthRatioText);
  const heightRatio = Number(heightRatioText);

  if (
    !Number.isFinite(widthRatio) ||
    !Number.isFinite(heightRatio) ||
    widthRatio <= 0 ||
    heightRatio <= 0
  ) {
    throw new GenerationModelRateConfigurationError(
      `Unsupported Seedance aspect ratio for cost estimation: ${aspectRatio}`,
    );
  }

  return widthRatio / heightRatio;
}

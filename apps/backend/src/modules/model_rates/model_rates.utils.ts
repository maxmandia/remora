import {
  GenerationModelRateConfigurationError,
  generationModelRateQuantitySources,
  type EstimateGenerationCostInput,
  type GenerationCostLineItem,
  type ModalityGenerationCostLineItemJobFacts,
  type GenerationJobCost,
  type GenerationModelRateConditions,
  type GenerationModelRateQuantitySource,
  type GenerationPricingPolicy,
} from "./model_rates.types.ts";
import type { generationModelRate } from "./schema/table.ts";

type GenerationModelRateRecord = typeof generationModelRate.$inferSelect;

export type GenerationCostQuantityResolver = (
  jobFacts: ModalityGenerationCostLineItemJobFacts,
) => number;

const adaptiveDurationEstimateSeconds = 5;
const seedanceEstimatedFrameRate = 24;
// BytePlus bills video inputs for at least four seconds.
// https://docs.byteplus.com/en/docs/ModelArk/1544106
const seedanceMinimumInputVideoDurationSeconds = 4;
const seedanceMissingInputVideoDurationEstimateSeconds = 15;
// These are provider output dimensions, not nominal short-side dimensions.
// https://docs.byteplus.com/en/docs/ModelArk/1520757
const seedanceOutputDimensions = {
  "480p": {
    "16:9": { widthPx: 864, heightPx: 496 },
    "4:3": { widthPx: 752, heightPx: 560 },
    "1:1": { widthPx: 640, heightPx: 640 },
    "3:4": { widthPx: 560, heightPx: 752 },
    "9:16": { widthPx: 496, heightPx: 864 },
    "21:9": { widthPx: 992, heightPx: 432 },
  },
  "720p": {
    "16:9": { widthPx: 1280, heightPx: 720 },
    "4:3": { widthPx: 1112, heightPx: 834 },
    "1:1": { widthPx: 960, heightPx: 960 },
    "3:4": { widthPx: 834, heightPx: 1112 },
    "9:16": { widthPx: 720, heightPx: 1280 },
    "21:9": { widthPx: 1470, heightPx: 630 },
  },
  "1080p": {
    "16:9": { widthPx: 1920, heightPx: 1080 },
    "4:3": { widthPx: 1664, heightPx: 1248 },
    "1:1": { widthPx: 1440, heightPx: 1440 },
    "3:4": { widthPx: 1248, heightPx: 1664 },
    "9:16": { widthPx: 1080, heightPx: 1920 },
    "21:9": { widthPx: 2206, heightPx: 946 },
  },
  "4k": {
    "16:9": { widthPx: 3840, heightPx: 2160 },
    "4:3": { widthPx: 3326, heightPx: 2494 },
    "1:1": { widthPx: 2880, heightPx: 2880 },
    "3:4": { widthPx: 2494, heightPx: 3326 },
    "9:16": { widthPx: 2160, heightPx: 3840 },
    "21:9": { widthPx: 4398, heightPx: 1886 },
  },
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
  output_duration_seconds: (jobFacts) =>
    assertVideoJobFacts(jobFacts).outputDurationSeconds,
  input_video_duration_seconds: (jobFacts) =>
    assertVideoJobFacts(jobFacts).inputVideoDurationSeconds,
  input_image_count: (jobFacts) => jobFacts.inputImageCount,
  output_image_count: () => 1,
  seedance_estimated_video_tokens: (jobFacts) => {
    const videoJobFacts = assertVideoJobFacts(jobFacts);
    const dimensions = resolveSeedanceOutputDimensions(videoJobFacts);
    const inputVideoDurationSeconds = videoJobFacts.inputIncludesVideo
      ? Math.max(
          videoJobFacts.inputVideoDurationSeconds,
          seedanceMinimumInputVideoDurationSeconds,
        )
      : 0;

    return (
      ((inputVideoDurationSeconds + videoJobFacts.outputDurationSeconds) *
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
): ModalityGenerationCostLineItemJobFacts {
  if (input.modelType === "image") {
    return {
      modelType: "image",
      outputResolution: input.resolution,
      outputAspectRatio: input.aspectRatio,
      inputImageCount: input.attachmentMedia?.images?.length ?? 0,
      requestedGenerations: input.requestedGenerations,
    };
  }

  const videos = input.attachmentMedia?.videos ?? [];

  return {
    modelType: "video",
    outputResolution: input.resolution,
    outputAspectRatio: input.aspectRatio,
    outputDurationSeconds:
      input.duration === -1 ? adaptiveDurationEstimateSeconds : input.duration,
    nativeAudio: input.generateAudio,
    voiceControl: false,
    inputIncludesVideo: videos.length > 0,
    inputVideoDurationSeconds: resolveInputVideoDurationSeconds(videos),
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

  if (lineItems.length === 0) {
    throw new GenerationModelRateConfigurationError(
      `No generation model rate matched ${input.modelSpecId}`,
    );
  }
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

  const snapshotBase = {
    lineItems,
    baseCostUsdMicros,
    surcharge: {
      pricingPolicyId: pricingPolicy.id,
      surchargeBasisPoints: pricingPolicy.surchargeBasisPoints,
      surchargeUsdMicros,
    },
    estimatedCostUsdMicros,
  };

  const estimatedCostSnapshot =
    jobFacts.modelType === "video"
      ? (() => {
          const { modelType: _modelType, ...videoJobFacts } = jobFacts;

          return {
            schemaVersion: 2 as const,
            jobFacts: videoJobFacts,
            ...snapshotBase,
          };
        })()
      : {
          schemaVersion: 3 as const,
          jobFacts,
          ...snapshotBase,
        };

  return {
    estimatedCostUsdMicros,
    currencyCode: "USD",
    estimatedCostSnapshot,
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
  jobFacts: ModalityGenerationCostLineItemJobFacts;
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
  jobFacts: ModalityGenerationCostLineItemJobFacts,
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
  jobFacts: ModalityGenerationCostLineItemJobFacts,
) {
  switch (conditionKey) {
    case "outputResolution":
      return jobFacts.outputResolution;
    case "inputVideoResolution":
      return null;
    case "inputIncludesVideo":
      return jobFacts.modelType === "video"
        ? jobFacts.inputIncludesVideo
        : false;
    case "nativeAudio":
      return jobFacts.modelType === "video" ? jobFacts.nativeAudio : false;
    case "voiceControl":
      return jobFacts.modelType === "video" ? jobFacts.voiceControl : false;
  }
}

function resolveRateQuantity({
  jobFacts,
  rate,
}: {
  jobFacts: ModalityGenerationCostLineItemJobFacts;
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
  jobFacts: ModalityGenerationCostLineItemJobFacts,
) {
  const videoJobFacts = assertVideoJobFacts(jobFacts);
  const normalizedResolution = jobFacts.outputResolution.toLowerCase();
  const dimensionsByAspectRatio =
    seedanceOutputDimensions[
      normalizedResolution as keyof typeof seedanceOutputDimensions
    ];

  if (!dimensionsByAspectRatio) {
    throw new GenerationModelRateConfigurationError(
      `Unsupported Seedance output resolution for cost estimation: ${jobFacts.outputResolution}`,
    );
  }

  if (videoJobFacts.outputAspectRatio === "adaptive") {
    return Object.values(dimensionsByAspectRatio).reduce((largest, current) =>
      current.widthPx * current.heightPx > largest.widthPx * largest.heightPx
        ? current
        : largest,
    );
  }

  const dimensions =
    dimensionsByAspectRatio[
      videoJobFacts.outputAspectRatio as keyof typeof dimensionsByAspectRatio
    ];

  if (!dimensions) {
    throw new GenerationModelRateConfigurationError(
      `Unsupported Seedance aspect ratio for cost estimation: ${videoJobFacts.outputAspectRatio}`,
    );
  }

  return dimensions;
}

function assertVideoJobFacts(jobFacts: ModalityGenerationCostLineItemJobFacts) {
  if (jobFacts.modelType !== "video") {
    throw new GenerationModelRateConfigurationError(
      "Video pricing quantity source cannot be used for an image model",
    );
  }

  return jobFacts;
}

function resolveInputVideoDurationSeconds(
  videos: NonNullable<EstimateGenerationCostInput["attachmentMedia"]>["videos"],
) {
  if (!videos || videos.length === 0) {
    return 0;
  }

  let knownDurationSeconds = 0;
  let hasMissingDuration = false;

  for (const video of videos) {
    if (video.durationSec === undefined) {
      hasMissingDuration = true;
      continue;
    }

    if (!Number.isFinite(video.durationSec) || video.durationSec <= 0) {
      throw new GenerationModelRateConfigurationError(
        `Invalid input video duration for cost estimation: ${String(video.durationSec)}`,
      );
    }

    knownDurationSeconds += video.durationSec;
  }

  return hasMissingDuration
    ? Math.max(
        knownDurationSeconds,
        seedanceMissingInputVideoDurationEstimateSeconds,
      )
    : knownDurationSeconds;
}

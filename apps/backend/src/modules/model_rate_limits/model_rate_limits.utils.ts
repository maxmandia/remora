import {
  GenerationModelRateLimitConfigurationError,
  type GenerationModelRateLimitConditions,
  type GenerationRateLimitJobFacts,
} from "./model_rate_limits.types.ts";

const generationModelRateLimitConditionKeys = [
  "outputResolution",
] as const satisfies readonly (keyof GenerationModelRateLimitConditions)[];

type GenerationModelRateLimitConditionKey =
  (typeof generationModelRateLimitConditionKeys)[number];

export function matchesGenerationModelRateLimitConditions({
  conditions,
  facts,
}: {
  conditions: GenerationModelRateLimitConditions;
  facts: GenerationRateLimitJobFacts;
}) {
  for (const [key, conditionValue] of Object.entries(conditions)) {
    const conditionKey = toGenerationModelRateLimitConditionKey(key);

    if (
      !matchesConditionValue(
        conditionValue,
        getConditionFact(conditionKey, facts),
      )
    ) {
      return false;
    }
  }

  return true;
}

export function createGenerationRateLimitWindowEntryId({
  bucketId,
  jobId,
}: {
  bucketId: string;
  jobId: string;
}) {
  return `generation:job:${jobId}:rate-limit-window:${bucketId}:v1`;
}

export function createGenerationRateLimitConcurrencyLeaseId({
  bucketId,
  jobId,
}: {
  bucketId: string;
  jobId: string;
}) {
  return `generation:job:${jobId}:rate-limit-concurrency:${bucketId}:v1`;
}

function matchesConditionValue(conditionValue: unknown, factValue: string) {
  if (typeof conditionValue === "string") {
    return conditionValue === factValue;
  }

  if (Array.isArray(conditionValue) && conditionValue.every(isString)) {
    return conditionValue.includes(factValue);
  }

  throw new GenerationModelRateLimitConfigurationError(
    `Unsupported generation model rate limit condition value: ${String(
      conditionValue,
    )}`,
  );
}

function getConditionFact(
  conditionKey: GenerationModelRateLimitConditionKey,
  facts: GenerationRateLimitJobFacts,
) {
  switch (conditionKey) {
    case "outputResolution":
      return facts.outputResolution;
  }
}

function toGenerationModelRateLimitConditionKey(
  key: string,
): GenerationModelRateLimitConditionKey {
  if (
    generationModelRateLimitConditionKeys.includes(
      key as GenerationModelRateLimitConditionKey,
    )
  ) {
    return key as GenerationModelRateLimitConditionKey;
  }

  throw new GenerationModelRateLimitConfigurationError(
    `Unsupported generation model rate limit condition: ${key}`,
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

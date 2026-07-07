export const generationRateLimitBucketKinds = [
  "request_window",
  "concurrent_task",
] as const;

export type GenerationRateLimitBucketKind =
  (typeof generationRateLimitBucketKinds)[number];

export const generationRateLimitWindowAlignments = [
  "rolling",
  "calendar_day",
] as const;

export type GenerationRateLimitWindowAlignment =
  (typeof generationRateLimitWindowAlignments)[number];

export type GenerationModelRateLimitConditions = {
  outputResolution?: string | string[];
};

export type GenerationRateLimitJobFacts = {
  outputResolution: string;
};

export type GenerationRateLimitBucketRecord = {
  id: string;
  providerId: string;
  kind: GenerationRateLimitBucketKind;
  maxValue: number;
  windowSeconds: number | null;
  windowAlignment: GenerationRateLimitWindowAlignment | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationModelRateLimitRecord = {
  id: string;
  modelId: string;
  bucketId: string;
  conditions: GenerationModelRateLimitConditions;
  createdAt: Date;
  updatedAt: Date;
  bucket: GenerationRateLimitBucketRecord;
};

export class GenerationModelRateLimitConfigurationError extends Error {
  readonly code = "GENERATION_MODEL_RATE_LIMIT_CONFIGURATION_ERROR";

  constructor(message: string) {
    super(message);
    this.name = "GenerationModelRateLimitConfigurationError";
  }
}

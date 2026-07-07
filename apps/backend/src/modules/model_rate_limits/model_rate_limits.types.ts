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

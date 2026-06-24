export const generationModelRateComponents = [
  "output_video",
  "input_video",
  "input_image",
  "provider_video_tokens",
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
] as const;

export type GenerationModelRateQuantitySource =
  (typeof generationModelRateQuantitySources)[number];

export const generationModelRateFinalQuantitySources = [
  "provider_completion_tokens",
] as const;

export type GenerationModelRateFinalQuantitySource =
  (typeof generationModelRateFinalQuantitySources)[number];

export type GenerationModelRateConditions = {
  outputResolution?: string | string[];
  inputVideoResolution?: string | string[];
  inputIncludesVideo?: boolean;
  nativeAudio?: boolean;
  voiceControl?: boolean;
};

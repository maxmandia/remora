import type { GenerationFieldSpec } from "../../../model/model.types.ts";
import type { GenerationProviderModelValidationInput } from "../provider.types.ts";
import { isJsonObject, ProviderHttpError } from "../provider-http.ts";
import type {
  CreateVideoTaskResult,
  GenerationProviderTaskResult,
} from "../../generation.types.ts";
import {
  bflVideoAspectRatios,
  BflPayloadError,
  BflProviderError,
  type BflVideoAspectRatio,
  type BflVideoResolution,
  type BflVideoTaskBuildInput,
  type BflVideoTaskRequest,
} from "./bfl.types.ts";

const bflProviderId = "bfl";
const bflFlux3VideoAdapter = "bfl_flux_3_video";
const bflFlux3VideoPath = "/v1/flux-3-video";
const bflProviderModelId = "latest";
const bflFlux3VideoFieldIds = [
  "prompt",
  "images",
  "videos",
  "draft",
  "resolution",
  "aspectRatio",
  "duration",
  "generateAudio",
] as const;

export function validateBflFlux3VideoModel({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const issues: string[] = [];

  if (model.providerId !== bflProviderId || model.type !== "video") {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  if (spec.providerModelId !== bflProviderModelId) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} requires providerModelId ${bflProviderModelId}`,
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== bflFlux3VideoPath
  ) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} requires POST ${bflFlux3VideoPath} endpoint`,
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    spec.modelParameter.path.length !== 1 ||
    spec.modelParameter.path[0] !== "version"
  ) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} requires spec-sourced model parameter at version`,
    );
  }

  if (spec.transforms.length > 0) {
    issues.push(`Adapter ${bflFlux3VideoAdapter} does not support transforms`);
  }

  const fields = new Map(spec.fields.map((field) => [field.id, field]));
  const actualFieldIds = spec.fields.map((field) => field.id);

  if (
    actualFieldIds.length !== bflFlux3VideoFieldIds.length ||
    bflFlux3VideoFieldIds.some((fieldId) => !fields.has(fieldId))
  ) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} requires exactly fields ${bflFlux3VideoFieldIds.join(", ")}`,
    );
  }

  validateField(fields.get("prompt"), "prompt", "string", issues);
  validateMediaField(fields.get("images"), "images", 10, issues);
  validateMediaField(fields.get("videos"), "videos", 1, issues);
  validateFieldOptions(
    fields.get("draft"),
    "draft",
    [false, true],
    false,
    issues,
  );
  validateFieldOptions(
    fields.get("resolution"),
    "resolution",
    ["hd", "fhd"],
    "hd",
    issues,
  );
  validateFieldOptions(
    fields.get("aspectRatio"),
    "aspectRatio",
    bflVideoAspectRatios,
    "auto",
    issues,
  );
  validateFieldOptions(
    fields.get("duration"),
    "duration",
    Array.from({ length: 16 }, (_, index) => index + 5),
    5,
    issues,
  );
  validateFieldOptions(
    fields.get("generateAudio"),
    "generateAudio",
    [true, false],
    true,
    issues,
  );

  return issues;
}

export function buildBflVideoTaskRequest({
  spec,
  input,
}: BflVideoTaskBuildInput): BflVideoTaskRequest {
  assertBflSpec(spec);

  if (input.draftCacheBase64) {
    return {
      mode: "draft_enhance",
      draft_cache: input.draftCacheBase64,
      resolution: toBflResolution(input.submittedInput.resolution),
      safety_tolerance: 4,
    };
  }

  const images = input.attachmentMedia.filter(
    (attachment) => attachment.fieldId === "images",
  );
  const videos = input.attachmentMedia.filter(
    (attachment) => attachment.fieldId === "videos",
  );
  const audios = input.attachmentMedia.filter(
    (attachment) => attachment.fieldId === "audios",
  );

  if (images.length > 0 && videos.length > 0) {
    throw new BflPayloadError(
      "FLUX 3 images and video continuation input cannot be combined",
    );
  }
  if (images.length > 10) {
    throw new BflPayloadError("FLUX 3 supports at most 10 keyframe images");
  }
  if (videos.length > 1) {
    throw new BflPayloadError(
      "FLUX 3 supports exactly one video continuation input",
    );
  }
  if (audios.length > 0) {
    throw new BflPayloadError("FLUX 3 does not support audio attachments");
  }
  if (videos.length > 0 && input.submittedInput.duration > 15) {
    throw new BflPayloadError(
      "FLUX 3 video continuation supports durations from 5 to 15 seconds",
    );
  }

  const prompt = input.submittedInput.prompt.trim();
  if (!prompt) {
    throw new BflPayloadError("FLUX 3 requires a prompt");
  }

  const common = {
    prompt,
    aspect_ratio: toBflAspectRatio(input.submittedInput.aspectRatio),
    duration: toBflDuration(input.submittedInput.duration),
    resolution: toBflResolution(input.submittedInput.resolution),
    version: "latest" as const,
    generate_audio: input.submittedInput.generateAudio,
    safety_tolerance: 4 as const,
    draft: input.submittedInput.draft,
  };

  if (images.length > 0) {
    const keyframes = images.map((image) => image.url);

    return { ...common, mode: "i2v", keyframes };
  }

  if (videos.length === 1) {
    return { ...common, mode: "v2v", start_video: videos[0]!.url };
  }

  return { ...common, mode: "t2v" };
}

export function parseBflCreateVideoTaskResponse(
  value: unknown,
): Extract<CreateVideoTaskResult, { provider: "bfl" }> {
  if (
    !isJsonObject(value) ||
    typeof value.id !== "string" ||
    typeof value.polling_url !== "string"
  ) {
    throw new BflPayloadError("FLUX 3 create response was malformed");
  }

  return {
    provider: "bfl",
    providerTaskId: value.id,
    providerModelId: bflProviderModelId,
    pollingUrl: value.polling_url,
  };
}

export function normalizeBflVideoTaskResult({
  expectedProviderTaskId,
  providerModelId,
  expectsDraftCache,
  value,
}: {
  expectedProviderTaskId: string;
  providerModelId: string;
  expectsDraftCache?: boolean;
  value: unknown;
}): GenerationProviderTaskResult {
  if (!isJsonObject(value) || typeof value.status !== "string") {
    throw new BflPayloadError("FLUX 3 result response was malformed");
  }

  const providerTaskId =
    typeof value.id === "string"
      ? value.id
      : value.status === "Task not found"
        ? expectedProviderTaskId
        : null;

  if (!providerTaskId) {
    throw new BflPayloadError("FLUX 3 result response was malformed");
  }

  if (providerTaskId !== expectedProviderTaskId) {
    throw new BflPayloadError("FLUX 3 result task id did not match");
  }

  const base = {
    provider: "bfl" as const,
    providerTaskId,
    providerModelId,
    usage: null,
    createdAt: null,
    updatedAt: null,
  };

  if (
    value.status === "Pending" ||
    value.status === "Reasoning" ||
    value.status === "Generating"
  ) {
    return {
      ...base,
      status: "running",
      videoUrl: null,
      draftCacheUrl: null,
      providerError: null,
    };
  }

  if (value.status === "Ready") {
    const result = isJsonObject(value.result) ? value.result : null;
    const sample =
      result && typeof result.sample === "string" ? result.sample : null;
    if (!sample) {
      throw new BflPayloadError(
        "FLUX 3 ready response did not include a video URL",
      );
    }

    const draftCacheUrl =
      result && typeof result.draft_cache === "string"
        ? result.draft_cache
        : null;

    if (expectsDraftCache && !draftCacheUrl) {
      throw new BflPayloadError(
        "FLUX 3 draft result did not include a draft cache URL",
      );
    }

    return {
      ...base,
      status: "succeeded",
      videoUrl: sample,
      draftCacheUrl,
      providerError: null,
    };
  }

  if (
    value.status === "Request Moderated" ||
    value.status === "Content Moderated" ||
    value.status === "Task not found" ||
    value.status === "Error" ||
    value.status === "Failed"
  ) {
    return {
      ...base,
      status: "failed",
      videoUrl: null,
      draftCacheUrl: null,
      providerError: {
        code: value.status.toUpperCase().replaceAll(" ", "_"),
        message: readBflErrorMessage(value) ?? `FLUX 3 task ${value.status}`,
      },
    };
  }

  throw new BflPayloadError(`Unsupported FLUX 3 task status: ${value.status}`);
}

export function validateBflPollingUrl(rawUrl: string, baseUrl: string): string {
  let pollingUrl: URL;
  let configuredUrl: URL;

  try {
    pollingUrl = new URL(rawUrl);
    configuredUrl = new URL(baseUrl);
  } catch {
    throw new BflPayloadError("FLUX 3 polling URL was invalid");
  }

  const isConfiguredOrigin = pollingUrl.origin === configuredUrl.origin;
  const isBflApiHost =
    pollingUrl.hostname === "api.bfl.ai" ||
    /^api\.[a-z0-9-]+\.bfl\.ai$/.test(pollingUrl.hostname);

  if (
    pollingUrl.protocol !== "https:" ||
    (!isConfiguredOrigin && !isBflApiHost)
  ) {
    throw new BflPayloadError("FLUX 3 polling URL host was not allowed");
  }

  return pollingUrl.toString();
}

export function toBflProviderError(error: unknown): BflProviderError {
  if (error instanceof BflProviderError) {
    return error;
  }

  if (error instanceof ProviderHttpError) {
    const retryable =
      error.statusCode === null ||
      error.statusCode === 429 ||
      error.statusCode >= 500;

    return new BflProviderError({
      code: error.code,
      message: error.message,
      providerMessage: error.providerMessage,
      retryable,
      statusCode: error.statusCode,
    });
  }

  return new BflProviderError({
    code: null,
    message: error instanceof Error ? error.message : "BFL request failed",
    providerMessage: null,
    retryable: true,
    statusCode: null,
  });
}

function assertBflSpec(spec: BflVideoTaskBuildInput["spec"]) {
  if (
    spec.provider !== bflProviderId ||
    spec.providerModelId !== bflProviderModelId ||
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== bflFlux3VideoPath
  ) {
    throw new BflPayloadError("FLUX 3 model spec was incompatible");
  }
}

function validateField(
  field: GenerationFieldSpec | undefined,
  fieldId: string,
  valueKind: GenerationFieldSpec["valueKind"],
  issues: string[],
) {
  if (!field || field.valueKind !== valueKind) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} field ${fieldId} must use ${valueKind}`,
    );
  }
}

function validateMediaField(
  field: GenerationFieldSpec | undefined,
  fieldId: string,
  arrayMax: number,
  issues: string[],
) {
  if (
    !field ||
    field.componentKind !== "mediaList" ||
    field.valueKind !== "array" ||
    field.arrayMax !== arrayMax
  ) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} field ${fieldId} must be a media list with arrayMax ${arrayMax}`,
    );
  }
}

function validateFieldOptions(
  field: GenerationFieldSpec | undefined,
  fieldId: string,
  values: readonly (string | number | boolean)[],
  defaultValue: string | number | boolean,
  issues: string[],
) {
  if (
    !field ||
    field.defaultValue !== defaultValue ||
    JSON.stringify(field.options?.map((option) => option.value)) !==
      JSON.stringify(values)
  ) {
    issues.push(
      `Adapter ${bflFlux3VideoAdapter} field ${fieldId} has incompatible options or default`,
    );
  }
}

function toBflAspectRatio(value: string): BflVideoAspectRatio {
  if ((bflVideoAspectRatios as readonly string[]).includes(value)) {
    return value as BflVideoAspectRatio;
  }

  throw new BflPayloadError(`Unsupported FLUX 3 aspect ratio: ${value}`);
}

function toBflResolution(value: string): BflVideoResolution {
  if (value === "hd" || value === "fhd") {
    return value;
  }

  throw new BflPayloadError(`Unsupported FLUX 3 resolution: ${value}`);
}

function toBflDuration(value: number) {
  if (Number.isInteger(value) && value >= 5 && value <= 20) {
    return value;
  }

  throw new BflPayloadError(`Unsupported FLUX 3 duration: ${value}`);
}

function readBflErrorMessage(value: Record<string, unknown>) {
  if (typeof value.details === "string") {
    return value.details;
  }
  if (
    isJsonObject(value.details) &&
    typeof value.details.message === "string"
  ) {
    return value.details.message;
  }
  return null;
}

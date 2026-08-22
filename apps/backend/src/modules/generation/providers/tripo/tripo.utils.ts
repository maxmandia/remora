import type { GenerationFieldSpec } from "../../../model/model.types.ts";
import type { GenerationProviderTaskResult } from "../../generation.types.ts";
import { isJsonObject, ProviderHttpError } from "../provider-http.ts";
import type { GenerationProviderModelValidationInput } from "../provider.types.ts";

import {
  tripoH31ModelId,
  tripoP1ModelId,
  TripoPayloadError,
  TripoProviderError,
  type TripoModel3dTaskBuildInput,
  type TripoModel3dTaskRequest,
  type TripoModelId,
} from "./tripo.types.ts";

const tripoAdapter = "tripo_model3d";
const textToModelPath = "/generation/text-to-model";
const imageToModelPath = "/generation/image-to-model";
const tripoTextureLevels = ["none", "standard", "detailed"] as const;
const tripoGeometryQualities = ["standard", "detailed"] as const;
const supportedImageContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const maxImageBytes = 20 * 1024 * 1024;

export function validateTripoModel3dModel({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const issues: string[] = [];

  if (model.providerId !== "tripo" || model.type !== "model3d") {
    issues.push(
      `Adapter ${tripoAdapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  const providerModelId = spec.providerModelId;
  if (
    providerModelId !== tripoH31ModelId &&
    providerModelId !== tripoP1ModelId
  ) {
    issues.push(
      `Adapter ${tripoAdapter} requires providerModelId ${tripoH31ModelId} or ${tripoP1ModelId}`,
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    (spec.endpoint.path !== textToModelPath &&
      spec.endpoint.path !== imageToModelPath)
  ) {
    issues.push(
      `Adapter ${tripoAdapter} requires POST ${textToModelPath} or ${imageToModelPath}`,
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    spec.modelParameter.path.length !== 1 ||
    spec.modelParameter.path[0] !== "model"
  ) {
    issues.push(
      `Adapter ${tripoAdapter} requires spec-sourced model parameter at model`,
    );
  }

  if (spec.transforms.length > 0) {
    issues.push(`Adapter ${tripoAdapter} does not support transforms`);
  }

  const fields = new Map(spec.fields.map((field) => [field.id, field]));
  validateFieldOptions(
    fields.get("textureLevel"),
    "textureLevel",
    tripoTextureLevels,
    "standard",
    issues,
  );
  validateFaceLimitField(fields.get("faceLimit"), providerModelId, issues);

  if (providerModelId === tripoH31ModelId) {
    validateFieldOptions(
      fields.get("geometryQuality"),
      "geometryQuality",
      tripoGeometryQualities,
      "standard",
      issues,
    );
  } else if (fields.has("geometryQuality")) {
    issues.push(`Adapter ${tripoAdapter} P1 specs cannot expose geometryQuality`);
  }

  if (spec.endpoint.path === textToModelPath) {
    const prompt = fields.get("prompt");
    if (
      !prompt ||
      prompt.valueKind !== "string" ||
      prompt.required !== true ||
      prompt.maxLength !== 1_024
    ) {
      issues.push(
        `Adapter ${tripoAdapter} text variants require prompt with maxLength 1024`,
      );
    }
    if (fields.has("images")) {
      issues.push(`Adapter ${tripoAdapter} text variants cannot expose images`);
    }
  } else {
    validateImageField(fields.get("images"), issues);
    if (fields.has("prompt")) {
      issues.push(`Adapter ${tripoAdapter} image variants cannot expose prompt`);
    }
  }

  const expectedFields = [
    spec.endpoint.path === textToModelPath ? "prompt" : "images",
    "textureLevel",
    "faceLimit",
    ...(providerModelId === tripoH31ModelId ? ["geometryQuality"] : []),
  ];
  const actualFields = spec.fields.map((field) => field.id);
  if (
    actualFields.length !== expectedFields.length ||
    expectedFields.some((fieldId) => !actualFields.includes(fieldId))
  ) {
    issues.push(
      `Adapter ${tripoAdapter} has incompatible fields; expected ${expectedFields.join(", ")}`,
    );
  }

  return issues;
}

export function buildTripoModel3dTaskRequest({
  spec,
  input,
}: TripoModel3dTaskBuildInput): TripoModel3dTaskRequest {
  const model = assertTripoSpec(spec);
  const settings = input.submittedInput;
  const texture = toTripoTextureRequest(settings.textureLevel);
  const common = {
    model,
    ...texture,
    ...(settings.faceLimit === null
      ? {}
      : { face_limit: validateFaceLimit(settings.faceLimit, model, settings) }),
    ...(model === tripoH31ModelId
      ? {
          geometry_quality: validateGeometryQuality(settings.geometryQuality),
        }
      : {}),
  };

  if (spec.endpoint.path === textToModelPath) {
    if (input.attachmentMedia.length > 0) {
      throw new TripoPayloadError(
        "Tripo text-to-3D does not accept media attachments",
      );
    }
    const prompt = settings.prompt.trim();
    if (!prompt || prompt.length > 1_024) {
      throw new TripoPayloadError(
        "Tripo text-to-3D requires a prompt of at most 1024 characters",
      );
    }
    return { ...common, prompt };
  }

  if (settings.prompt.trim()) {
    throw new TripoPayloadError("Tripo image-to-3D does not accept a prompt");
  }
  const images = input.attachmentMedia.filter(
    (attachment) => attachment.fieldId === "images",
  );
  if (images.length !== 1 || input.attachmentMedia.length !== 1) {
    throw new TripoPayloadError(
      "Tripo image-to-3D requires exactly one image attachment",
    );
  }
  const [image] = images;
  if (
    !image ||
    !supportedImageContentTypes.includes(
      image.contentType as (typeof supportedImageContentTypes)[number],
    )
  ) {
    throw new TripoPayloadError(
      "Tripo image-to-3D requires a JPEG, PNG, or WebP image",
    );
  }
  if (image.contentLength === null || image.contentLength > maxImageBytes) {
    throw new TripoPayloadError(
      "Tripo image-to-3D images must be no larger than 20 MB",
    );
  }

  return { ...common, input: validateHttpsUrl(image.url, "input image") };
}

export function parseTripoCreateModel3dTaskResponse(
  value: unknown,
  providerModelId: TripoModelId,
) {
  const data = readSuccessfulEnvelope(value, "create response");
  if (typeof data.task_id !== "string" || !data.task_id) {
    throw new TripoPayloadError("Tripo create response was malformed");
  }

  return {
    provider: "tripo" as const,
    providerTaskId: data.task_id,
    providerModelId,
    pollingUrl: null,
  };
}

export function normalizeTripoModel3dTaskResult({
  expectedProviderTaskId,
  providerModelId,
  value,
}: {
  expectedProviderTaskId: string;
  providerModelId: string;
  value: unknown;
}): GenerationProviderTaskResult {
  const data = readSuccessfulEnvelope(value, "task response");
  if (
    typeof data.task_id !== "string" ||
    typeof data.status !== "string"
  ) {
    throw new TripoPayloadError("Tripo task response was malformed");
  }
  if (data.task_id !== expectedProviderTaskId) {
    throw new TripoPayloadError("Tripo result task id did not match");
  }

  const creditsConsumed = readOptionalNonnegativeNumber(
    data.credits_consumed,
    "credits_consumed",
  );
  const base = {
    provider: "tripo" as const,
    providerTaskId: data.task_id,
    providerModelId,
    videoUrl: null,
    draftCacheUrl: null,
    usage: null,
    createdAt: readOptionalTimestamp(data.created_at),
    updatedAt: readOptionalTimestamp(data.completed_at),
    creditsConsumed,
  };

  if (data.status === "queued" || data.status === "running") {
    return {
      ...base,
      status: data.status,
      modelUrl: null,
      renderedImageUrl: null,
      providerError: null,
    };
  }

  if (data.status === "success") {
    if (!isJsonObject(data.output) || typeof data.output.model_url !== "string") {
      throw new TripoPayloadError(
        "Tripo successful task did not include a model URL",
      );
    }

    return {
      ...base,
      status: "succeeded",
      modelUrl: validateTripoOutputUrl(data.output.model_url),
      renderedImageUrl:
        typeof data.output.rendered_image_url === "string"
          ? validateTripoOutputUrl(data.output.rendered_image_url)
          : null,
      providerError: null,
    };
  }

  if (data.status === "failed" || data.status === "cancelled") {
    return {
      ...base,
      status: data.status,
      modelUrl: null,
      renderedImageUrl: null,
      providerError: {
        code:
          typeof data.error_code === "string" ||
          typeof data.error_code === "number"
            ? String(data.error_code)
            : null,
        message:
          typeof data.error_message === "string"
            ? data.error_message
            : null,
      },
    };
  }

  throw new TripoPayloadError(`Unsupported Tripo task status: ${data.status}`);
}

export function validateTripoOutputUrl(rawUrl: string): string {
  return validateHttpsUrl(rawUrl, "output");
}

export function toTripoProviderError(error: unknown): TripoProviderError {
  if (error instanceof TripoProviderError) {
    return error;
  }
  if (error instanceof ProviderHttpError) {
    return new TripoProviderError({
      code: error.code,
      message: error.message,
      providerMessage: error.providerMessage,
      retryable:
        error.statusCode === null ||
        error.statusCode === 429 ||
        error.statusCode >= 500,
      statusCode: error.statusCode,
      requestId: error.requestId,
    });
  }
  if (error instanceof TripoPayloadError) {
    return new TripoProviderError({
      code: "INVALID_TRIPO_PAYLOAD",
      message: error.message,
      providerMessage: null,
      retryable: false,
      statusCode: null,
    });
  }

  return new TripoProviderError({
    code: null,
    message: error instanceof Error ? error.message : "Tripo request failed",
    providerMessage: null,
    retryable: true,
    statusCode: null,
  });
}

function assertTripoSpec(
  spec: TripoModel3dTaskBuildInput["spec"],
): TripoModelId {
  if (
    spec.provider !== "tripo" ||
    (spec.providerModelId !== tripoH31ModelId &&
      spec.providerModelId !== tripoP1ModelId) ||
    spec.endpoint.method !== "POST" ||
    (spec.endpoint.path !== textToModelPath &&
      spec.endpoint.path !== imageToModelPath)
  ) {
    throw new TripoPayloadError("Tripo model spec was incompatible");
  }
  return spec.providerModelId;
}

function toTripoTextureRequest(
  textureLevel: TripoModel3dTaskBuildInput["input"]["submittedInput"]["textureLevel"],
) {
  if (textureLevel === "none") {
    return { texture: false as const, pbr: false as const };
  }
  if (textureLevel === "standard" || textureLevel === "detailed") {
    return {
      texture: true as const,
      pbr: true as const,
      texture_quality: textureLevel,
    };
  }
  throw new TripoPayloadError(`Unsupported Tripo texture level: ${textureLevel}`);
}

function validateGeometryQuality(
  value: TripoModel3dTaskBuildInput["input"]["submittedInput"]["geometryQuality"],
) {
  if (value === "standard" || value === "detailed") {
    return value;
  }
  throw new TripoPayloadError("Tripo H3.1 requires a geometry quality");
}

function validateFaceLimit(
  faceLimit: number,
  model: TripoModelId,
  settings: TripoModel3dTaskBuildInput["input"]["submittedInput"],
) {
  if (!Number.isInteger(faceLimit) || faceLimit <= 0) {
    throw new TripoPayloadError("Tripo face limit must be a positive integer");
  }
  if (model === tripoP1ModelId) {
    if (faceLimit < 50 || faceLimit > 20_000) {
      throw new TripoPayloadError("Tripo P1 face limit must be 50–20000");
    }
    if (settings.geometryQuality !== null) {
      throw new TripoPayloadError("Tripo P1 does not support geometry quality");
    }
    return faceLimit;
  }

  const max = settings.geometryQuality === "detailed" ? 2_000_000 : 1_500_000;
  if (faceLimit > max) {
    throw new TripoPayloadError(
      `Tripo H3.1 face limit cannot exceed ${max}`,
    );
  }
  return faceLimit;
}

function readSuccessfulEnvelope(value: unknown, label: string) {
  if (!isJsonObject(value)) {
    throw new TripoPayloadError(`Tripo ${label} was malformed`);
  }
  if (value.code !== 0) {
    throw new TripoProviderError({
      code:
        typeof value.code === "string" || typeof value.code === "number"
          ? String(value.code)
          : null,
      message: `Tripo ${label} reported an error`,
      providerMessage:
        typeof value.message === "string" ? value.message : null,
      retryable: value.code === 2000,
      statusCode: 200,
      requestId:
        typeof value.request_id === "string" ? value.request_id : null,
    });
  }
  if (!isJsonObject(value.data)) {
    throw new TripoPayloadError(`Tripo ${label} was malformed`);
  }
  return value.data;
}

function readOptionalNonnegativeNumber(value: unknown, field: string) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TripoPayloadError(`Tripo ${field} was malformed`);
  }
  return value;
}

function readOptionalTimestamp(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new TripoPayloadError("Tripo task timestamp was malformed");
  }
  return timestamp;
}

function validateHttpsUrl(rawUrl: string, label: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new TripoPayloadError(`Tripo ${label} URL was invalid`);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new TripoPayloadError(`Tripo ${label} URL was invalid`);
  }
  return url.toString();
}

function validateFieldOptions(
  field: GenerationFieldSpec | undefined,
  fieldId: string,
  values: readonly string[],
  defaultValue: string,
  issues: string[],
) {
  if (
    !field ||
    field.valueKind !== "string" ||
    field.defaultValue !== defaultValue ||
    JSON.stringify(field.options?.map((option) => option.value)) !==
      JSON.stringify(values)
  ) {
    issues.push(
      `Adapter ${tripoAdapter} field ${fieldId} has incompatible options or default`,
    );
  }
}

function validateFaceLimitField(
  field: GenerationFieldSpec | undefined,
  providerModelId: string | null,
  issues: string[],
) {
  const expectedMin = providerModelId === tripoP1ModelId ? 50 : 1;
  const expectedMax = providerModelId === tripoP1ModelId ? 20_000 : 2_000_000;
  if (
    !field ||
    field.valueKind !== "integer" ||
    field.defaultValue !== null ||
    field.min !== expectedMin ||
    field.max !== expectedMax
  ) {
    issues.push(
      `Adapter ${tripoAdapter} faceLimit must allow adaptive or ${expectedMin}–${expectedMax}`,
    );
  }
}

function validateImageField(
  field: GenerationFieldSpec | undefined,
  issues: string[],
) {
  if (
    !field ||
    field.componentKind !== "mediaList" ||
    field.required !== true ||
    field.arrayMin !== 1 ||
    field.arrayMax !== 1 ||
    field.mediaConstraints?.maxFileSizeBytes !== maxImageBytes ||
    JSON.stringify(field.mediaConstraints.mimeTypes) !==
      JSON.stringify(supportedImageContentTypes)
  ) {
    issues.push(
      `Adapter ${tripoAdapter} image variants require exactly one JPEG, PNG, or WebP up to 20 MB`,
    );
  }
}

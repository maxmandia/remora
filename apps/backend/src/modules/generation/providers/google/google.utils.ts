import { isJsonObject } from "../provider-http.ts";
import type { GenerationFieldSpec } from "../../../model/model.types.ts";
import type { GenerationProviderModelValidationInput } from "../provider.types.ts";

import type {
  GoogleGenerateImageInput,
  GoogleImageAspectRatio,
  GoogleImageGenerationResult,
  GoogleImageGenerationUsage,
  GoogleImageInteractionRequest,
  GoogleImageResolution,
  GoogleInputImageContentType,
  GoogleInteractionStatus,
  SanitizedGoogleInteractionPayload,
  SanitizedGoogleInteractionStep,
} from "./google.types.ts";
import { GoogleProviderError } from "./google.types.ts";

export const googleGeminiImageModelId = "gemini-3.1-flash-image";
export const googleInteractionsPath = "/v1/interactions";
export const maxGoogleReferenceImages = 14;
export const maxGoogleReferenceImageBytes = 100 * 1024 * 1024;

export const googleImageResolutions = ["512", "1K", "2K", "4K"] as const;
export const googleImageAspectRatios = [
  "1:1",
  "1:4",
  "1:8",
  "2:3",
  "3:2",
  "3:4",
  "4:1",
  "4:3",
  "4:5",
  "5:4",
  "8:1",
  "9:16",
  "16:9",
  "21:9",
] as const;

const googleGeminiInteractionsImageAdapter = "google_gemini_interactions_image";
const googleGeminiImageFieldIds = [
  "prompt",
  "images",
  "resolution",
  "aspectRatio",
] as const;
const googleGeminiImageMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
] as const;
const googleGeminiImageExtensions = [
  ".jpeg",
  ".jpg",
  ".png",
  ".webp",
  ".bmp",
] as const;

const googleInputImageContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
] as const;
const googleInteractionStatuses = [
  "in_progress",
  "requires_action",
  "completed",
  "failed",
  "cancelled",
  "incomplete",
  "budget_exceeded",
  "queued",
] as const;
const maxInlineImageBytes = 100 * 1024 * 1024;

export function validateGoogleGeminiInteractionsImageModel({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const adapter = googleGeminiInteractionsImageAdapter;
  const issues: string[] = [];

  if (
    model.providerId !== "google" ||
    model.type !== "image" ||
    spec.type !== "image"
  ) {
    issues.push(
      `Adapter ${adapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  if (spec.providerModelId !== googleGeminiImageModelId) {
    issues.push(
      `Adapter ${adapter} requires providerModelId ${googleGeminiImageModelId}`,
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== googleInteractionsPath
  ) {
    issues.push(
      `Adapter ${adapter} requires POST ${googleInteractionsPath} endpoint`,
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    !hasExactValues(spec.modelParameter.path, ["model"])
  ) {
    issues.push(
      `Adapter ${adapter} requires spec-sourced model parameter at model`,
    );
  }

  if (spec.transforms.length > 0 || spec.validationRules.length > 0) {
    issues.push(`Adapter ${adapter} does not support transforms or rules`);
  }

  const actualFieldIds = spec.fields.map((field) => field.id);

  if (!hasExactValues(actualFieldIds, googleGeminiImageFieldIds)) {
    issues.push(
      `Adapter ${adapter} requires exactly fields ${googleGeminiImageFieldIds.join(", ")}`,
    );
  }

  const fields = new Map(spec.fields.map((field) => [field.id, field]));
  const prompt = fields.get("prompt");
  const images = fields.get("images");
  const resolution = fields.get("resolution");
  const aspectRatio = fields.get("aspectRatio");

  if (
    !prompt ||
    prompt.componentKind !== "promptTextarea" ||
    prompt.valueKind !== "string" ||
    !prompt.required ||
    prompt.defaultValue !== "" ||
    prompt.providerPath !== undefined
  ) {
    issues.push(
      `Adapter ${adapter} field prompt must be a required prompt textarea handled by the adapter`,
    );
  }

  if (
    !images ||
    images.componentKind !== "mediaList" ||
    images.valueKind !== "array" ||
    images.required ||
    !Array.isArray(images.defaultValue) ||
    images.defaultValue.length !== 0 ||
    images.arrayMax !== maxGoogleReferenceImages ||
    images.providerPath !== undefined ||
    !hasExactValues(images.mediaRoleCapabilities, ["reference"]) ||
    !hasExactValues(
      images.mediaConstraints?.mimeTypes,
      googleGeminiImageMimeTypes,
    ) ||
    !hasExactValues(
      images.mediaConstraints?.extensions,
      googleGeminiImageExtensions,
    ) ||
    images.mediaConstraints?.maxFileSizeBytes !==
      maxGoogleReferenceImageBytes ||
    images.mediaConstraints?.maxTotalFileSizeBytes !==
      maxGoogleReferenceImageBytes
  ) {
    issues.push(
      `Adapter ${adapter} field images must accept up to 14 reference JPEG, PNG, WebP, or BMP images totaling 100 MB`,
    );
  }

  validateGoogleSelectField({
    adapter,
    field: resolution,
    fieldId: "resolution",
    defaultValue: "1K",
    values: googleImageResolutions,
    providerPath: ["response_format", "image_size"],
    issues,
  });
  validateGoogleSelectField({
    adapter,
    field: aspectRatio,
    fieldId: "aspectRatio",
    defaultValue: "1:1",
    values: googleImageAspectRatios,
    providerPath: ["response_format", "aspect_ratio"],
    issues,
  });

  return issues;
}

function validateGoogleSelectField({
  adapter,
  defaultValue,
  field,
  fieldId,
  issues,
  providerPath,
  values,
}: {
  adapter: string;
  field: GenerationFieldSpec | undefined;
  fieldId: "resolution" | "aspectRatio";
  defaultValue: string;
  values: readonly string[];
  providerPath: readonly string[];
  issues: string[];
}) {
  if (
    !field ||
    field.componentKind !== "select" ||
    field.valueKind !== "string" ||
    field.required ||
    field.defaultValue !== defaultValue ||
    !hasExactValues(
      field.options?.map((option) => option.value),
      values,
    ) ||
    !hasExactValues(field.providerPath, providerPath) ||
    field.providerValueMap !== undefined
  ) {
    issues.push(
      `Adapter ${adapter} field ${fieldId} must default to ${defaultValue} and support exactly ${values.join(", ")}`,
    );
  }
}

function hasExactValues(
  actual: readonly unknown[] | undefined,
  expected: readonly unknown[],
) {
  return (
    actual?.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  );
}

export function buildGoogleImageInteractionRequest({
  spec,
  input,
}: Pick<
  GoogleGenerateImageInput,
  "spec" | "input"
>): GoogleImageInteractionRequest {
  assertGoogleImageSpec(spec);

  const prompt = input.submittedInput.prompt.trim();
  const resolution = toGoogleImageResolution(input.submittedInput.resolution);
  const aspectRatio = toGoogleImageAspectRatio(
    input.submittedInput.aspectRatio,
  );

  if (!prompt) {
    throw invalidRequest("prompt is required");
  }

  if (input.attachmentMedia.length > maxGoogleReferenceImages) {
    throw invalidRequest(
      `at most ${maxGoogleReferenceImages} reference images are supported`,
    );
  }

  let totalReferenceImageBytes = 0;
  const referenceImages = input.attachmentMedia.map((media) => {
    if (media.fieldId !== "images" || media.role !== "reference") {
      throw invalidRequest("only reference images are supported");
    }

    const contentType = toGoogleInputImageContentType(media.contentType);
    const contentLength = media.contentLength;

    if (
      contentLength === null ||
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0
    ) {
      throw invalidRequest("reference image content length is required");
    }

    totalReferenceImageBytes += contentLength;
    assertSignedHttpsUrl(media.url);

    return {
      type: "image" as const,
      uri: media.url,
      mime_type: contentType,
    };
  });

  if (totalReferenceImageBytes > maxGoogleReferenceImageBytes) {
    throw invalidRequest(
      `reference images must total at most ${maxGoogleReferenceImageBytes} bytes`,
    );
  }

  return {
    model: googleGeminiImageModelId,
    input: [
      {
        type: "user_input",
        content: [{ type: "text", text: prompt }, ...referenceImages],
      },
    ],
    response_format: {
      type: "image",
      mime_type: "image/jpeg",
      aspect_ratio: aspectRatio,
      image_size: resolution,
    },
    store: false,
  };
}

export function parseGoogleImageInteractionResponse({
  value,
  providerModelId,
  fallbackProviderTaskId,
  receivedAt,
}: {
  value: unknown;
  providerModelId: string;
  fallbackProviderTaskId?: string;
  receivedAt: string;
}): GoogleImageGenerationResult {
  if (!isJsonObject(value)) {
    throw malformedResponse("top-level response was not an object");
  }

  const providerInteractionId = readSafeInteractionId(value.id);
  const returnedModel = readNonEmptyString(value.model);
  const status = toGoogleInteractionStatus(value.status);

  if (!providerInteractionId && value.id !== null && value.id !== undefined) {
    throw malformedResponse(describeInvalidInteractionId(value.id));
  }

  const providerTaskId =
    providerInteractionId ?? readSafeInteractionId(fallbackProviderTaskId);

  if (!providerTaskId) {
    throw malformedResponse("interaction id and fallback task id were missing");
  }

  if (!status) {
    const returnedStatus = readSafeMetadataValue(value.status);

    throw malformedResponse(
      returnedStatus
        ? `interaction status ${returnedStatus} was unsupported`
        : "interaction status was missing or invalid",
    );
  }

  if (
    returnedModel &&
    !isExpectedResponseModel(returnedModel, providerModelId)
  ) {
    throw new GoogleProviderError("Google returned an unexpected model", {
      code: "UNEXPECTED_MODEL",
      interactionStatus: status,
    });
  }

  if (status !== "completed") {
    throw new GoogleProviderError("Google interaction did not complete", {
      code:
        readSafeProviderCode(value) ?? `INTERACTION_${status.toUpperCase()}`,
      interactionStatus: status,
    });
  }

  const responseModel = returnedModel ?? providerModelId;
  const imageContent = findFinalModelOutputImage(value.steps);

  if (!imageContent) {
    throw new GoogleProviderError(
      "Google interaction did not return an image",
      {
        code: "MISSING_IMAGE",
        interactionStatus: status,
      },
    );
  }

  if (imageContent.mimeType !== "image/jpeg") {
    throw new GoogleProviderError(
      "Google interaction returned an unsupported image type",
      {
        code: "UNSUPPORTED_IMAGE_CONTENT_TYPE",
        interactionStatus: status,
      },
    );
  }

  const imageData = decodeBase64Image(imageContent.data);
  const usage = parseGoogleImageUsage(value.usage);
  const rawPayload = sanitizeGoogleInteraction({
    value,
    providerInteractionId,
    responseModel,
    usage,
    status,
    selectedImageContentType: imageContent.mimeType,
  });

  return {
    provider: "google",
    providerTaskId,
    providerModelId,
    image: {
      data: imageData,
      contentType: imageContent.mimeType,
      contentLength: imageData.byteLength,
    },
    usage,
    rawPayload,
    receivedAt,
  };
}

export function readGoogleHttpErrorCode(
  value: unknown,
  statusCode: number,
): string {
  return readSafeProviderCode(value) ?? `HTTP_${statusCode}`;
}

export function formatGoogleHttpErrorMessage({
  message,
  providerMessage,
  statusCode,
  code,
}: {
  message: string;
  providerMessage: string | null;
  statusCode: number;
  code: string;
}) {
  return [
    message,
    providerMessage ? `: ${providerMessage}` : "",
    ` (HTTP ${statusCode}, code ${code})`,
  ].join("");
}

export function readSafeGoogleHttpErrorMessage({
  value,
  sensitiveValues,
}: {
  value: unknown;
  sensitiveValues: readonly string[];
}): string | null {
  if (
    !isJsonObject(value) ||
    !isJsonObject(value.error) ||
    typeof value.error.message !== "string"
  ) {
    return null;
  }

  let message = value.error.message.trim();

  if (!message) {
    return null;
  }

  for (const sensitiveValue of [...new Set(sensitiveValues)]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)) {
    message = message.replaceAll(sensitiveValue, "[redacted]");
  }

  message = message
    .replace(/https?:\/\/[^\s,;)]+/giu, "[redacted-url]")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!message) {
    return null;
  }

  const maxLength = 500;

  return message.length <= maxLength
    ? message
    : `${message.slice(0, maxLength)}...`;
}

function assertGoogleImageSpec(spec: GoogleGenerateImageInput["spec"]): void {
  if (
    spec.provider !== "google" ||
    spec.type !== "image" ||
    spec.providerModelId !== googleGeminiImageModelId ||
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== googleInteractionsPath
  ) {
    throw new GoogleProviderError(
      "Google image model configuration is invalid",
      { code: "INVALID_CONFIGURATION" },
    );
  }
}

function toGoogleImageResolution(value: string): GoogleImageResolution {
  if (
    googleImageResolutions.includes(
      value as (typeof googleImageResolutions)[number],
    )
  ) {
    return value as GoogleImageResolution;
  }

  throw invalidRequest("resolution is not supported");
}

function toGoogleImageAspectRatio(value: string): GoogleImageAspectRatio {
  if (
    googleImageAspectRatios.includes(
      value as (typeof googleImageAspectRatios)[number],
    )
  ) {
    return value as GoogleImageAspectRatio;
  }

  throw invalidRequest("aspect ratio is not supported");
}

function toGoogleInputImageContentType(
  value: string | null,
): GoogleInputImageContentType {
  if (
    value &&
    googleInputImageContentTypes.includes(
      value as (typeof googleInputImageContentTypes)[number],
    )
  ) {
    return value as GoogleInputImageContentType;
  }

  throw invalidRequest("reference image content type is not supported");
}

function assertSignedHttpsUrl(value: string): void {
  try {
    const url = new URL(value);

    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      url.hostname
    ) {
      return;
    }
  } catch {
    // Fall through to the safe validation error below.
  }

  throw invalidRequest("reference image URL must be a signed HTTPS URL");
}

function findFinalModelOutputImage(value: unknown): {
  data: string;
  mimeType: string;
} | null {
  if (!Array.isArray(value)) {
    throw malformedResponse("steps were missing or invalid");
  }

  const modelOutputSteps = value.filter(
    (step) => isJsonObject(step) && step.type === "model_output",
  );
  const finalModelOutput = modelOutputSteps.at(-1);

  if (!finalModelOutput || !Array.isArray(finalModelOutput.content)) {
    return null;
  }

  for (
    let index = finalModelOutput.content.length - 1;
    index >= 0;
    index -= 1
  ) {
    const content = finalModelOutput.content[index];

    if (!isJsonObject(content) || content.type !== "image") {
      continue;
    }

    const data = readNonEmptyString(content.data);
    const mimeType = readNonEmptyString(content.mime_type) ?? "image/jpeg";

    if (!data) {
      throw malformedResponse(
        readNonEmptyString(content.uri)
          ? "image contained a URI instead of inline data"
          : "image data was missing or invalid",
      );
    }

    return { data, mimeType };
  }

  return null;
}

function decodeBase64Image(value: string): Buffer {
  if (
    value.length === 0 ||
    value.length > Math.ceil((maxInlineImageBytes * 4) / 3) + 4 ||
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  ) {
    throw malformedImage();
  }

  const image = Buffer.from(value, "base64");

  if (image.byteLength === 0 || image.byteLength > maxInlineImageBytes) {
    throw malformedImage();
  }

  return image;
}

function parseGoogleImageUsage(
  value: unknown,
): GoogleImageGenerationUsage | null {
  if (!isJsonObject(value)) {
    return null;
  }

  return {
    inputTokens: readNonNegativeInteger(value.total_input_tokens),
    outputTextTokens: sumModalityTokens(
      value.output_tokens_by_modality,
      "text",
    ),
    outputImageTokens: sumModalityTokens(
      value.output_tokens_by_modality,
      "image",
    ),
    thoughtTokens: readNonNegativeInteger(value.total_thought_tokens),
    totalTokens: readNonNegativeInteger(value.total_tokens),
  };
}

function sumModalityTokens(
  value: unknown,
  modality: "text" | "image",
): number | null {
  if (!Array.isArray(value)) {
    return null;
  }

  let total = 0;

  for (const entry of value) {
    if (!isJsonObject(entry) || entry.modality !== modality) {
      continue;
    }

    const tokens = readNonNegativeInteger(entry.tokens);

    if (tokens === null) {
      return null;
    }

    total += tokens;
  }

  return Number.isSafeInteger(total) ? total : null;
}

function sanitizeGoogleInteraction({
  value,
  providerInteractionId,
  responseModel,
  usage,
  status,
  selectedImageContentType,
}: {
  value: Record<string, unknown>;
  providerInteractionId: string | null;
  responseModel: string;
  usage: GoogleImageGenerationUsage | null;
  status: "completed";
  selectedImageContentType: "image/jpeg";
}): SanitizedGoogleInteractionPayload {
  return {
    id: providerInteractionId,
    model: responseModel,
    status,
    created: readIsoTimestamp(value.created),
    updated: readIsoTimestamp(value.updated),
    usage,
    output: {
      imageCount: countModelOutputImages(value.steps),
      selectedImageContentType,
    },
    steps: sanitizeGoogleInteractionSteps(value.steps),
  };
}

function countModelOutputImages(value: unknown): number {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.reduce((count, step) => {
    if (
      !isJsonObject(step) ||
      step.type !== "model_output" ||
      !Array.isArray(step.content)
    ) {
      return count;
    }

    return (
      count +
      step.content.filter(
        (content) => isJsonObject(content) && content.type === "image",
      ).length
    );
  }, 0);
}

function sanitizeGoogleInteractionSteps(
  value: unknown,
): SanitizedGoogleInteractionStep[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((step) => {
    if (!isJsonObject(step)) {
      return { type: "unknown", content: [] };
    }

    return {
      type: readSafeMetadataValue(step.type) ?? "unknown",
      content: Array.isArray(step.content)
        ? step.content.map((content) => {
            if (!isJsonObject(content)) {
              return { type: "unknown", mimeType: null };
            }

            return {
              type: readSafeMetadataValue(content.type) ?? "unknown",
              mimeType: readSafeMetadataValue(content.mime_type),
            };
          })
        : [],
    };
  });
}

function readSafeProviderCode(value: unknown): string | null {
  if (!isJsonObject(value) || !isJsonObject(value.error)) {
    return null;
  }

  return (
    readSafeMetadataValue(value.error.status) ??
    readSafeMetadataValue(value.error.code)
  );
}

function toGoogleInteractionStatus(
  value: unknown,
): GoogleInteractionStatus | null {
  return typeof value === "string" &&
    googleInteractionStatuses.includes(
      value as (typeof googleInteractionStatuses)[number],
    )
    ? (value as GoogleInteractionStatus)
    : null;
}

function isExpectedResponseModel(value: string, expected: string): boolean {
  return value === expected || value === `models/${expected}`;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readSafeInteractionId(value: unknown): string | null {
  return typeof value === "string" &&
    value.length <= 2_048 &&
    value.trim().length > 0 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

function describeInvalidInteractionId(value: unknown): string {
  if (value === null || value === undefined) {
    return "interaction id was missing";
  }

  if (typeof value !== "string") {
    return "interaction id was not a string";
  }

  if (value.length > 2_048) {
    return "interaction id exceeded the safe length limit";
  }

  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    return "interaction id contained control characters";
  }

  return "interaction id was empty";
}

function readIsoTimestamp(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    return null;
  }

  return value;
}

function readSafeMetadataValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return typeof value === "string" && /^[A-Za-z0-9_.:/+-]{1,128}$/.test(value)
    ? value
    : null;
}

function readNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function invalidRequest(message: string): GoogleProviderError {
  return new GoogleProviderError(`Google image request ${message}`, {
    code: "INVALID_REQUEST",
  });
}

function malformedResponse(reason: string): GoogleProviderError {
  return new GoogleProviderError(
    `Google interaction response was malformed: ${reason}`,
    { code: "MALFORMED_RESPONSE" },
  );
}

function malformedImage(): GoogleProviderError {
  return new GoogleProviderError(
    "Google interaction returned malformed image data",
    { code: "MALFORMED_IMAGE" },
  );
}

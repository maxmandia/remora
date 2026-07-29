import type { GenerationFieldSpec } from "../../../model/model.types.ts";
import type { GenerationProviderModelValidationInput } from "../provider.types.ts";
import { isJsonObject } from "../provider-http.ts";
import type {
  OpenAIGenerateImageInput,
  OpenAIImageEditRequest,
  OpenAIImageGenerateRequest,
  OpenAIImageGenerationResult,
  OpenAIImageGenerationUsage,
  OpenAIImageSize,
  OpenAIInputImageContentType,
  SanitizedOpenAIImagePayload,
} from "./openai.types.ts";
import { OpenAIProviderError } from "./openai.types.ts";

export const openAIImageModelId = "gpt-image-2-2026-04-21";
export const openAIImageGenerationPath = "/v1/images/generations";
export const openAIImageEditPath = "/images/edits";
export const maxOpenAIReferenceImages = 16;
export const maxOpenAIReferenceImageBytes = 50 * 1024 * 1024;
export const maxOpenAIPromptLength = 32_000;

export const openAIImageAspectRatios = ["1:1", "3:2", "2:3"] as const;
export const openAIImageSizes = {
  "1:1": "1024x1024",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
} as const satisfies Record<
  (typeof openAIImageAspectRatios)[number],
  OpenAIImageSize
>;

const openAIImageAdapter = "openai_gpt_image_2";
const openAIImageFieldIds = [
  "prompt",
  "images",
  "resolution",
  "aspectRatio",
] as const;
const openAIImageMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
const openAIImageExtensions = [".jpeg", ".jpg", ".png", ".webp"] as const;

export function validateOpenAIGptImage2Model({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const issues: string[] = [];

  if (
    model.providerId !== "openai" ||
    model.type !== "image" ||
    spec.type !== "image"
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  if (spec.providerModelId !== openAIImageModelId) {
    issues.push(
      `Adapter ${openAIImageAdapter} requires providerModelId ${openAIImageModelId}`,
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== openAIImageGenerationPath
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} requires POST ${openAIImageGenerationPath} endpoint`,
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    !hasExactValues(spec.modelParameter.path, ["model"])
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} requires spec-sourced model parameter at model`,
    );
  }

  if (spec.transforms.length > 0 || spec.validationRules.length > 0) {
    issues.push(
      `Adapter ${openAIImageAdapter} does not support transforms or rules`,
    );
  }

  const actualFieldIds = spec.fields.map((field) => field.id);

  if (!hasExactValues(actualFieldIds, openAIImageFieldIds)) {
    issues.push(
      `Adapter ${openAIImageAdapter} requires exactly fields ${openAIImageFieldIds.join(", ")}`,
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
    prompt.maxLength !== maxOpenAIPromptLength ||
    prompt.providerPath !== undefined
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} field prompt must be a required prompt textarea with a ${maxOpenAIPromptLength}-character maximum`,
    );
  }

  if (
    !images ||
    images.componentKind !== "mediaList" ||
    images.valueKind !== "array" ||
    images.required ||
    !Array.isArray(images.defaultValue) ||
    images.defaultValue.length !== 0 ||
    images.arrayMax !== maxOpenAIReferenceImages ||
    images.providerPath !== undefined ||
    !hasExactValues(images.mediaRoleCapabilities, ["reference"]) ||
    !hasExactValues(images.mediaConstraints?.mimeTypes, openAIImageMimeTypes) ||
    !hasExactValues(
      images.mediaConstraints?.extensions,
      openAIImageExtensions,
    ) ||
    images.mediaConstraints?.maxFileSizeBytes !== maxOpenAIReferenceImageBytes
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} field images must accept up to 16 reference JPEG, PNG, or WebP images of at most 50 MB each`,
    );
  }

  if (
    !resolution ||
    resolution.componentKind !== "hidden" ||
    resolution.valueKind !== "string" ||
    resolution.required ||
    resolution.defaultValue !== "standard" ||
    resolution.providerPath !== undefined ||
    resolution.options !== undefined
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} field resolution must be hidden and default to standard`,
    );
  }

  validateAspectRatioField(aspectRatio, issues);

  return issues;
}

function validateAspectRatioField(
  field: GenerationFieldSpec | undefined,
  issues: string[],
) {
  if (
    !field ||
    field.componentKind !== "select" ||
    field.valueKind !== "string" ||
    field.required ||
    field.defaultValue !== "1:1" ||
    !hasExactValues(
      field.options?.map((option) => option.value),
      openAIImageAspectRatios,
    ) ||
    field.providerPath !== undefined ||
    field.providerValueMap !== undefined
  ) {
    issues.push(
      `Adapter ${openAIImageAdapter} field aspectRatio must default to 1:1 and support exactly ${openAIImageAspectRatios.join(", ")}`,
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

export function buildOpenAIImageRequest({
  spec,
  input,
}: Pick<OpenAIGenerateImageInput, "spec" | "input">):
  | OpenAIImageGenerateRequest
  | OpenAIImageEditRequest {
  assertOpenAIImageSpec(spec);
  const prompt = input.submittedInput.prompt.trim();

  if (!prompt) {
    throw invalidRequest("prompt is required");
  }

  if (prompt.length > maxOpenAIPromptLength) {
    throw invalidRequest(
      `prompt must be at most ${maxOpenAIPromptLength} characters`,
    );
  }

  if (input.submittedInput.resolution !== "standard") {
    throw invalidRequest("resolution is not supported");
  }

  const size = toOpenAIImageSize(input.submittedInput.aspectRatio);
  const request: OpenAIImageGenerateRequest = {
    model: openAIImageModelId,
    prompt,
    n: 1,
    quality: "high",
    output_format: "jpeg",
    size,
  };

  if (input.attachmentMedia.length === 0) {
    return request;
  }

  if (input.attachmentMedia.length > maxOpenAIReferenceImages) {
    throw invalidRequest(
      `at most ${maxOpenAIReferenceImages} reference images are supported`,
    );
  }

  return {
    ...request,
    images: input.attachmentMedia.map((media) => {
      if (media.fieldId !== "images" || media.role !== "reference") {
        throw invalidRequest("only reference images are supported");
      }

      toOpenAIInputImageContentType(media.contentType);
      const contentLength = media.contentLength;

      if (
        contentLength === null ||
        !Number.isSafeInteger(contentLength) ||
        contentLength <= 0
      ) {
        throw invalidRequest("reference image content length is required");
      }

      if (contentLength > maxOpenAIReferenceImageBytes) {
        throw invalidRequest(
          `each reference image must be at most ${maxOpenAIReferenceImageBytes} bytes`,
        );
      }

      assertSignedHttpsUrl(media.url);

      return { image_url: media.url };
    }),
  };
}

export function isOpenAIImageEditRequest(
  request: OpenAIImageGenerateRequest | OpenAIImageEditRequest,
): request is OpenAIImageEditRequest {
  return "images" in request;
}

export function parseOpenAIImageResponse({
  value,
  providerTaskId,
  providerModelId,
  expectedSize,
  receivedAt,
}: {
  value: unknown;
  providerTaskId: string;
  providerModelId: typeof openAIImageModelId;
  expectedSize: OpenAIImageSize;
  receivedAt: string;
}): OpenAIImageGenerationResult {
  if (!isJsonObject(value)) {
    throw malformedResponse("top-level response was not an object");
  }

  const data = Array.isArray(value.data) ? value.data : null;
  const firstImage = data?.[0];

  if (
    data?.length !== 1 ||
    !isJsonObject(firstImage) ||
    typeof firstImage.b64_json !== "string"
  ) {
    throw malformedResponse("exactly one base64 image was not returned");
  }

  if (value.output_format !== undefined && value.output_format !== "jpeg") {
    throw malformedResponse("output format was not JPEG");
  }

  if (value.quality !== undefined && value.quality !== "high") {
    throw malformedResponse("output quality was not high");
  }

  if (value.size !== undefined && value.size !== expectedSize) {
    throw malformedResponse("output size did not match the request");
  }

  const imageData = decodeBase64Jpeg(firstImage.b64_json);
  const usage = parseOpenAIImageUsage(value.usage);
  const created =
    Number.isSafeInteger(value.created) && (value.created as number) >= 0
      ? (value.created as number)
      : null;
  const rawPayload: SanitizedOpenAIImagePayload = {
    created,
    outputFormat: "jpeg",
    quality: "high",
    size: expectedSize,
    usage,
    output: {
      imageCount: 1,
      selectedImageContentType: "image/jpeg",
    },
  };

  return {
    provider: "openai",
    providerTaskId,
    providerModelId,
    image: {
      data: imageData,
      contentType: "image/jpeg",
      contentLength: imageData.byteLength,
    },
    usage,
    rawPayload,
    receivedAt,
  };
}

export function sanitizeOpenAIProviderMessage({
  message,
  sensitiveValues,
}: {
  message: unknown;
  sensitiveValues: readonly string[];
}): string | null {
  if (typeof message !== "string" || !message.trim()) {
    return null;
  }

  let sanitized = message.trim();

  for (const sensitiveValue of [...new Set(sensitiveValues)]
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)) {
    sanitized = sanitized.replaceAll(sensitiveValue, "[redacted]");
  }

  sanitized = sanitized
    .replace(/https?:\/\/[^\s,;)]+/giu, "[redacted-url]")
    .replace(/\b(?:sk|sess|key)-[a-z0-9_-]+\b/giu, "[redacted]")
    .replace(/[\u0000-\u001f\u007f]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!sanitized) {
    return null;
  }

  return sanitized.length <= 500 ? sanitized : `${sanitized.slice(0, 500)}...`;
}

function assertOpenAIImageSpec(spec: OpenAIGenerateImageInput["spec"]) {
  if (
    spec.provider !== "openai" ||
    spec.type !== "image" ||
    spec.providerModelId !== openAIImageModelId ||
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== openAIImageGenerationPath
  ) {
    throw new OpenAIProviderError(
      "OpenAI image model configuration is invalid",
      {
        code: "INVALID_CONFIGURATION",
        retryable: false,
      },
    );
  }
}

function toOpenAIImageSize(aspectRatio: string): OpenAIImageSize {
  const size = openAIImageSizes[aspectRatio as keyof typeof openAIImageSizes];

  if (!size) {
    throw invalidRequest("aspect ratio is not supported");
  }

  return size;
}

function toOpenAIInputImageContentType(
  value: string | null,
): OpenAIInputImageContentType {
  if (openAIImageMimeTypes.includes(value as OpenAIInputImageContentType)) {
    return value as OpenAIInputImageContentType;
  }

  throw invalidRequest("reference image type is not supported");
}

function assertSignedHttpsUrl(value: string) {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw invalidRequest("reference image URL is invalid");
  }

  if (url.protocol !== "https:") {
    throw invalidRequest("reference image URL must use HTTPS");
  }
}

function decodeBase64Jpeg(value: string): Buffer {
  const compact = value.replace(/\s+/gu, "");

  if (
    !compact ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(compact)
  ) {
    throw malformedImage();
  }

  const image = Buffer.from(compact, "base64");

  if (
    image.length < 4 ||
    image[0] !== 0xff ||
    image[1] !== 0xd8 ||
    image[2] !== 0xff ||
    image[image.length - 2] !== 0xff ||
    image[image.length - 1] !== 0xd9
  ) {
    throw malformedImage();
  }

  return image;
}

function parseOpenAIImageUsage(value: unknown): OpenAIImageGenerationUsage {
  if (!isJsonObject(value) || !isJsonObject(value.input_tokens_details)) {
    throw malformedResponse("complete token usage was not returned");
  }

  const inputTokens = readTokenCount(value.input_tokens);
  const inputTextTokens = readTokenCount(
    value.input_tokens_details.text_tokens,
  );
  const inputImageTokens = readTokenCount(
    value.input_tokens_details.image_tokens,
  );
  const outputImageTokens = readTokenCount(value.output_tokens);
  const totalTokens = readTokenCount(value.total_tokens);

  if (
    inputTokens === null ||
    inputTextTokens === null ||
    inputImageTokens === null ||
    outputImageTokens === null ||
    totalTokens === null ||
    inputTokens !== inputTextTokens + inputImageTokens ||
    totalTokens !== inputTokens + outputImageTokens
  ) {
    throw malformedResponse("complete token usage was invalid");
  }

  return {
    inputTokens,
    inputTextTokens,
    inputImageTokens,
    outputTextTokens: null,
    outputImageTokens,
    thoughtTokens: null,
    totalTokens,
  };
}

function readTokenCount(value: unknown): number | null {
  return Number.isSafeInteger(value) && (value as number) >= 0
    ? (value as number)
    : null;
}

function invalidRequest(reason: string) {
  return new OpenAIProviderError(`OpenAI image request is invalid: ${reason}`, {
    code: "INVALID_REQUEST",
    retryable: false,
  });
}

function malformedResponse(reason: string) {
  return new OpenAIProviderError(
    `OpenAI image response was malformed: ${reason}`,
    {
      code: "MALFORMED_RESPONSE",
      retryable: false,
    },
  );
}

function malformedImage() {
  return new OpenAIProviderError(
    "OpenAI image response contained malformed JPEG data",
    {
      code: "MALFORMED_IMAGE",
      retryable: false,
    },
  );
}

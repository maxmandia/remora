import type {
  CreateVideoTaskResult,
  GenerationProviderTaskResult,
  GenerationProviderTaskStatus,
} from "../../generation.types.ts";
import {
  ModelFieldPayloadBuilder,
  type ModelFieldPayloadValue,
} from "../../model-field-payload.ts";
import type {
  JsonPrimitive,
  GenerationFieldSpec,
} from "../../../model/model.types.ts";
import { isJsonObject, ProviderHttpError } from "../provider-http.ts";
import type { GenerationProviderModelValidationInput } from "../provider.types.ts";

import type {
  KlingProviderTaskStatus,
  KlingVideoTaskBuildInput,
  KlingVideoTaskRequest,
} from "./kling.types.ts";

const klingProviderId = "kling";
const klingProviderModelId = "kling-v3";
const klingTextToVideoPath = "/v1/videos/text2video";
const klingV3TextToVideoAdapter = "kling_v3_text_to_video";
const supportedAspectRatios = ["16:9", "9:16", "1:1"] as const;

export class KlingPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KlingPayloadError";
  }
}

const klingV3TextToVideoFieldIds = [
  "prompt",
  "resolution",
  "aspectRatio",
  "duration",
  "generateAudio",
  "callbackUrl",
] as const;

export function validateKlingV3TextToVideoModel({
  model,
  spec,
}: GenerationProviderModelValidationInput): string[] {
  const adapter = klingV3TextToVideoAdapter;
  const issues: string[] = [];

  if (model.providerId !== klingProviderId || model.type !== "video") {
    issues.push(
      `Adapter ${adapter} is not compatible with ${model.providerId}/${model.type}`,
    );
  }

  if (spec.providerModelId !== klingProviderModelId) {
    issues.push(
      `Adapter ${adapter} requires providerModelId ${klingProviderModelId}`,
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== klingTextToVideoPath
  ) {
    issues.push(
      `Adapter ${adapter} requires POST ${klingTextToVideoPath} endpoint`,
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    !hasExactProviderPath(spec.modelParameter.path, ["model_name"])
  ) {
    issues.push(
      `Adapter ${adapter} requires spec-sourced model parameter at model_name`,
    );
  }

  if (spec.transforms.length > 0) {
    issues.push(`Adapter ${adapter} does not support transforms`);
  }

  const actualFieldIds = spec.fields.map((field) => field.id);
  const unexpectedFieldIds = actualFieldIds.filter(
    (fieldId) =>
      !klingV3TextToVideoFieldIds.includes(
        fieldId as (typeof klingV3TextToVideoFieldIds)[number],
      ),
  );
  const missingFieldIds = klingV3TextToVideoFieldIds.filter(
    (fieldId) => !actualFieldIds.includes(fieldId),
  );

  if (
    actualFieldIds.length !== klingV3TextToVideoFieldIds.length ||
    missingFieldIds.length > 0 ||
    unexpectedFieldIds.length > 0
  ) {
    issues.push(
      `Adapter ${adapter} requires exactly fields ${klingV3TextToVideoFieldIds.join(", ")}`,
    );
  }

  const fields = new Map(spec.fields.map((field) => [field.id, field]));
  const prompt = fields.get("prompt");
  const resolution = fields.get("resolution");
  const aspectRatio = fields.get("aspectRatio");
  const duration = fields.get("duration");
  const generateAudio = fields.get("generateAudio");
  const callbackUrl = fields.get("callbackUrl");

  validateKlingFieldBase({
    adapter,
    field: prompt,
    fieldId: "prompt",
    providerPath: ["prompt"],
    valueKind: "string",
    issues,
  });
  if (prompt) {
    if (!prompt.required || prompt.maxLength !== 2500) {
      issues.push(
        `Adapter ${adapter} field prompt must be required with maxLength 2500`,
      );
    }
    validateNoProviderValueMap(adapter, prompt, issues);
  }

  validateKlingFieldBase({
    adapter,
    field: resolution,
    fieldId: "resolution",
    providerPath: ["mode"],
    valueKind: "string",
    issues,
  });
  if (
    resolution &&
    (resolution.componentKind !== "hidden" ||
      resolution.defaultValue !== "1080p" ||
      !hasExactFieldOptions(resolution, ["1080p"]) ||
      !hasExactProviderValueMap(resolution, [
        { canonicalValue: "1080p", providerValue: "pro" },
      ]))
  ) {
    issues.push(
      `Adapter ${adapter} field resolution must be hidden, fix 1080p, and map it to pro`,
    );
  }

  validateKlingFieldBase({
    adapter,
    field: aspectRatio,
    fieldId: "aspectRatio",
    providerPath: ["aspect_ratio"],
    valueKind: "string",
    issues,
  });
  if (
    aspectRatio &&
    (aspectRatio.defaultValue !== "16:9" ||
      !hasExactFieldOptions(aspectRatio, supportedAspectRatios))
  ) {
    issues.push(
      `Adapter ${adapter} field aspectRatio must default to 16:9 and support exactly 16:9, 9:16, and 1:1`,
    );
  }
  if (aspectRatio) {
    validateNoProviderValueMap(adapter, aspectRatio, issues);
  }

  const durations = Array.from({ length: 13 }, (_, index) => index + 3);
  validateKlingFieldBase({
    adapter,
    field: duration,
    fieldId: "duration",
    providerPath: ["duration"],
    valueKind: "integer",
    issues,
  });
  if (
    duration &&
    (duration.defaultValue !== 5 ||
      duration.min !== 3 ||
      duration.max !== 15 ||
      !hasExactFieldOptions(duration, durations) ||
      !hasExactProviderValueMap(
        duration,
        durations.map((value) => ({
          canonicalValue: value,
          providerValue: String(value),
        })),
      ))
  ) {
    issues.push(
      `Adapter ${adapter} field duration must default to 5 and support integers 3 through 15 mapped to strings`,
    );
  }

  validateKlingFieldBase({
    adapter,
    field: generateAudio,
    fieldId: "generateAudio",
    providerPath: ["sound"],
    valueKind: "boolean",
    issues,
  });
  if (
    generateAudio &&
    (generateAudio.defaultValue !== false ||
      !hasExactFieldOptions(generateAudio, [false, true]) ||
      !hasExactProviderValueMap(generateAudio, [
        { canonicalValue: false, providerValue: "off" },
        { canonicalValue: true, providerValue: "on" },
      ]))
  ) {
    issues.push(
      `Adapter ${adapter} field generateAudio must default to false and map false to off and true to on`,
    );
  }

  validateKlingFieldBase({
    adapter,
    field: callbackUrl,
    fieldId: "callbackUrl",
    providerPath: ["callback_url"],
    valueKind: "string",
    issues,
  });
  if (callbackUrl) {
    validateNoProviderValueMap(adapter, callbackUrl, issues);
  }

  return issues;
}

export function buildKlingVideoTaskRequest({
  spec,
  input,
}: KlingVideoTaskBuildInput): KlingVideoTaskRequest {
  assertKlingSpec(spec);
  validateKlingInput(input);

  const payload: Record<string, unknown> = {};
  const payloadBuilder = new ModelFieldPayloadBuilder(payload);

  payloadBuilder.setProviderValue(
    spec.modelParameter.path,
    spec.providerModelId,
  );
  payloadBuilder.applyFieldValues({
    fields: spec.fields,
    values: new Map<string, ModelFieldPayloadValue>([
      ["prompt", input.submittedInput.prompt.trim()],
      ["resolution", input.submittedInput.resolution],
      ["aspectRatio", input.submittedInput.aspectRatio],
      ["duration", input.submittedInput.duration],
      ["generateAudio", input.submittedInput.generateAudio],
      ["callbackUrl", input.callbackUrl],
    ]),
  });
  payloadBuilder.setProviderValue(["external_task_id"], input.jobId);

  return payload as KlingVideoTaskRequest;
}

export function parseKlingCreateVideoTaskResponse(
  value: unknown,
  providerModelId: string,
): CreateVideoTaskResult {
  if (!isJsonObject(value) || !isFiniteNumber(value.code)) {
    throw malformedKlingResponse("create response was malformed");
  }

  const requestId = readNonEmptyString(value.request_id);

  if (value.code !== 0) {
    throw new ProviderHttpError("Kling", "request failed", {
      statusCode: null,
      code: String(value.code),
      providerMessage: readNonEmptyString(value.message),
      requestId,
    });
  }

  if (!isJsonObject(value.data)) {
    throw malformedKlingResponse("create response was malformed", requestId);
  }

  const providerTaskId = readNonEmptyString(value.data.task_id);

  if (!providerTaskId) {
    throw malformedKlingResponse("create response was malformed", requestId);
  }

  return {
    provider: "kling",
    providerTaskId,
    providerModelId,
  };
}

export function normalizeKlingVideoTaskResult(
  value: unknown,
  providerModelId: string,
): GenerationProviderTaskResult {
  if (providerModelId !== klingProviderModelId || !isJsonObject(value)) {
    throw malformedKlingResponse("callback payload was malformed");
  }

  const providerTaskId = readNonEmptyString(value.task_id);
  const status = toGenerationProviderTaskStatus(value.task_status);

  if (!providerTaskId || !status) {
    throw malformedKlingResponse("callback payload was malformed");
  }

  const videoUrl =
    status === "succeeded" ? parseKlingVideoUrl(value.task_result) : null;

  if (status === "succeeded" && !videoUrl) {
    throw malformedKlingResponse(
      "successful callback did not include a usable video URL",
    );
  }

  const providerMessage = readNonEmptyString(value.task_status_msg);

  return {
    provider: "kling",
    providerTaskId,
    providerModelId,
    status,
    videoUrl,
    usage: null,
    createdAt: readFiniteNumber(value.created_at),
    updatedAt: readFiniteNumber(value.updated_at),
    providerError:
      status === "failed"
        ? {
            code: null,
            message: providerMessage,
          }
        : null,
  };
}

function validateKlingFieldBase({
  adapter,
  field,
  fieldId,
  providerPath,
  valueKind,
  issues,
}: {
  adapter: typeof klingV3TextToVideoAdapter;
  field: GenerationFieldSpec | undefined;
  fieldId: string;
  providerPath: string[];
  valueKind: GenerationFieldSpec["valueKind"];
  issues: string[];
}) {
  if (!field) {
    return;
  }

  if (
    field.valueKind !== valueKind ||
    !hasExactProviderPath(field.providerPath, providerPath)
  ) {
    issues.push(
      `Adapter ${adapter} field ${fieldId} must use ${valueKind} at ${providerPath.join(".")}`,
    );
  }

  if (field.omitWhenDefault) {
    issues.push(
      `Adapter ${adapter} field ${fieldId} must set omitWhenDefault to false`,
    );
  }
}

function validateNoProviderValueMap(
  adapter: typeof klingV3TextToVideoAdapter,
  field: GenerationFieldSpec,
  issues: string[],
) {
  if (field.providerValueMap !== undefined) {
    issues.push(
      `Adapter ${adapter} field ${field.id} does not support providerValueMap`,
    );
  }
}

function hasExactProviderPath(
  actual: readonly (string | number)[] | undefined,
  expected: readonly (string | number)[],
) {
  return stableJson(actual) === stableJson(expected);
}

function hasExactFieldOptions(
  field: GenerationFieldSpec,
  expectedValues: readonly JsonPrimitive[],
) {
  return hasExactJsonValues(
    field.options?.map((option) => option.value),
    expectedValues,
  );
}

function hasExactProviderValueMap(
  field: GenerationFieldSpec,
  expected: readonly {
    canonicalValue: JsonPrimitive;
    providerValue: JsonPrimitive;
  }[],
) {
  const actual = field.providerValueMap?.map((entry) => stableJson(entry));
  const expectedEntries = expected.map((entry) => stableJson(entry));

  return hasExactStringValues(actual, expectedEntries);
}

function hasExactJsonValues(
  actual: readonly JsonPrimitive[] | undefined,
  expected: readonly JsonPrimitive[],
) {
  return hasExactStringValues(
    actual?.map((value) => stableJson(value)),
    expected.map((value) => stableJson(value)),
  );
}

function hasExactStringValues(
  actual: readonly string[] | undefined,
  expected: readonly string[],
) {
  if (!actual || actual.length !== expected.length) {
    return false;
  }

  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();

  return sortedActual.every((value, index) => {
    return value === sortedExpected[index];
  });
}

function assertKlingSpec(spec: KlingVideoTaskBuildInput["spec"]) {
  if (
    spec.provider !== klingProviderId ||
    spec.providerModelId !== klingProviderModelId
  ) {
    throw new KlingPayloadError(
      "Kling payloads require the Kling 3.0 text-to-video model spec",
    );
  }

  if (
    spec.endpoint.method !== "POST" ||
    spec.endpoint.path !== klingTextToVideoPath
  ) {
    throw new KlingPayloadError(
      "Kling 3.0 text-to-video model spec has an unsupported endpoint",
    );
  }

  if (
    spec.modelParameter.source !== "spec" ||
    spec.modelParameter.path.length !== 1 ||
    spec.modelParameter.path[0] !== "model_name"
  ) {
    throw new KlingPayloadError(
      "Kling 3.0 model spec must provide model_name from the spec",
    );
  }
}

function validateKlingInput(input: KlingVideoTaskBuildInput["input"]) {
  const prompt = input.submittedInput.prompt.trim();

  if (!prompt) {
    throw new KlingPayloadError("Kling input requires a prompt");
  }

  if (prompt.length > 2_500) {
    throw new KlingPayloadError("Kling prompt must be at most 2500 characters");
  }

  if (input.submittedInput.resolution !== "1080p") {
    throw new KlingPayloadError("Kling 3.0 Pro only supports 1080p output");
  }

  if (
    !supportedAspectRatios.some(
      (aspectRatio) => aspectRatio === input.submittedInput.aspectRatio,
    )
  ) {
    throw new KlingPayloadError("Kling input has an unsupported aspect ratio");
  }

  if (
    !Number.isInteger(input.submittedInput.duration) ||
    input.submittedInput.duration < 3 ||
    input.submittedInput.duration > 15
  ) {
    throw new KlingPayloadError(
      "Kling duration must be an integer from 3 through 15 seconds",
    );
  }

  if (typeof input.submittedInput.generateAudio !== "boolean") {
    throw new KlingPayloadError("Kling sound setting must be a boolean");
  }

  if (input.attachmentMedia.length > 0) {
    throw new KlingPayloadError(
      "Kling text-to-video does not support attachment media",
    );
  }

  if (!input.jobId.trim()) {
    throw new KlingPayloadError("Kling input requires an external task id");
  }

  if (!isHttpUrl(input.callbackUrl)) {
    throw new KlingPayloadError("Kling input requires an HTTP callback URL");
  }
}

function toGenerationProviderTaskStatus(
  value: unknown,
): GenerationProviderTaskStatus | null {
  switch (value as KlingProviderTaskStatus) {
    case "submitted":
      return "queued";
    case "processing":
      return "running";
    case "succeed":
      return "succeeded";
    case "failed":
      return "failed";
    default:
      return null;
  }
}

function parseKlingVideoUrl(taskResult: unknown): string | null {
  if (!isJsonObject(taskResult) || !Array.isArray(taskResult.videos)) {
    return null;
  }

  const firstVideo = taskResult.videos[0];

  if (!isJsonObject(firstVideo)) {
    return null;
  }

  const url = readNonEmptyString(firstVideo.url);

  return url && isHttpUrl(url) ? url : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function readFiniteNumber(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function malformedKlingResponse(
  message: string,
  requestId: string | null = null,
) {
  return new ProviderHttpError("Kling", message, {
    statusCode: null,
    code: null,
    providerMessage: null,
    requestId,
  });
}

function stableJson(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

import type { AttachmentMediaRole } from "../generation-attachment-media/dto.ts";
import type { GenerationValidationRule } from "./validation-rules.ts";
export type { GenerationValidationRule } from "./validation-rules.ts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type GenerationProviderId = "byteplus" | "google" | "kling";

export const generationModelTypes = ["video", "image"] as const;
export type GenerationModelType = (typeof generationModelTypes)[number];

export type GenerationPublicationStatus = "draft" | "published" | "archived";

export const canonicalVideoFieldIds = [
  "aspectRatio",
  "resolution",
  "prompt",
  "duration",
  "generateAudio",
  "callbackUrl",
] as const;

export type CanonicalVideoFieldId = (typeof canonicalVideoFieldIds)[number];

export const canonicalImageFieldIds = [
  "prompt",
  "resolution",
  "aspectRatio",
] as const;

export type CanonicalImageFieldId = (typeof canonicalImageFieldIds)[number];

export type GenerationFieldId =
  | CanonicalVideoFieldId
  | CanonicalImageFieldId
  | (string & {});

export type GenerationComponentKind =
  | "hidden"
  | "promptTextarea"
  | "textarea"
  | "textInput"
  | "select"
  | "toggle"
  | "numberInput"
  | "slider"
  | "mediaList"
  | "storyboardList"
  | "cameraControl";

export type GenerationFieldValueKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export type GenerationTransformKind = "seedanceContentArray";
export type GenerationProviderPathSegment = string | number;
export type NonEmptyArray<T> = [T, ...T[]];

export type GenerationFieldOption = {
  label: string;
  value: string | number | boolean;
  description?: string;
};

export type GenerationProviderValueMapEntry = {
  canonicalValue: JsonPrimitive;
  providerValue: JsonPrimitive;
};

export type MediaConstraints = {
  mimeTypes: string[];
  extensions: string[];
  maxFileSizeBytes?: number;
  maxTotalFileSizeBytes?: number;
  minDimensionPx?: number;
  maxDimensionPx?: number;
  minAspectRatio?: number;
  maxAspectRatio?: number;
  minDurationSec?: number;
  maxDurationSec?: number;
  maxTotalDurationSec?: number;
  minTotalPixels?: number;
  maxTotalPixels?: number;
  minFps?: number;
  maxFps?: number;
};

type GenerationFieldSpecBase = {
  id: GenerationFieldId;
  label: string;
  description?: string;
  componentKind: GenerationComponentKind;
  valueKind: GenerationFieldValueKind;
  required: boolean;
  advanced: boolean;
  defaultValue?: JsonValue;
  providerPath?: GenerationProviderPathSegment[];
  providerValueMap?: GenerationProviderValueMapEntry[];
  omitWhenEmpty: boolean;
  omitWhenDefault: boolean;
  options?: GenerationFieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  arrayMin?: number;
  arrayMax?: number;
  mediaConstraints?: MediaConstraints;
  notes: string[];
};

export type GenerationAttachmentMediaFieldSpec = Omit<
  GenerationFieldSpecBase,
  "componentKind" | "valueKind"
> & {
  componentKind: "mediaList";
  valueKind: "array";
  mediaRoleCapabilities: NonEmptyArray<AttachmentMediaRole>;
};

export type GenerationNonAttachmentMediaFieldSpec = Omit<
  GenerationFieldSpecBase,
  "componentKind"
> & {
  componentKind: Exclude<GenerationComponentKind, "mediaList">;
  mediaRoleCapabilities?: never;
};

export type GenerationFieldSpec =
  | GenerationAttachmentMediaFieldSpec
  | GenerationNonAttachmentMediaFieldSpec;

export type GenerationFieldGroup = {
  id: string;
  label: string;
  description?: string;
  fieldIds: NonEmptyArray<GenerationFieldId>;
  advanced: boolean;
};

export type GenerationEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
};

export type GenerationModelParameter = {
  path: NonEmptyArray<GenerationProviderPathSegment>;
  source: "spec" | "runtime";
};

export type GenerationTransform = {
  kind: GenerationTransformKind;
};

type GenerationModelSpecBase = {
  schemaVersion: 1;
  id: string;
  provider: GenerationProviderId;
  providerModelId: string | null;
  displayName: string;
  description?: string;
  status: GenerationPublicationStatus;
  sourceUrls: string[];
  endpoint: GenerationEndpoint;
  modelParameter: GenerationModelParameter;
  fields: NonEmptyArray<GenerationFieldSpec>;
  groups: NonEmptyArray<GenerationFieldGroup>;
  transforms: GenerationTransform[];
  validationRules: GenerationValidationRule[];
};

export type VideoModelSpec = GenerationModelSpecBase & { type: "video" };

export type ImageModelSpec = GenerationModelSpecBase & { type: "image" };

export type GenerationModelSpec = VideoModelSpec | ImageModelSpec;

export type PublishedGenerationModelSummary = {
  id: string;
  providerId: GenerationProviderId;
  providerName: string;
  displayName: string;
  type: GenerationModelType;
  latestSpecId: string;
  latestSpecVersion: number;
  spec: GenerationModelSpec;
};

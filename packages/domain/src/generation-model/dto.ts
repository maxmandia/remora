import type { AttachmentMediaRole } from "../generation-attachment-media/dto.ts";
import type { GenerationValidationRule } from "./validation-rules.ts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type GenerationProviderId = "byteplus" | "kling";

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
export type VideoFieldId = CanonicalVideoFieldId | (string & {});

export const canonicalImageFieldIds = [
  "prompt",
  "resolution",
  "aspectRatio",
] as const;

export type CanonicalImageFieldId = (typeof canonicalImageFieldIds)[number];

export type VideoComponentKind =
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

export type VideoFieldValueKind =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

export type VideoTransformKind = "seedanceContentArray";
export type VideoValidationRule = GenerationValidationRule;
export type VideoProviderPathSegment = string | number;
export type NonEmptyArray<T> = [T, ...T[]];

export type VideoFieldOption = {
  label: string;
  value: string | number | boolean;
  description?: string;
};

export type VideoProviderValueMapEntry = {
  canonicalValue: JsonPrimitive;
  providerValue: JsonPrimitive;
};

export type MediaConstraints = {
  mimeTypes: string[];
  extensions: string[];
  maxFileSizeBytes?: number;
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

type VideoFieldSpecBase = {
  id: VideoFieldId;
  label: string;
  description?: string;
  componentKind: VideoComponentKind;
  valueKind: VideoFieldValueKind;
  required: boolean;
  advanced: boolean;
  defaultValue?: JsonValue;
  providerPath?: VideoProviderPathSegment[];
  providerValueMap?: VideoProviderValueMapEntry[];
  omitWhenEmpty: boolean;
  omitWhenDefault: boolean;
  options?: VideoFieldOption[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  arrayMin?: number;
  arrayMax?: number;
  mediaConstraints?: MediaConstraints;
  notes: string[];
};

export type VideoAttachmentMediaFieldSpec = Omit<
  VideoFieldSpecBase,
  "componentKind" | "valueKind"
> & {
  componentKind: "mediaList";
  valueKind: "array";
  mediaRoleCapabilities: NonEmptyArray<AttachmentMediaRole>;
};

export type VideoNonAttachmentMediaFieldSpec = Omit<
  VideoFieldSpecBase,
  "componentKind"
> & {
  componentKind: Exclude<VideoComponentKind, "mediaList">;
  mediaRoleCapabilities?: never;
};

export type VideoFieldSpec =
  | VideoAttachmentMediaFieldSpec
  | VideoNonAttachmentMediaFieldSpec;

export type VideoFieldGroup = {
  id: string;
  label: string;
  description?: string;
  fieldIds: NonEmptyArray<VideoFieldId>;
  advanced: boolean;
};

export type VideoEndpoint = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
};

export type VideoModelParameter = {
  path: NonEmptyArray<VideoProviderPathSegment>;
  source: "spec" | "runtime";
};

export type VideoTransform = {
  kind: VideoTransformKind;
};

export type VideoModelSpec = {
  schemaVersion: 1;
  id: string;
  provider: GenerationProviderId;
  providerModelId: string | null;
  displayName: string;
  description?: string;
  type: "video";
  status: GenerationPublicationStatus;
  sourceUrls: string[];
  endpoint: VideoEndpoint;
  modelParameter: VideoModelParameter;
  fields: NonEmptyArray<VideoFieldSpec>;
  groups: NonEmptyArray<VideoFieldGroup>;
  transforms: VideoTransform[];
  validationRules: VideoValidationRule[];
};

export type GenerationModelSpec = VideoModelSpec;

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

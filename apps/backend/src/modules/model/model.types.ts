import type { GenerationValidationRule } from "@remora/domain/generation-model/validation-rules";

import type { AttachmentMediaRole } from "../generation-attachment-media/schema/table.ts";
import type {
  GenerationModelRateLimitConditions,
  GenerationRateLimitBucketKind,
  GenerationRateLimitWindowAlignment,
} from "../model_rate_limits/model_rate_limits.types.ts";
import type {
  GenerationModelRateComponent,
  GenerationModelRateConditions,
  GenerationModelRateFinalQuantitySource,
  GenerationModelRateQuantitySource,
  GenerationModelRateQuantityUnit,
} from "../model_rates/model_rates.types.ts";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type GenerationProviderId = "byteplus" | "kling";
export const generationModelTypes = ["video", "image"] as const;
export type GenerationModelType = (typeof generationModelTypes)[number];
export type GenerationPublicationStatus = "draft" | "published" | "archived";
export const generationModelAdapters = [
  "byteplus_seedance_video",
  "kling_v3_text_to_video",
] as const;
export type GenerationModelAdapter = (typeof generationModelAdapters)[number];
export type GenerationModelRateLimitMode =
  | "unconfigured"
  | "enforced"
  | "unlimited";

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

export type VideoTransformKind = "seedanceContentArray";
export type VideoValidationRule = GenerationValidationRule;
export type VideoProviderPathSegment = string | number;

// TODO: Not the right home for this
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

// Media-physical restrictions for an attachment media field (images/videos/audio).
// Distinct from the generic arrayMin/arrayMax/min/max bounds on VideoFieldSpec,
// which apply to many non-media field kinds. All measurement fields are optional;
// only mimeTypes/extensions are required so the picker always has something to
// accept against.
export type MediaConstraints = {
  mimeTypes: string[]; // for <input accept> + matching, e.g. "image/png"
  extensions: string[]; // lowercase, dot-prefixed, e.g. ".png" — robust when file.type is empty
  maxFileSizeBytes?: number; // per file
  minDimensionPx?: number; // applies to width and height
  maxDimensionPx?: number;
  minAspectRatio?: number; // width / height
  maxAspectRatio?: number;
  minDurationSec?: number; // per file (video/audio)
  maxDurationSec?: number;
  maxTotalDurationSec?: number; // across all files of this kind
  minTotalPixels?: number; // video
  maxTotalPixels?: number;
  minFps?: number; // video
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

export type VideoModelConfiguration = Omit<
  VideoModelSpec,
  "schemaVersion" | "id" | "provider" | "displayName" | "type" | "status"
>;

export type GenerationModelRateDefinition = {
  id: string;
  component: GenerationModelRateComponent;
  quantitySource: GenerationModelRateQuantitySource;
  finalQuantitySource: GenerationModelRateFinalQuantitySource | null;
  quantityUnit: GenerationModelRateQuantityUnit;
  unitQuantity: number;
  unitPriceUsdMicros: number;
  conditions: GenerationModelRateConditions;
};

export type GenerationRateLimitBucketDefinition = {
  id: string;
  kind: GenerationRateLimitBucketKind;
  maxValue: number;
  windowSeconds: number | null;
  windowAlignment: GenerationRateLimitWindowAlignment | null;
};

export type GenerationModelRateLimitDefinition = {
  id: string;
  conditions: GenerationModelRateLimitConditions;
  bucket: GenerationRateLimitBucketDefinition;
};

export type GenerationModelDefinitionSpec = {
  id: string;
  version: number;
  schemaVersion: 1;
  status: GenerationPublicationStatus;
  adapter: GenerationModelAdapter | null;
  configuration: VideoModelConfiguration;
  rates: GenerationModelRateDefinition[];
  rateLimits:
    | { mode: "unconfigured" }
    | { mode: "unlimited" }
    | {
        mode: "enforced";
        rules: GenerationModelRateLimitDefinition[];
      };
};

export type ModelDefinitionV1 = {
  schemaVersion: 1;
  model: {
    id: string;
    providerId: GenerationProviderId;
    displayName: string;
    type: GenerationModelType;
  };
  specs: NonEmptyArray<GenerationModelDefinitionSpec>;
};

export type NormalizedModelDefinitionSpec = Omit<
  GenerationModelDefinitionSpec,
  "configuration"
> & {
  spec: VideoModelSpec;
};

export type NormalizedModelDefinition = Omit<ModelDefinitionV1, "specs"> & {
  model: ModelDefinitionV1["model"] & {
    status: GenerationPublicationStatus;
  };
  specs: NonEmptyArray<NormalizedModelDefinitionSpec>;
};

export type ModelCatalogState = {
  providerExists: boolean;
  model: {
    id: string;
    providerId: string;
    displayName: string;
    type: GenerationModelType;
    status: GenerationPublicationStatus;
  } | null;
  specs: Array<{
    id: string;
    modelId: string;
    version: number;
    schemaVersion: number;
    status: GenerationPublicationStatus;
    adapter: GenerationModelAdapter | null;
    rateLimitMode: GenerationModelRateLimitMode;
    spec: GenerationModelSpec;
    publishedAt: Date | null;
    rates: GenerationModelRateDefinition[];
    rateLimits: GenerationModelRateLimitDefinition[];
  }>;
};

export type ModelDefinitionChange = {
  action: "create" | "update" | "archive" | "publish" | "remove";
  entity: "model" | "spec" | "rate" | "rate_limit" | "rate_limit_bucket";
  id: string;
  fields: string[];
};

export type ModelDefinitionPlan = {
  definition: NormalizedModelDefinition;
  changes: ModelDefinitionChange[];
  hasRemovals: boolean;
  issues: string[];
};

export class ModelDefinitionValidationError extends Error {
  readonly code = "MODEL_DEFINITION_VALIDATION_ERROR";

  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(issues.length > 0 ? `${message}: ${issues.join("; ")}` : message);
    this.name = "ModelDefinitionValidationError";
  }
}

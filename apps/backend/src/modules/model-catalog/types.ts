export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type ModelCatalogProvider = "byteplus" | "kling";
export type ModelCatalogModelType = "video";
export type ModelCatalogPublicationStatus = "draft" | "published" | "archived";

export type PublishedGenerationModelSummary = {
  id: string;
  providerId: ModelCatalogProvider;
  providerName: string;
  displayName: string;
  type: ModelCatalogModelType;
  latestSpecId: string;
  latestSpecVersion: number;
  spec: ModelCatalogSpec;
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
  "prompt",
  "duration",
  "generateAudio",
  "callbackUrl",
] as const;

export type CanonicalVideoFieldId = (typeof canonicalVideoFieldIds)[number];
export type VideoFieldId = CanonicalVideoFieldId | (string & {});

export type VideoTransformKind = "seedanceContentArray";
export type VideoValidationRule =
  | "seedance20ContentRules"
  | "klingTextToVideoRules";
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

export type VideoFieldSpec = {
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
  notes: string[];
};

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
  provider: ModelCatalogProvider;
  providerModelId: string | null;
  displayName: string;
  description?: string;
  type: ModelCatalogModelType;
  status: ModelCatalogPublicationStatus;
  sourceUrls: string[];
  endpoint: VideoEndpoint;
  modelParameter: VideoModelParameter;
  fields: NonEmptyArray<VideoFieldSpec>;
  groups: NonEmptyArray<VideoFieldGroup>;
  transforms: VideoTransform[];
  validationRules: VideoValidationRule[];
};

export type ModelCatalogSpec = VideoModelSpec;

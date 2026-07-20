import type {
  GenerationModelSpec,
  GenerationModelType,
  GenerationProviderId,
  GenerationPublicationStatus,
  NonEmptyArray,
  VideoModelSpec,
} from "@remora/domain/generation-model/dto";
export {
  canonicalImageFieldIds,
  canonicalVideoFieldIds,
  generationModelTypes,
} from "@remora/domain/generation-model/dto";
export type {
  CanonicalImageFieldId,
  CanonicalVideoFieldId,
  GenerationModelSpec,
  GenerationModelType,
  GenerationProviderId,
  GenerationPublicationStatus,
  JsonPrimitive,
  JsonValue,
  MediaConstraints,
  NonEmptyArray,
  PublishedGenerationModelSummary,
  VideoAttachmentMediaFieldSpec,
  VideoComponentKind,
  VideoEndpoint,
  VideoFieldGroup,
  VideoFieldId,
  VideoFieldOption,
  VideoFieldSpec,
  VideoFieldValueKind,
  VideoModelParameter,
  VideoModelSpec,
  VideoNonAttachmentMediaFieldSpec,
  VideoProviderPathSegment,
  VideoProviderValueMapEntry,
  VideoTransform,
  VideoTransformKind,
  VideoValidationRule,
} from "@remora/domain/generation-model/dto";
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

export const generationModelAdapters = [
  "byteplus_seedance_video",
  "kling_v3_text_to_video",
] as const;
export type GenerationModelAdapter = (typeof generationModelAdapters)[number];
export type GenerationModelRateLimitMode =
  | "unconfigured"
  | "enforced"
  | "unlimited";

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

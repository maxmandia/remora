import { generationValidationRuleSchema } from "@remora/domain/generation-model/validation-rules";
import { z } from "zod";

import { attachmentMediaRoles } from "../generation-attachment-media/schema/table.ts";
import { validateGenerationModelAdapter } from "../generation/providers/provider.utils.ts";
import {
  generationRateLimitBucketKinds,
  generationRateLimitWindowAlignments,
  type GenerationModelRateLimitConditions,
} from "../model_rate_limits/model_rate_limits.types.ts";
import {
  generationModelRateComponents,
  generationModelRateFinalQuantitySources,
  generationModelRateQuantitySources,
  generationModelRateQuantityUnits,
  type GenerationModelRateConditions,
} from "../model_rates/model_rates.types.ts";
import type {
  GenerationModelDefinitionSpec,
  GenerationFieldSpec,
  GenerationModelRateDefinition,
  GenerationModelRateLimitDefinition,
  GenerationModelSpec,
  ImageModelSpec,
  JsonPrimitive,
  JsonValue,
  ModelCatalogState,
  ModelDefinitionChange,
  ModelDefinitionPlan,
  ModelDefinitionV1,
  NormalizedModelDefinition,
  NormalizedModelDefinitionSpec,
  VideoModelSpec,
} from "./model.types.ts";
import {
  generationModelAdapters,
  ModelDefinitionValidationError,
} from "./model.types.ts";

const generationProviderIdSchema = z.enum(["byteplus", "google", "kling"]);
const generationModelTypeSchema = z.enum(["video", "image"]);
const generationPublicationStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);
const generationModelAdapterSchema = z.enum(generationModelAdapters);
const generationComponentKindSchema = z.enum([
  "hidden",
  "promptTextarea",
  "textarea",
  "textInput",
  "select",
  "toggle",
  "numberInput",
  "slider",
  "mediaList",
  "storyboardList",
  "cameraControl",
]);
const generationFieldValueKindSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
]);
const jsonPrimitiveSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    jsonPrimitiveSchema,
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const generationFieldOptionSchema = z
  .object({
    label: z.string().min(1),
    value: jsonPrimitiveSchema,
    description: z.string().min(1).optional(),
  })
  .strict();
const generationProviderValueMapEntrySchema = z
  .object({
    canonicalValue: jsonPrimitiveSchema,
    providerValue: jsonPrimitiveSchema,
  })
  .strict();
const mediaConstraintsSchema = z
  .object({
    mimeTypes: z.array(z.string().min(1)).min(1),
    extensions: z.array(z.string().min(1)).min(1),
    maxFileSizeBytes: z.number().int().positive().optional(),
    maxTotalFileSizeBytes: z.number().int().positive().optional(),
    minDimensionPx: z.number().positive().optional(),
    maxDimensionPx: z.number().positive().optional(),
    minAspectRatio: z.number().positive().optional(),
    maxAspectRatio: z.number().positive().optional(),
    minDurationSec: z.number().nonnegative().optional(),
    maxDurationSec: z.number().positive().optional(),
    maxTotalDurationSec: z.number().positive().optional(),
    minTotalPixels: z.number().positive().optional(),
    maxTotalPixels: z.number().positive().optional(),
    minFps: z.number().positive().optional(),
    maxFps: z.number().positive().optional(),
  })
  .strict();
const generationFieldSpecSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    componentKind: generationComponentKindSchema,
    valueKind: generationFieldValueKindSchema,
    required: z.boolean(),
    advanced: z.boolean(),
    defaultValue: jsonValueSchema.optional(),
    providerPath: z
      .array(z.union([z.string(), z.number().int()]))
      .min(1)
      .optional(),
    providerValueMap: z
      .array(generationProviderValueMapEntrySchema)
      .min(1)
      .optional(),
    omitWhenEmpty: z.boolean(),
    omitWhenDefault: z.boolean(),
    options: z.array(generationFieldOptionSchema).min(1).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional(),
    arrayMin: z.number().int().nonnegative().optional(),
    arrayMax: z.number().int().nonnegative().optional(),
    mediaConstraints: mediaConstraintsSchema.optional(),
    mediaRoleCapabilities: z
      .array(z.enum(attachmentMediaRoles))
      .min(1)
      .optional(),
    notes: z.array(z.string()),
  })
  .strict();
const generationFieldGroupSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    fieldIds: z.array(z.string().min(1)).min(1),
    advanced: z.boolean(),
  })
  .strict();
const generationEndpointSchema = z
  .object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().startsWith("/"),
  })
  .strict();
const generationModelParameterSchema = z
  .object({
    path: z.array(z.union([z.string(), z.number().int()])).min(1),
    source: z.enum(["spec", "runtime"]),
  })
  .strict();
const generationTransformSchema = z
  .object({ kind: z.literal("seedanceContentArray") })
  .strict();
const generationModelConfigurationSchema = z
  .object({
    providerModelId: z.string().min(1).nullable(),
    description: z.string().min(1).optional(),
    sourceUrls: z.array(z.url()),
    endpoint: generationEndpointSchema,
    modelParameter: generationModelParameterSchema,
    fields: z.array(generationFieldSpecSchema).min(1),
    groups: z.array(generationFieldGroupSchema).min(1),
    transforms: z.array(generationTransformSchema),
    validationRules: z.array(generationValidationRuleSchema),
  })
  .strict();
const persistedGenerationModelSpecSchema = generationModelConfigurationSchema
  .extend({
    schemaVersion: z.literal(1),
    id: z.string().min(1),
    provider: generationProviderIdSchema,
    displayName: z.string().min(1),
    type: generationModelTypeSchema,
    status: generationPublicationStatusSchema,
  })
  .strict();
const stringConditionSchema = z.union([
  z.string().min(1),
  z.array(z.string().min(1)).min(1),
]);
const generationModelRateConditionsSchema = z
  .object({
    outputResolution: stringConditionSchema.optional(),
    inputVideoResolution: stringConditionSchema.optional(),
    inputIncludesVideo: z.boolean().optional(),
    nativeAudio: z.boolean().optional(),
    voiceControl: z.boolean().optional(),
  })
  .strict();
const generationModelRateDefinitionSchema = z
  .object({
    id: z.string().min(1),
    component: z.enum(generationModelRateComponents),
    quantitySource: z.enum(generationModelRateQuantitySources),
    finalQuantitySource: z
      .enum(generationModelRateFinalQuantitySources)
      .nullable(),
    quantityUnit: z.enum(generationModelRateQuantityUnits),
    unitQuantity: z.number().int().positive().safe(),
    unitPriceUsdMicros: z.number().int().nonnegative().safe(),
    conditions: generationModelRateConditionsSchema,
  })
  .strict();
const generationModelRateLimitConditionsSchema = z
  .object({ outputResolution: stringConditionSchema.optional() })
  .strict();
const generationRateLimitBucketDefinitionSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(generationRateLimitBucketKinds),
    maxValue: z.number().int().positive(),
    windowSeconds: z.number().int().positive().nullable(),
    windowAlignment: z.enum(generationRateLimitWindowAlignments).nullable(),
  })
  .strict();
const generationModelRateLimitDefinitionSchema = z
  .object({
    id: z.string().min(1),
    conditions: generationModelRateLimitConditionsSchema,
    bucket: generationRateLimitBucketDefinitionSchema,
  })
  .strict();
const generationModelDefinitionSpecSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().positive(),
    schemaVersion: z.literal(1),
    status: generationPublicationStatusSchema,
    adapter: generationModelAdapterSchema.nullable(),
    configuration: generationModelConfigurationSchema,
    rates: z.array(generationModelRateDefinitionSchema),
    rateLimits: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("unconfigured") }).strict(),
      z.object({ mode: z.literal("unlimited") }).strict(),
      z
        .object({
          mode: z.literal("enforced"),
          rules: z.array(generationModelRateLimitDefinitionSchema).min(1),
        })
        .strict(),
    ]),
  })
  .strict();
const modelDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    model: z
      .object({
        id: z.string().min(1),
        providerId: generationProviderIdSchema,
        displayName: z.string().min(1),
        type: generationModelTypeSchema,
      })
      .strict(),
    specs: z.array(generationModelDefinitionSpecSchema).min(1),
  })
  .strict();

const componentValueKinds = {
  hidden: null,
  promptTextarea: ["string"],
  textarea: ["string"],
  textInput: ["string"],
  select: ["string", "number", "integer", "boolean"],
  toggle: ["boolean"],
  numberInput: ["number", "integer"],
  slider: ["number", "integer"],
  mediaList: ["array"],
  storyboardList: ["array"],
  cameraControl: ["object"],
} as const;

const rateQuantityShapes = {
  output_duration_seconds: { component: "output_video", unit: "second" },
  input_video_duration_seconds: { component: "input_video", unit: "second" },
  input_image_count: { component: "input_image", unit: "image" },
  seedance_estimated_video_tokens: {
    component: "provider_video_tokens",
    unit: "token",
  },
  output_image_count: { component: "output_image", unit: "image" },
} as const;

export function parsePersistedGenerationModelSpec(
  value: unknown,
): GenerationModelSpec {
  const parsed = persistedGenerationModelSpecSchema.safeParse(value);

  if (!parsed.success) {
    throw new ModelDefinitionValidationError(
      "Persisted generation model spec is invalid",
      parsed.error.issues.map(formatZodIssue),
    );
  }

  const spec = parsed.data as GenerationModelSpec;
  const issues = validateGenerationModelSpec(spec);

  if (issues.length > 0) {
    throw new ModelDefinitionValidationError(
      "Persisted generation model spec is invalid",
      issues,
    );
  }

  return spec;
}

export function parseGenerationModelRateConditions(
  value: unknown,
): GenerationModelRateConditions {
  const parsed = generationModelRateConditionsSchema.safeParse(value);

  if (!parsed.success) {
    throw new ModelDefinitionValidationError(
      "Persisted generation model rate conditions are invalid",
      parsed.error.issues.map(formatZodIssue),
    );
  }

  return parsed.data;
}

export function parseGenerationModelRateLimitConditions(
  value: unknown,
): GenerationModelRateLimitConditions {
  const parsed = generationModelRateLimitConditionsSchema.safeParse(value);

  if (!parsed.success) {
    throw new ModelDefinitionValidationError(
      "Persisted generation model rate-limit conditions are invalid",
      parsed.error.issues.map(formatZodIssue),
    );
  }

  return parsed.data;
}

export function parsePersistedVideoModelSpec(value: unknown): VideoModelSpec {
  const spec = parsePersistedGenerationModelSpec(value);

  if (spec.type !== "video") {
    throw new ModelDefinitionValidationError(
      "Persisted video model spec is invalid",
      [`Expected video model spec, received ${spec.type}`],
    );
  }

  return spec;
}

export function parsePersistedImageModelSpec(value: unknown): ImageModelSpec {
  const spec = parsePersistedGenerationModelSpec(value);

  if (spec.type !== "image") {
    throw new ModelDefinitionValidationError(
      "Persisted image model spec is invalid",
      [`Expected image model spec, received ${spec.type}`],
    );
  }

  return spec;
}

export function validateModelDefinition(value: unknown): ModelDefinitionV1 {
  const parsed = modelDefinitionSchema.safeParse(value);

  if (!parsed.success) {
    throw new ModelDefinitionValidationError(
      "Model definition is invalid",
      parsed.error.issues.map(formatZodIssue),
    );
  }

  const definition = parsed.data as ModelDefinitionV1;
  const issues = validateModelDefinitionRules(definition);

  if (issues.length > 0) {
    throw new ModelDefinitionValidationError(
      "Model definition is invalid",
      issues,
    );
  }

  return definition;
}

export function normalizeModelDefinition(
  value: unknown,
): NormalizedModelDefinition {
  const definition = validateModelDefinition(value);
  const specs = definition.specs.map((definitionSpec) => ({
    ...definitionSpec,
    spec: toPersistedGenerationModelSpec(definition, definitionSpec),
  })) as unknown as NormalizedModelDefinition["specs"];

  return {
    schemaVersion: definition.schemaVersion,
    model: {
      ...definition.model,
      status: deriveModelStatus(definition.specs),
    },
    specs,
  };
}

export function buildModelDefinitionPlan({
  definition: value,
  current,
}: {
  definition: unknown;
  current: ModelCatalogState;
}): ModelDefinitionPlan {
  const definition = normalizeModelDefinition(value);
  const issues: string[] = [];
  const changes: ModelDefinitionChange[] = [];

  if (!current.providerExists) {
    issues.push(`Provider ${definition.model.providerId} is not registered`);
  }

  compareModel(definition, current, issues, changes);
  compareSpecs(definition, current, issues, changes);

  return {
    definition,
    changes,
    hasRemovals: changes.some((change) => change.action === "remove"),
    issues,
  };
}

export function renderModelDefinitionMigration(
  plan: ModelDefinitionPlan,
  options: { allowRemovals: boolean },
) {
  if (plan.issues.length > 0) {
    throw new ModelDefinitionValidationError(
      "Model definition cannot be applied",
      plan.issues,
    );
  }

  if (plan.hasRemovals && !options.allowRemovals) {
    throw new ModelDefinitionValidationError(
      "Model definition plan contains removals",
      ["Pass --allow-removals after reviewing the generated plan"],
    );
  }

  const { definition } = plan;
  const statements: string[] = [];
  statements.push(`DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = ${sqlLiteral(definition.model.providerId)}
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: ${sqlMessage(
      definition.model.providerId,
    )}';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = ${sqlLiteral(definition.model.id)}
      AND (
        "provider_id" <> ${sqlLiteral(definition.model.providerId)}
        OR "type" <> ${sqlLiteral(definition.model.type)}
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: ${sqlMessage(
      definition.model.id,
    )}';
  END IF;
END
$model_definition$`);
  statements.push(`INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  ${sqlLiteral(definition.model.id)},
  ${sqlLiteral(definition.model.providerId)},
  ${sqlLiteral(definition.model.displayName)},
  ${sqlLiteral(definition.model.type)},
  ${sqlLiteral(definition.model.status)}
)
ON CONFLICT ("id") DO UPDATE SET
  "display_name" = excluded."display_name",
  "status" = excluded."status",
  "updated_at" = now()`);

  for (const spec of definition.specs) {
    statements.push(renderSpecAssertion(spec));
    statements.push(`INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  ${sqlLiteral(spec.id)},
  ${sqlLiteral(definition.model.id)},
  ${spec.version},
  ${spec.schemaVersion},
  ${sqlLiteral(spec.status)},
  ${sqlNullableLiteral(spec.adapter)},
  ${sqlLiteral(spec.rateLimits.mode)},
  ${sqlJson(spec.spec)},
  ${spec.status === "draft" ? "NULL" : "now()"}
)
ON CONFLICT ("id") DO UPDATE SET
  "status" = excluded."status",
  "adapter" = CASE
    WHEN "generation_model_spec"."status" = 'draft' THEN excluded."adapter"
    ELSE "generation_model_spec"."adapter"
  END,
  "rate_limit_mode" = CASE
    WHEN "generation_model_spec"."status" = 'draft' THEN excluded."rate_limit_mode"
    ELSE "generation_model_spec"."rate_limit_mode"
  END,
  "spec" = CASE
    WHEN "generation_model_spec"."status" = 'draft' THEN excluded."spec"
    ELSE jsonb_set(
      "generation_model_spec"."spec",
      ARRAY['status'],
      to_jsonb(excluded."status"::text),
      true
    )
  END,
  "published_at" = CASE
    WHEN excluded."status" = 'draft' THEN NULL
    ELSE COALESCE("generation_model_spec"."published_at", now())
  END,
  "updated_at" = now()`);

    for (const rate of spec.rates) {
      statements.push(renderRateAssertion(spec.id, rate));
      statements.push(`INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  ${sqlLiteral(rate.id)},
  ${sqlLiteral(spec.id)},
  ${sqlLiteral(rate.component)},
  ${sqlLiteral(rate.quantitySource)},
  ${sqlNullableLiteral(rate.finalQuantitySource)},
  ${sqlLiteral(rate.quantityUnit)},
  ${rate.unitQuantity},
  ${rate.unitPriceUsdMicros},
  ${sqlJson(rate.conditions)}
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now()`);
    }

    if (options.allowRemovals) {
      statements.push(renderRemoveMissingRates(spec));
    }

    const rules =
      spec.rateLimits.mode === "enforced" ? spec.rateLimits.rules : [];

    for (const rule of rules) {
      statements.push(renderBucketAssertion(definition.model.providerId, rule));
      statements.push(`INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  ${sqlLiteral(rule.bucket.id)},
  ${sqlLiteral(definition.model.providerId)},
  ${sqlLiteral(rule.bucket.kind)},
  ${rule.bucket.maxValue},
  ${sqlNullableNumber(rule.bucket.windowSeconds)},
  ${sqlNullableLiteral(rule.bucket.windowAlignment)}
)
ON CONFLICT ("id") DO UPDATE SET
  "max_value" = excluded."max_value",
  "updated_at" = now()`);
      statements.push(renderRateLimitAssertion(spec.id, rule));
      statements.push(`INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  ${sqlLiteral(rule.id)},
  ${sqlLiteral(spec.id)},
  ${sqlLiteral(rule.bucket.id)},
  ${sqlJson(rule.conditions)}
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now()`);
    }

    if (options.allowRemovals) {
      statements.push(renderRemoveMissingRateLimits(spec, rules));
    }
  }

  return `${statements.join(";--> statement-breakpoint\n")} ;\n`;
}

function renderSpecAssertion(spec: NormalizedModelDefinitionSpec) {
  const comparableSpec = { ...spec.spec, status: "published" };

  return `DO $model_spec$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_spec"
    WHERE "id" = ${sqlLiteral(spec.id)}
      AND (
        "model_id" <> ${sqlLiteral(spec.spec.id)}
        OR "version" <> ${spec.version}
        OR "schema_version" <> ${spec.schemaVersion}
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM ${sqlNullableLiteral(spec.adapter)}
            OR "rate_limit_mode" <> ${sqlLiteral(spec.rateLimits.mode)}
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> ${sqlJson(comparableSpec)}
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: ${sqlMessage(
      spec.id,
    )}';
  END IF;
END
$model_spec$`;
}

function renderRateAssertion(
  modelSpecId: string,
  rate: GenerationModelRateDefinition,
) {
  return `DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = ${sqlLiteral(rate.id)}
      AND (
        "model_spec_id" <> ${sqlLiteral(modelSpecId)}
        OR "component" <> ${sqlLiteral(rate.component)}
        OR "quantity_source" <> ${sqlLiteral(rate.quantitySource)}
        OR "final_quantity_source" IS DISTINCT FROM ${sqlNullableLiteral(
          rate.finalQuantitySource,
        )}
        OR "quantity_unit" <> ${sqlLiteral(rate.quantityUnit)}
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: ${sqlMessage(
      rate.id,
    )}';
  END IF;
END
$model_rate$`;
}

function renderBucketAssertion(
  providerId: string,
  rule: GenerationModelRateLimitDefinition,
) {
  return `DO $rate_limit_bucket$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_rate_limit_bucket"
    WHERE "id" = ${sqlLiteral(rule.bucket.id)}
      AND (
        "provider_id" <> ${sqlLiteral(providerId)}
        OR "kind" <> ${sqlLiteral(rule.bucket.kind)}
        OR "window_seconds" IS DISTINCT FROM ${sqlNullableNumber(
          rule.bucket.windowSeconds,
        )}
        OR "window_alignment" IS DISTINCT FROM ${sqlNullableLiteral(
          rule.bucket.windowAlignment,
        )}
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: ${sqlMessage(
      rule.bucket.id,
    )}';
  END IF;
END
$rate_limit_bucket$`;
}

function renderRateLimitAssertion(
  modelSpecId: string,
  rule: GenerationModelRateLimitDefinition,
) {
  return `DO $model_rate_limit$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate_limit"
    WHERE "id" = ${sqlLiteral(rule.id)}
      AND (
        "model_spec_id" <> ${sqlLiteral(modelSpecId)}
        OR "bucket_id" <> ${sqlLiteral(rule.bucket.id)}
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: ${sqlMessage(
      rule.id,
    )}';
  END IF;
END
$model_rate_limit$`;
}

function renderRemoveMissingRates(spec: NormalizedModelDefinitionSpec) {
  const ids = spec.rates.map((rate) => sqlLiteral(rate.id));
  const predicate = ids.length > 0 ? `AND "id" NOT IN (${ids.join(", ")})` : "";
  return `DELETE FROM "generation_model_rate"
WHERE "model_spec_id" = ${sqlLiteral(spec.id)}
  ${predicate}`;
}

function renderRemoveMissingRateLimits(
  spec: NormalizedModelDefinitionSpec,
  rules: GenerationModelRateLimitDefinition[],
) {
  const ids = rules.map((rule) => sqlLiteral(rule.id));
  const predicate = ids.length > 0 ? `AND "id" NOT IN (${ids.join(", ")})` : "";
  return `DELETE FROM "generation_model_rate_limit"
WHERE "model_spec_id" = ${sqlLiteral(spec.id)}
  ${predicate}`;
}

function sqlJson(value: unknown) {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function sqlLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullableLiteral(value: string | null) {
  return value === null ? "NULL" : sqlLiteral(value);
}

function sqlNullableNumber(value: number | null) {
  return value === null ? "NULL" : String(value);
}

function sqlMessage(value: string) {
  return value.replaceAll("'", "''");
}

function validateModelDefinitionRules(definition: ModelDefinitionV1) {
  const issues: string[] = [];
  assertUnique(
    definition.specs.map((spec) => spec.id),
    "model spec id",
    issues,
  );
  assertUnique(
    definition.specs.map((spec) => String(spec.version)),
    "model spec version",
    issues,
  );

  const rateIds: string[] = [];
  const rateLimitIds: string[] = [];
  const buckets = new Map<string, string>();

  for (const definitionSpec of definition.specs) {
    const spec = toPersistedGenerationModelSpec(definition, definitionSpec);
    issues.push(
      ...validateGenerationModelSpec(spec).map(
        (issue) => `${definitionSpec.id}: ${issue}`,
      ),
    );
    validateAdapter(definition, definitionSpec, spec, issues);
    validateRates(definitionSpec, spec, issues);
    validateRateLimits(definitionSpec, spec, issues);
    rateIds.push(...definitionSpec.rates.map((rate) => rate.id));

    if (definitionSpec.rateLimits.mode === "enforced") {
      rateLimitIds.push(
        ...definitionSpec.rateLimits.rules.map((rule) => rule.id),
      );

      for (const rule of definitionSpec.rateLimits.rules) {
        const shape = stableJson(rule.bucket);
        const existingShape = buckets.get(rule.bucket.id);

        if (existingShape && existingShape !== shape) {
          issues.push(
            `Rate-limit bucket ${rule.bucket.id} has conflicting definitions`,
          );
        } else {
          buckets.set(rule.bucket.id, shape);
        }
      }
    }
  }

  assertUnique(rateIds, "rate id", issues);
  assertUnique(rateLimitIds, "rate-limit id", issues);

  return issues;
}

function validateGenerationModelSpec(spec: GenerationModelSpec) {
  const issues: string[] = [];
  const fieldIds = spec.fields.map((field) => field.id);
  assertUnique(fieldIds, "field id", issues);
  assertUnique(
    spec.groups.map((group) => group.id),
    "group id",
    issues,
  );

  const groupedFieldIds = spec.groups.flatMap((group) => group.fieldIds);
  assertUnique(groupedFieldIds, "group field reference", issues);

  for (const fieldId of fieldIds) {
    if (!groupedFieldIds.includes(fieldId)) {
      issues.push(`Field ${fieldId} is not assigned to a group`);
    }
  }

  for (const fieldId of groupedFieldIds) {
    if (!fieldIds.includes(fieldId)) {
      issues.push(`Group references unknown field ${fieldId}`);
    }
  }

  const providerPaths: string[] = [];

  for (const field of spec.fields) {
    validateField(field, issues);

    if (field.providerPath) {
      providerPaths.push(stableJson(field.providerPath));
    }
  }

  assertUnique(providerPaths, "provider path", issues);

  return issues;
}

function validateField(field: GenerationFieldSpec, issues: string[]) {
  const allowedValueKinds = componentValueKinds[field.componentKind];

  if (
    allowedValueKinds &&
    !allowedValueKinds.includes(field.valueKind as never)
  ) {
    issues.push(
      `Field ${field.id} component ${field.componentKind} cannot use ${field.valueKind}`,
    );
  }

  if (field.componentKind === "mediaList") {
    const capabilities = (
      field as GenerationFieldSpec & {
        mediaRoleCapabilities?: unknown;
      }
    ).mediaRoleCapabilities;

    if (!Array.isArray(capabilities)) {
      issues.push(`Media field ${field.id} must declare mediaRoleCapabilities`);
    } else if (capabilities.length === 0) {
      issues.push(
        `Media field ${field.id} must declare at least one mediaRoleCapability`,
      );
    }
  } else if ("mediaRoleCapabilities" in field) {
    issues.push(
      `Non-media field ${field.id} cannot declare mediaRoleCapabilities`,
    );
  }

  const defaultIsOmittedEmptyValue =
    field.omitWhenEmpty &&
    (field.defaultValue === "" || field.defaultValue === null);

  if (
    field.defaultValue !== undefined &&
    !defaultIsOmittedEmptyValue &&
    !matchesValueKind(field.defaultValue, field.valueKind)
  ) {
    issues.push(
      `Field ${field.id} defaultValue does not match ${field.valueKind}`,
    );
  }

  if (
    field.min !== undefined &&
    field.max !== undefined &&
    field.min > field.max
  ) {
    issues.push(`Field ${field.id} min cannot exceed max`);
  }

  if (
    field.minLength !== undefined &&
    field.maxLength !== undefined &&
    field.minLength > field.maxLength
  ) {
    issues.push(`Field ${field.id} minLength cannot exceed maxLength`);
  }

  if (
    field.arrayMin !== undefined &&
    field.arrayMax !== undefined &&
    field.arrayMin > field.arrayMax
  ) {
    issues.push(`Field ${field.id} arrayMin cannot exceed arrayMax`);
  }

  if (field.options) {
    const optionValues = field.options.map((option) =>
      stableJson(option.value),
    );
    assertUnique(optionValues, `option value for field ${field.id}`, issues);

    for (const option of field.options) {
      if (!matchesValueKind(option.value, field.valueKind)) {
        issues.push(
          `Field ${field.id} option ${String(option.value)} does not match ${field.valueKind}`,
        );
      }
    }

    if (
      field.defaultValue !== undefined &&
      !defaultIsOmittedEmptyValue &&
      !optionValues.includes(stableJson(field.defaultValue))
    ) {
      issues.push(`Field ${field.id} defaultValue is not a declared option`);
    }
  }

  if (field.providerValueMap) {
    const canonicalValues = field.providerValueMap.map((entry) =>
      stableJson(entry.canonicalValue),
    );
    const providerValues = field.providerValueMap.map((entry) =>
      stableJson(entry.providerValue),
    );
    assertUnique(
      canonicalValues,
      `provider map canonical value for field ${field.id}`,
      issues,
    );
    assertUnique(
      providerValues,
      `provider map provider value for field ${field.id}`,
      issues,
    );

    for (const entry of field.providerValueMap) {
      if (!matchesValueKind(entry.canonicalValue, field.valueKind)) {
        issues.push(
          `Field ${field.id} provider map canonical value does not match ${field.valueKind}`,
        );
      }
    }

    if (field.options) {
      const optionValues = field.options.map((option) =>
        stableJson(option.value),
      );

      for (const optionValue of optionValues) {
        if (!canonicalValues.includes(optionValue)) {
          issues.push(
            `Field ${field.id} provider map does not cover option ${optionValue}`,
          );
        }
      }

      for (const canonicalValue of canonicalValues) {
        if (!optionValues.includes(canonicalValue)) {
          issues.push(
            `Field ${field.id} provider map references an undeclared option ${canonicalValue}`,
          );
        }
      }
    }
  }

  validateDefaultBounds(field, issues);

  validateMediaConstraintBounds(field, issues);
}

function validateDefaultBounds(field: GenerationFieldSpec, issues: string[]) {
  const value = field.defaultValue;

  if (typeof value === "number") {
    if (field.min !== undefined && value < field.min) {
      issues.push(`Field ${field.id} defaultValue is below min`);
    }
    if (field.max !== undefined && value > field.max) {
      issues.push(`Field ${field.id} defaultValue exceeds max`);
    }
  }

  if (typeof value === "string") {
    if (field.minLength !== undefined && value.length < field.minLength) {
      issues.push(`Field ${field.id} defaultValue is shorter than minLength`);
    }
    if (field.maxLength !== undefined && value.length > field.maxLength) {
      issues.push(`Field ${field.id} defaultValue exceeds maxLength`);
    }
  }

  if (Array.isArray(value)) {
    if (field.arrayMin !== undefined && value.length < field.arrayMin) {
      issues.push(`Field ${field.id} defaultValue is shorter than arrayMin`);
    }
    if (field.arrayMax !== undefined && value.length > field.arrayMax) {
      issues.push(`Field ${field.id} defaultValue exceeds arrayMax`);
    }
  }
}

function validateMediaConstraintBounds(
  field: GenerationFieldSpec,
  issues: string[],
) {
  const constraints = field.mediaConstraints;

  if (!constraints) {
    return;
  }

  if (field.componentKind !== "mediaList") {
    issues.push(`Non-media field ${field.id} cannot declare mediaConstraints`);
  }

  assertUnique(
    constraints.mimeTypes,
    `media MIME type for field ${field.id}`,
    issues,
  );
  assertUnique(
    constraints.extensions,
    `media extension for field ${field.id}`,
    issues,
  );

  for (const extension of constraints.extensions) {
    if (!/^\.[a-z0-9]+$/.test(extension)) {
      issues.push(
        `Field ${field.id} media extension must be lowercase and dot-prefixed: ${extension}`,
      );
    }
  }

  const bounds = [
    [constraints.minDimensionPx, constraints.maxDimensionPx, "dimension"],
    [constraints.minAspectRatio, constraints.maxAspectRatio, "aspect ratio"],
    [constraints.minDurationSec, constraints.maxDurationSec, "duration"],
    [constraints.minTotalPixels, constraints.maxTotalPixels, "total pixels"],
    [constraints.minFps, constraints.maxFps, "fps"],
  ] as const;

  for (const [min, max, label] of bounds) {
    if (min !== undefined && max !== undefined && min > max) {
      issues.push(`Field ${field.id} minimum ${label} cannot exceed maximum`);
    }
  }
}

function validateAdapter(
  definition: ModelDefinitionV1,
  definitionSpec: GenerationModelDefinitionSpec,
  spec: GenerationModelSpec,
  issues: string[],
) {
  if (definitionSpec.status === "published") {
    if (!definitionSpec.adapter) {
      issues.push(
        `Published spec ${definitionSpec.id} must declare an adapter`,
      );
    }

    if (definitionSpec.rateLimits.mode === "unconfigured") {
      issues.push(
        `Published spec ${definitionSpec.id} must configure or explicitly disable rate limits`,
      );
    }
  }

  if (!definitionSpec.adapter) {
    return;
  }

  issues.push(
    ...validateGenerationModelAdapter({
      adapter: definitionSpec.adapter,
      model: definition.model,
      spec,
    }),
  );
}

function validateRates(
  definitionSpec: GenerationModelDefinitionSpec,
  spec: GenerationModelSpec,
  issues: string[],
) {
  assertUnique(
    definitionSpec.rates.map((rate) => rate.id),
    `rate id in ${definitionSpec.id}`,
    issues,
  );

  if (
    definitionSpec.status === "published" &&
    definitionSpec.rates.length === 0
  ) {
    issues.push(`Published spec ${definitionSpec.id} must define pricing`);
    return;
  }

  for (const rate of definitionSpec.rates) {
    const expected = rateQuantityShapes[rate.quantitySource];

    if (
      rate.component !== expected.component ||
      rate.quantityUnit !== expected.unit
    ) {
      issues.push(
        `Rate ${rate.id} has incompatible component, quantity source, or unit`,
      );
    }

    const expectedFinalQuantitySource =
      rate.quantitySource === "seedance_estimated_video_tokens"
        ? "provider_completion_tokens"
        : null;

    if (rate.finalQuantitySource !== expectedFinalQuantitySource) {
      issues.push(`Rate ${rate.id} has incompatible final quantity source`);
    }

    validateRateConditions(rate, spec, issues);
  }

  if (definitionSpec.rates.length === 0) {
    return;
  }

  for (const facts of buildReachableRateFacts(spec)) {
    const matches = definitionSpec.rates.filter((rate) =>
      matchesConditions(rate.conditions, facts),
    );

    if (matches.length === 0) {
      issues.push(
        `Spec ${definitionSpec.id} has no pricing for ${stableJson(facts)}`,
      );
      continue;
    }

    if (
      spec.type === "image" &&
      !matches.some((rate) => rate.component === "output_image")
    ) {
      issues.push(
        `Spec ${definitionSpec.id} has no output-image pricing for ${stableJson(facts)}`,
      );
    }

    const componentCounts = new Map<string, number>();

    for (const match of matches) {
      componentCounts.set(
        match.component,
        (componentCounts.get(match.component) ?? 0) + 1,
      );
    }

    for (const [component, count] of componentCounts) {
      if (count > 1) {
        issues.push(
          `Spec ${definitionSpec.id} has ${count} matching ${component} rates for ${stableJson(facts)}`,
        );
      }
    }
  }
}

function validateRateConditions(
  rate: GenerationModelRateDefinition,
  spec: GenerationModelSpec,
  issues: string[],
) {
  const resolutions = getStringFieldOptions(spec, "resolution");
  const conditionResolutions = toConditionValues(
    rate.conditions.outputResolution,
  );

  for (const resolution of conditionResolutions) {
    if (resolutions.length > 0 && !resolutions.includes(resolution)) {
      issues.push(
        `Rate ${rate.id} references unsupported resolution ${resolution}`,
      );
    }
  }

  if (rate.conditions.inputVideoResolution !== undefined) {
    issues.push(
      `Rate ${rate.id} uses unsupported inputVideoResolution condition`,
    );
  }
}

function validateRateLimits(
  definitionSpec: GenerationModelDefinitionSpec,
  spec: GenerationModelSpec,
  issues: string[],
) {
  if (definitionSpec.rateLimits.mode !== "enforced") {
    return;
  }

  const resolutions = getStringFieldOptions(spec, "resolution");
  assertUnique(
    definitionSpec.rateLimits.rules.map((rule) => rule.id),
    `rate-limit id in ${definitionSpec.id}`,
    issues,
  );

  for (const rule of definitionSpec.rateLimits.rules) {
    validateBucketShape(rule, issues);

    for (const resolution of toConditionValues(
      rule.conditions.outputResolution,
    )) {
      if (!resolutions.includes(resolution)) {
        issues.push(
          `Rate limit ${rule.id} references unsupported resolution ${resolution}`,
        );
      }
    }
  }

  for (const resolution of resolutions) {
    if (
      !definitionSpec.rateLimits.rules.some((rule) =>
        matchesConditions(rule.conditions, { outputResolution: resolution }),
      )
    ) {
      issues.push(
        `Spec ${definitionSpec.id} has no rate-limit rule for ${resolution}`,
      );
    }
  }
}

function validateBucketShape(
  rule: GenerationModelRateLimitDefinition,
  issues: string[],
) {
  const bucket = rule.bucket;

  if (bucket.kind === "request_window") {
    if (!bucket.windowSeconds || !bucket.windowAlignment) {
      issues.push(`Rate-limit bucket ${bucket.id} is missing window settings`);
    }
  } else if (bucket.windowSeconds !== null || bucket.windowAlignment !== null) {
    issues.push(
      `Concurrency bucket ${bucket.id} cannot declare window settings`,
    );
  }
}

function buildReachableRateFacts(spec: GenerationModelSpec) {
  const resolutions = getStringFieldOptions(spec, "resolution");

  if (spec.type === "image") {
    return resolutions.map((outputResolution) => ({ outputResolution }));
  }

  const hasVideoField = spec.fields.some((field) => field.id === "videos");
  const facts: Array<Record<string, JsonPrimitive>> = [];

  for (const outputResolution of resolutions) {
    for (const nativeAudio of [false, true]) {
      for (const inputIncludesVideo of hasVideoField
        ? [false, true]
        : [false]) {
        facts.push({
          outputResolution,
          nativeAudio,
          inputIncludesVideo,
          voiceControl: false,
        });
      }
    }
  }

  return facts;
}

function getStringFieldOptions(spec: GenerationModelSpec, fieldId: string) {
  const field = spec.fields.find((candidate) => candidate.id === fieldId);

  if (!field?.options) {
    return [];
  }

  return field.options.flatMap((option) =>
    typeof option.value === "string" ? [option.value] : [],
  );
}

function matchesConditions(
  conditions: Record<string, unknown>,
  facts: Record<string, JsonPrimitive>,
) {
  return Object.entries(conditions).every(([key, value]) => {
    const fact = facts[key];
    return Array.isArray(value) ? value.includes(fact) : value === fact;
  });
}

function toConditionValues(value: string | string[] | undefined) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toPersistedGenerationModelSpec(
  definition: ModelDefinitionV1,
  definitionSpec: GenerationModelDefinitionSpec,
): GenerationModelSpec {
  return {
    schemaVersion: definitionSpec.schemaVersion,
    id: definition.model.id,
    provider: definition.model.providerId,
    displayName: definition.model.displayName,
    type: definition.model.type,
    status: definitionSpec.status,
    ...definitionSpec.configuration,
  } as GenerationModelSpec;
}

function deriveModelStatus(specs: GenerationModelDefinitionSpec[]) {
  if (specs.some((spec) => spec.status === "published")) {
    return "published" as const;
  }

  if (specs.some((spec) => spec.status === "draft")) {
    return "draft" as const;
  }

  return "archived" as const;
}

function compareModel(
  definition: NormalizedModelDefinition,
  current: ModelCatalogState,
  issues: string[],
  changes: ModelDefinitionChange[],
) {
  if (!current.model) {
    changes.push(change("create", "model", definition.model.id));
    return;
  }

  if (current.model.providerId !== definition.model.providerId) {
    issues.push(`Model ${definition.model.id} cannot change provider`);
  }

  if (current.model.type !== definition.model.type) {
    issues.push(`Model ${definition.model.id} cannot change type`);
  }

  const fields = changedFields(current.model, definition.model, [
    "displayName",
    "status",
  ]);

  if (fields.length > 0) {
    changes.push({
      action: definition.model.status === "archived" ? "archive" : "update",
      entity: "model",
      id: definition.model.id,
      fields,
    });
  }
}

function compareSpecs(
  definition: NormalizedModelDefinition,
  current: ModelCatalogState,
  issues: string[],
  changes: ModelDefinitionChange[],
) {
  const desiredIds = new Set(definition.specs.map((spec) => spec.id));

  for (const desired of definition.specs) {
    for (const rate of desired.rates) {
      const owner = current.specs.find((spec) =>
        spec.rates.some((candidate) => candidate.id === rate.id),
      );

      if (owner && owner.id !== desired.id) {
        issues.push(
          `Rate ${rate.id} cannot move from spec ${owner.id} to ${desired.id}`,
        );
      }
    }

    const desiredRateLimits =
      desired.rateLimits.mode === "enforced" ? desired.rateLimits.rules : [];

    for (const rateLimit of desiredRateLimits) {
      const owner = current.specs.find((spec) =>
        spec.rateLimits.some((candidate) => candidate.id === rateLimit.id),
      );

      if (owner && owner.id !== desired.id) {
        issues.push(
          `Rate limit ${rateLimit.id} cannot move from spec ${owner.id} to ${desired.id}`,
        );
      }
    }
  }

  for (const existing of current.specs) {
    if (!desiredIds.has(existing.id)) {
      issues.push(
        `Existing spec ${existing.id} must remain in the canonical model definition`,
      );
    }
  }

  for (const desired of definition.specs) {
    const existing = current.specs.find((spec) => spec.id === desired.id);

    if (!existing) {
      changes.push(change("create", "spec", desired.id));
      for (const rate of desired.rates) {
        changes.push(change("create", "rate", rate.id));
      }
      if (desired.rateLimits.mode === "enforced") {
        for (const rule of desired.rateLimits.rules) {
          changes.push(change("create", "rate_limit_bucket", rule.bucket.id));
          changes.push(change("create", "rate_limit", rule.id));
        }
      }
      continue;
    }

    compareSpec(desired, existing, issues, changes);
  }
}

function compareSpec(
  desired: NormalizedModelDefinitionSpec,
  existing: ModelCatalogState["specs"][number],
  issues: string[],
  changes: ModelDefinitionChange[],
) {
  if (existing.version !== desired.version) {
    issues.push(`Spec ${desired.id} cannot change version`);
  }

  if (existing.schemaVersion !== desired.schemaVersion) {
    issues.push(`Spec ${desired.id} cannot change schemaVersion`);
  }

  const released = existing.status !== "draft";
  const desiredCore = {
    adapter: desired.adapter,
    rateLimitMode: desired.rateLimits.mode,
    spec: { ...desired.spec, status: existing.spec.status },
  };
  const existingCore = {
    adapter: existing.adapter,
    rateLimitMode: existing.rateLimitMode,
    spec: existing.spec,
  };

  if (released && stableJson(desiredCore) !== stableJson(existingCore)) {
    issues.push(`Released spec ${desired.id} configuration is immutable`);
  }

  if (released && desired.status === "draft") {
    issues.push(`Released spec ${desired.id} cannot return to draft`);
  }

  if (existing.status !== desired.status) {
    changes.push({
      action: desired.status === "archived" ? "archive" : "publish",
      entity: "spec",
      id: desired.id,
      fields: ["status"],
    });
  } else if (!released) {
    const fields = changedFields(existing, desired, ["adapter", "spec"]);
    if (fields.length > 0) {
      changes.push({
        action: "update",
        entity: "spec",
        id: desired.id,
        fields,
      });
    }
  }

  compareRates(desired, existing, issues, changes);
  compareRateLimits(desired, existing, issues, changes);
}

function compareRates(
  desired: NormalizedModelDefinitionSpec,
  existing: ModelCatalogState["specs"][number],
  issues: string[],
  changes: ModelDefinitionChange[],
) {
  const desiredById = new Map(desired.rates.map((rate) => [rate.id, rate]));
  const existingById = new Map(existing.rates.map((rate) => [rate.id, rate]));

  for (const rate of desired.rates) {
    const current = existingById.get(rate.id);
    if (!current) {
      changes.push(change("create", "rate", rate.id));
      continue;
    }

    for (const field of [
      "component",
      "quantitySource",
      "finalQuantitySource",
      "quantityUnit",
    ] as const) {
      if (current[field] !== rate[field]) {
        issues.push(
          `Rate ${rate.id} cannot change ${field}; create a new rate id`,
        );
      }
    }

    const fields = changedFields(current, rate, [
      "unitQuantity",
      "unitPriceUsdMicros",
      "conditions",
    ]);
    if (fields.length > 0) {
      changes.push({ action: "update", entity: "rate", id: rate.id, fields });
    }
  }

  for (const rate of existing.rates) {
    if (!desiredById.has(rate.id)) {
      changes.push(change("remove", "rate", rate.id));
    }
  }
}

function compareRateLimits(
  desired: NormalizedModelDefinitionSpec,
  existing: ModelCatalogState["specs"][number],
  issues: string[],
  changes: ModelDefinitionChange[],
) {
  const desiredRules =
    desired.rateLimits.mode === "enforced" ? desired.rateLimits.rules : [];
  const desiredById = new Map(desiredRules.map((rule) => [rule.id, rule]));
  const existingById = new Map(
    existing.rateLimits.map((rule) => [rule.id, rule]),
  );

  if (existing.rateLimitMode !== desired.rateLimits.mode) {
    changes.push({
      action: "update",
      entity: "spec",
      id: desired.id,
      fields: ["rateLimitMode"],
    });
  }

  for (const rule of desiredRules) {
    const current = existingById.get(rule.id);
    if (!current) {
      changes.push(change("create", "rate_limit_bucket", rule.bucket.id));
      changes.push(change("create", "rate_limit", rule.id));
      continue;
    }

    for (const field of [
      "id",
      "kind",
      "windowSeconds",
      "windowAlignment",
    ] as const) {
      if (current.bucket[field] !== rule.bucket[field]) {
        issues.push(
          `Rate-limit bucket ${rule.bucket.id} cannot change ${field}; create a new bucket id`,
        );
      }
    }

    if (current.bucket.maxValue !== rule.bucket.maxValue) {
      changes.push({
        action: "update",
        entity: "rate_limit_bucket",
        id: rule.bucket.id,
        fields: ["maxValue"],
      });
    }

    const fields = changedFields(current, rule, ["conditions"]);
    if (fields.length > 0) {
      changes.push({
        action: "update",
        entity: "rate_limit",
        id: rule.id,
        fields,
      });
    }
  }

  for (const rule of existing.rateLimits) {
    if (!desiredById.has(rule.id)) {
      changes.push(change("remove", "rate_limit", rule.id));
    }
  }
}

function changedFields(
  current: Record<string, unknown>,
  desired: Record<string, unknown>,
  fields: string[],
) {
  return fields.filter(
    (field) => stableJson(current[field]) !== stableJson(desired[field]),
  );
}

function change(
  action: ModelDefinitionChange["action"],
  entity: ModelDefinitionChange["entity"],
  id: string,
): ModelDefinitionChange {
  return { action, entity, id, fields: [] };
}

function matchesValueKind(
  value: JsonValue,
  kind: GenerationFieldSpec["valueKind"],
) {
  switch (kind) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return (
        typeof value === "object" && value !== null && !Array.isArray(value)
      );
  }
}

function assertUnique(values: string[], label: string, issues: string[]) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      issues.push(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function formatZodIssue(issue: z.core.$ZodIssue) {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
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

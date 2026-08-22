DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'tripo'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: tripo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'tripo-h3-1-image-to-3d'
      AND (
        "provider_id" <> 'tripo'
        OR "type" <> 'model3d'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: tripo-h3-1-image-to-3d';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'tripo-h3-1-image-to-3d',
  'tripo',
  'Tripo H3.1 Image to 3D',
  'model3d',
  'published'
)
ON CONFLICT ("id") DO UPDATE SET
  "display_name" = excluded."display_name",
  "status" = excluded."status",
  "updated_at" = now();--> statement-breakpoint
DO $model_spec$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_spec"
    WHERE "id" = 'tripo-h3-1-image-to-3d-v1'
      AND (
        "model_id" <> 'tripo-h3-1-image-to-3d'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'tripo_model3d'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"tripo-h3-1-image-to-3d","provider":"tripo","displayName":"Tripo H3.1 Image to 3D","type":"model3d","status":"published","providerModelId":"v3.1-20260211","description":"Tripo H3.1 image-to-3D generation with configurable geometry and PBR textures.","sourceUrls":["https://developers.tripo3d.ai/en/models/v3-1","https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard","https://developers.tripo3d.ai/en/docs/billing","https://developers.tripo3d.ai/en/docs/rate-limits"],"endpoint":{"method":"POST","path":"/generation/image-to-model"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"images","label":"Reference image","componentKind":"mediaList","valueKind":"array","required":true,"advanced":false,"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMin":1,"arrayMax":1,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp"],"extensions":[".jpeg",".jpg",".png",".webp"],"maxFileSizeBytes":20971520},"mediaRoleCapabilities":["reference"],"notes":["Use one JPEG, PNG, or WebP image up to 20 MB."]},{"id":"textureLevel","label":"Texture","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"None","value":"none"},{"label":"Standard","value":"standard"},{"label":"Detailed","value":"detailed"}],"notes":[]},{"id":"faceLimit","label":"Face limit","description":"Leave empty for adaptive topology.","componentKind":"numberInput","valueKind":"integer","required":false,"advanced":false,"defaultValue":null,"omitWhenEmpty":true,"omitWhenDefault":true,"min":1,"max":2000000,"notes":["Standard geometry supports up to 1,500,000 faces; detailed geometry supports up to 2,000,000."]},{"id":"geometryQuality","label":"Geometry","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Standard","value":"standard"},{"label":"Detailed","value":"detailed"}],"notes":[]}],"groups":[{"id":"attachments","label":"Reference image","fieldIds":["images"],"advanced":false},{"id":"output","label":"3D output","fieldIds":["textureLevel","faceLimit","geometryQuality"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: tripo-h3-1-image-to-3d-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'tripo-h3-1-image-to-3d-v1',
  'tripo-h3-1-image-to-3d',
  1,
  1,
  'published',
  'tripo_model3d',
  'enforced',
  '{"schemaVersion":1,"id":"tripo-h3-1-image-to-3d","provider":"tripo","displayName":"Tripo H3.1 Image to 3D","type":"model3d","status":"published","providerModelId":"v3.1-20260211","description":"Tripo H3.1 image-to-3D generation with configurable geometry and PBR textures.","sourceUrls":["https://developers.tripo3d.ai/en/models/v3-1","https://developers.tripo3d.ai/en/docs/generation-image-to-model/standard","https://developers.tripo3d.ai/en/docs/billing","https://developers.tripo3d.ai/en/docs/rate-limits"],"endpoint":{"method":"POST","path":"/generation/image-to-model"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"images","label":"Reference image","componentKind":"mediaList","valueKind":"array","required":true,"advanced":false,"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMin":1,"arrayMax":1,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp"],"extensions":[".jpeg",".jpg",".png",".webp"],"maxFileSizeBytes":20971520},"mediaRoleCapabilities":["reference"],"notes":["Use one JPEG, PNG, or WebP image up to 20 MB."]},{"id":"textureLevel","label":"Texture","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"None","value":"none"},{"label":"Standard","value":"standard"},{"label":"Detailed","value":"detailed"}],"notes":[]},{"id":"faceLimit","label":"Face limit","description":"Leave empty for adaptive topology.","componentKind":"numberInput","valueKind":"integer","required":false,"advanced":false,"defaultValue":null,"omitWhenEmpty":true,"omitWhenDefault":true,"min":1,"max":2000000,"notes":["Standard geometry supports up to 1,500,000 faces; detailed geometry supports up to 2,000,000."]},{"id":"geometryQuality","label":"Geometry","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Standard","value":"standard"},{"label":"Detailed","value":"detailed"}],"notes":[]}],"groups":[{"id":"attachments","label":"Reference image","fieldIds":["images"],"advanced":false},{"id":"output","label":"3D output","fieldIds":["textureLevel","faceLimit","geometryQuality"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb,
  now()
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
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-none-standard'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-none-standard';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-none-standard',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  200000,
  '{"textureLevel":"none","geometryQuality":"standard"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-standard-standard'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-standard-standard';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-standard-standard',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  300000,
  '{"textureLevel":"standard","geometryQuality":"standard"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-detailed-standard'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-detailed-standard';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-detailed-standard',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  400000,
  '{"textureLevel":"detailed","geometryQuality":"standard"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-none-detailed'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-none-detailed';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-none-detailed',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  400000,
  '{"textureLevel":"none","geometryQuality":"detailed"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-standard-detailed'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-standard-detailed';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-standard-detailed',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  500000,
  '{"textureLevel":"standard","geometryQuality":"detailed"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate"
    WHERE "id" = 'tripo-h3-1-image-model-detailed-detailed'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "component" <> 'output_model3d'
        OR "quantity_source" <> 'output_model3d_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'model'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: tripo-h3-1-image-model-detailed-detailed';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'tripo-h3-1-image-model-detailed-detailed',
  'tripo-h3-1-image-to-3d-v1',
  'output_model3d',
  'output_model3d_count',
  NULL,
  'model',
  1,
  600000,
  '{"textureLevel":"detailed","geometryQuality":"detailed"}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "unit_quantity" = excluded."unit_quantity",
  "unit_price_usd_micros" = excluded."unit_price_usd_micros",
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $rate_limit_bucket$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_rate_limit_bucket"
    WHERE "id" = 'tripo-h3-1-concurrent-task'
      AND (
        "provider_id" <> 'tripo'
        OR "kind" <> 'concurrent_task'
        OR "window_seconds" IS DISTINCT FROM NULL
        OR "window_alignment" IS DISTINCT FROM NULL
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: tripo-h3-1-concurrent-task';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'tripo-h3-1-concurrent-task',
  'tripo',
  'concurrent_task',
  3,
  NULL,
  NULL
)
ON CONFLICT ("id") DO UPDATE SET
  "max_value" = excluded."max_value",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate_limit$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate_limit"
    WHERE "id" = 'tripo-h3-1-image-v1-concurrent'
      AND (
        "model_spec_id" <> 'tripo-h3-1-image-to-3d-v1'
        OR "bucket_id" <> 'tripo-h3-1-concurrent-task'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: tripo-h3-1-image-v1-concurrent';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'tripo-h3-1-image-v1-concurrent',
  'tripo-h3-1-image-to-3d-v1',
  'tripo-h3-1-concurrent-task',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

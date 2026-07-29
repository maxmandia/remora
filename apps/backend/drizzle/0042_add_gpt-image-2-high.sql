DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'openai'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: openai';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'gpt-image-2-high'
      AND (
        "provider_id" <> 'openai'
        OR "type" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: gpt-image-2-high';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'gpt-image-2-high',
  'openai',
  'GPT Image 2 High',
  'image',
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
    WHERE "id" = 'gpt-image-2-high-v1'
      AND (
        "model_id" <> 'gpt-image-2-high'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'openai_gpt_image_2'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"gpt-image-2-high","provider":"openai","displayName":"GPT Image 2 High","type":"image","status":"published","providerModelId":"gpt-image-2-2026-04-21","description":"OpenAI GPT Image 2 high-quality text-to-image generation and reference-image editing.","sourceUrls":["https://developers.openai.com/api/docs/models/gpt-image-2","https://developers.openai.com/api/docs/guides/image-generation","https://developers.openai.com/api/docs/pricing#image-generation"],"endpoint":{"method":"POST","path":"/v1/images/generations"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":32000,"notes":[]},{"id":"images","label":"Reference images","description":"Images used to guide or edit the generated output.","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":16,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp"],"extensions":[".jpeg",".jpg",".png",".webp"],"maxFileSizeBytes":52428800},"mediaRoleCapabilities":["reference"],"notes":["GPT Image 2 supports up to 16 reference images of at most 50 MB each."]},{"id":"resolution","label":"Resolution","componentKind":"hidden","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"notes":["The adapter maps the selected aspect ratio to an OpenAI standard size."]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1:1","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1:1","value":"1:1"},{"label":"3:2","value":"3:2"},{"label":"2:3","value":"2:3"}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Reference images","fieldIds":["images"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: gpt-image-2-high-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'gpt-image-2-high-v1',
  'gpt-image-2-high',
  1,
  1,
  'published',
  'openai_gpt_image_2',
  'enforced',
  '{"schemaVersion":1,"id":"gpt-image-2-high","provider":"openai","displayName":"GPT Image 2 High","type":"image","status":"published","providerModelId":"gpt-image-2-2026-04-21","description":"OpenAI GPT Image 2 high-quality text-to-image generation and reference-image editing.","sourceUrls":["https://developers.openai.com/api/docs/models/gpt-image-2","https://developers.openai.com/api/docs/guides/image-generation","https://developers.openai.com/api/docs/pricing#image-generation"],"endpoint":{"method":"POST","path":"/v1/images/generations"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":32000,"notes":[]},{"id":"images","label":"Reference images","description":"Images used to guide or edit the generated output.","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":16,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp"],"extensions":[".jpeg",".jpg",".png",".webp"],"maxFileSizeBytes":52428800},"mediaRoleCapabilities":["reference"],"notes":["GPT Image 2 supports up to 16 reference images of at most 50 MB each."]},{"id":"resolution","label":"Resolution","componentKind":"hidden","valueKind":"string","required":false,"advanced":false,"defaultValue":"standard","omitWhenEmpty":true,"omitWhenDefault":false,"notes":["The adapter maps the selected aspect ratio to an OpenAI standard size."]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1:1","omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1:1","value":"1:1"},{"label":"3:2","value":"3:2"},{"label":"2:3","value":"2:3"}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Reference images","fieldIds":["images"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb,
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
    WHERE "id" = 'gpt-image-2-high-text-input-tokens'
      AND (
        "model_spec_id" <> 'gpt-image-2-high-v1'
        OR "component" <> 'input_text'
        OR "quantity_source" <> 'openai_estimated_text_input_tokens'
        OR "final_quantity_source" IS DISTINCT FROM 'provider_text_input_tokens'
        OR "quantity_unit" <> 'token'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: gpt-image-2-high-text-input-tokens';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'gpt-image-2-high-text-input-tokens',
  'gpt-image-2-high-v1',
  'input_text',
  'openai_estimated_text_input_tokens',
  'provider_text_input_tokens',
  'token',
  1000000,
  5000000,
  '{}'::jsonb
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
    WHERE "id" = 'gpt-image-2-high-image-input-tokens'
      AND (
        "model_spec_id" <> 'gpt-image-2-high-v1'
        OR "component" <> 'input_image'
        OR "quantity_source" <> 'openai_estimated_image_input_tokens'
        OR "final_quantity_source" IS DISTINCT FROM 'provider_image_input_tokens'
        OR "quantity_unit" <> 'token'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: gpt-image-2-high-image-input-tokens';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'gpt-image-2-high-image-input-tokens',
  'gpt-image-2-high-v1',
  'input_image',
  'openai_estimated_image_input_tokens',
  'provider_image_input_tokens',
  'token',
  1000000,
  8000000,
  '{}'::jsonb
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
    WHERE "id" = 'gpt-image-2-high-image-output-tokens'
      AND (
        "model_spec_id" <> 'gpt-image-2-high-v1'
        OR "component" <> 'output_image'
        OR "quantity_source" <> 'openai_estimated_image_output_tokens'
        OR "final_quantity_source" IS DISTINCT FROM 'provider_image_output_tokens'
        OR "quantity_unit" <> 'token'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: gpt-image-2-high-image-output-tokens';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'gpt-image-2-high-image-output-tokens',
  'gpt-image-2-high-v1',
  'output_image',
  'openai_estimated_image_output_tokens',
  'provider_image_output_tokens',
  'token',
  1000000,
  30000000,
  '{}'::jsonb
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
    WHERE "id" = 'openai-gpt-image-2-tier-1-ipm'
      AND (
        "provider_id" <> 'openai'
        OR "kind" <> 'request_window'
        OR "window_seconds" IS DISTINCT FROM 60
        OR "window_alignment" IS DISTINCT FROM 'rolling'
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: openai-gpt-image-2-tier-1-ipm';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'openai-gpt-image-2-tier-1-ipm',
  'openai',
  'request_window',
  5,
  60,
  'rolling'
)
ON CONFLICT ("id") DO UPDATE SET
  "max_value" = excluded."max_value",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate_limit$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate_limit"
    WHERE "id" = 'gpt-image-2-high-v1-ipm'
      AND (
        "model_spec_id" <> 'gpt-image-2-high-v1'
        OR "bucket_id" <> 'openai-gpt-image-2-tier-1-ipm'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: gpt-image-2-high-v1-ipm';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'gpt-image-2-high-v1-ipm',
  'gpt-image-2-high-v1',
  'openai-gpt-image-2-tier-1-ipm',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

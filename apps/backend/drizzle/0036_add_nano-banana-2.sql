DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'google'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: google';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'nano-banana-2'
      AND (
        "provider_id" <> 'google'
        OR "type" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: nano-banana-2';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'nano-banana-2',
  'google',
  'Nano Banana 2',
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
    WHERE "id" = 'nano-banana-2-v1'
      AND (
        "model_id" <> 'nano-banana-2'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'google_gemini_interactions_image'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"nano-banana-2","provider":"google","displayName":"Nano Banana 2","type":"image","status":"published","providerModelId":"gemini-3.1-flash-image","description":"Google Nano Banana 2 text-to-image and reference-image editing.","sourceUrls":["https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image","https://ai.google.dev/gemini-api/docs/image-generation","https://ai.google.dev/api/interactions-api-v1","https://ai.google.dev/gemini-api/docs/pricing","https://ai.google.dev/gemini-api/docs/rate-limits"],"endpoint":{"method":"POST","path":"/v1/interactions"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]},{"id":"images","label":"Reference images","description":"Images used to guide or edit the generated output.","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":14,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp","image/bmp"],"extensions":[".jpeg",".jpg",".png",".webp",".bmp"],"maxFileSizeBytes":104857600,"maxTotalFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Nano Banana 2 supports up to 14 reference images and 100 MB of total input media."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1K","providerPath":["response_format","image_size"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"512","value":"512"},{"label":"1K","value":"1K"},{"label":"2K","value":"2K"},{"label":"4K","value":"4K"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1:1","providerPath":["response_format","aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1:1","value":"1:1"},{"label":"1:4","value":"1:4"},{"label":"1:8","value":"1:8"},{"label":"2:3","value":"2:3"},{"label":"3:2","value":"3:2"},{"label":"3:4","value":"3:4"},{"label":"4:1","value":"4:1"},{"label":"4:3","value":"4:3"},{"label":"4:5","value":"4:5"},{"label":"5:4","value":"5:4"},{"label":"8:1","value":"8:1"},{"label":"9:16","value":"9:16"},{"label":"16:9","value":"16:9"},{"label":"21:9","value":"21:9"}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Reference images","fieldIds":["images"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: nano-banana-2-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'nano-banana-2-v1',
  'nano-banana-2',
  1,
  1,
  'published',
  'google_gemini_interactions_image',
  'enforced',
  '{"schemaVersion":1,"id":"nano-banana-2","provider":"google","displayName":"Nano Banana 2","type":"image","status":"published","providerModelId":"gemini-3.1-flash-image","description":"Google Nano Banana 2 text-to-image and reference-image editing.","sourceUrls":["https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image","https://ai.google.dev/gemini-api/docs/image-generation","https://ai.google.dev/api/interactions-api-v1","https://ai.google.dev/gemini-api/docs/pricing","https://ai.google.dev/gemini-api/docs/rate-limits"],"endpoint":{"method":"POST","path":"/v1/interactions"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]},{"id":"images","label":"Reference images","description":"Images used to guide or edit the generated output.","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":14,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp","image/bmp"],"extensions":[".jpeg",".jpg",".png",".webp",".bmp"],"maxFileSizeBytes":104857600,"maxTotalFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Nano Banana 2 supports up to 14 reference images and 100 MB of total input media."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1K","providerPath":["response_format","image_size"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"512","value":"512"},{"label":"1K","value":"1K"},{"label":"2K","value":"2K"},{"label":"4K","value":"4K"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"1:1","providerPath":["response_format","aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1:1","value":"1:1"},{"label":"1:4","value":"1:4"},{"label":"1:8","value":"1:8"},{"label":"2:3","value":"2:3"},{"label":"3:2","value":"3:2"},{"label":"3:4","value":"3:4"},{"label":"4:1","value":"4:1"},{"label":"4:3","value":"4:3"},{"label":"4:5","value":"4:5"},{"label":"5:4","value":"5:4"},{"label":"8:1","value":"8:1"},{"label":"9:16","value":"9:16"},{"label":"16:9","value":"16:9"},{"label":"21:9","value":"21:9"}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Reference images","fieldIds":["images"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb,
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
    WHERE "id" = 'nano-banana-2-output-image-512'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "component" <> 'output_image'
        OR "quantity_source" <> 'output_image_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: nano-banana-2-output-image-512';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'nano-banana-2-output-image-512',
  'nano-banana-2-v1',
  'output_image',
  'output_image_count',
  NULL,
  'image',
  1,
  45000,
  '{"outputResolution":"512"}'::jsonb
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
    WHERE "id" = 'nano-banana-2-output-image-1k'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "component" <> 'output_image'
        OR "quantity_source" <> 'output_image_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: nano-banana-2-output-image-1k';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'nano-banana-2-output-image-1k',
  'nano-banana-2-v1',
  'output_image',
  'output_image_count',
  NULL,
  'image',
  1,
  67000,
  '{"outputResolution":"1K"}'::jsonb
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
    WHERE "id" = 'nano-banana-2-output-image-2k'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "component" <> 'output_image'
        OR "quantity_source" <> 'output_image_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: nano-banana-2-output-image-2k';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'nano-banana-2-output-image-2k',
  'nano-banana-2-v1',
  'output_image',
  'output_image_count',
  NULL,
  'image',
  1,
  101000,
  '{"outputResolution":"2K"}'::jsonb
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
    WHERE "id" = 'nano-banana-2-output-image-4k'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "component" <> 'output_image'
        OR "quantity_source" <> 'output_image_count'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'image'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: nano-banana-2-output-image-4k';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'nano-banana-2-output-image-4k',
  'nano-banana-2-v1',
  'output_image',
  'output_image_count',
  NULL,
  'image',
  1,
  151000,
  '{"outputResolution":"4K"}'::jsonb
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
    WHERE "id" = 'google-gemini-3.1-flash-image-rpm'
      AND (
        "provider_id" <> 'google'
        OR "kind" <> 'request_window'
        OR "window_seconds" IS DISTINCT FROM 60
        OR "window_alignment" IS DISTINCT FROM 'rolling'
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: google-gemini-3.1-flash-image-rpm';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'google-gemini-3.1-flash-image-rpm',
  'google',
  'request_window',
  100,
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
    WHERE "id" = 'nano-banana-2-v1-rpm'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "bucket_id" <> 'google-gemini-3.1-flash-image-rpm'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: nano-banana-2-v1-rpm';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'nano-banana-2-v1-rpm',
  'nano-banana-2-v1',
  'google-gemini-3.1-flash-image-rpm',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $rate_limit_bucket$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_rate_limit_bucket"
    WHERE "id" = 'google-gemini-3.1-flash-image-rpd'
      AND (
        "provider_id" <> 'google'
        OR "kind" <> 'request_window'
        OR "window_seconds" IS DISTINCT FROM 86400
        OR "window_alignment" IS DISTINCT FROM 'rolling'
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: google-gemini-3.1-flash-image-rpd';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'google-gemini-3.1-flash-image-rpd',
  'google',
  'request_window',
  1000,
  86400,
  'rolling'
)
ON CONFLICT ("id") DO UPDATE SET
  "max_value" = excluded."max_value",
  "updated_at" = now();--> statement-breakpoint
DO $model_rate_limit$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_model_rate_limit"
    WHERE "id" = 'nano-banana-2-v1-rpd'
      AND (
        "model_spec_id" <> 'nano-banana-2-v1'
        OR "bucket_id" <> 'google-gemini-3.1-flash-image-rpd'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: nano-banana-2-v1-rpd';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'nano-banana-2-v1-rpd',
  'nano-banana-2-v1',
  'google-gemini-3.1-flash-image-rpd',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

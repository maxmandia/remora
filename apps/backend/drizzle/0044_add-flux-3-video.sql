DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'bfl'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: bfl';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'flux-3-video'
      AND (
        "provider_id" <> 'bfl'
        OR "type" <> 'video'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: flux-3-video';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'flux-3-video',
  'bfl',
  'FLUX 3 Video (Preview)',
  'video',
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
    WHERE "id" = 'flux-3-video-v1'
      AND (
        "model_id" <> 'flux-3-video'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'bfl_flux_3_video'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"flux-3-video","provider":"bfl","displayName":"FLUX 3 Video (Preview)","type":"video","status":"published","providerModelId":"latest","description":"Black Forest Labs FLUX 3 Video preview generation.","sourceUrls":["https://docs.bfl.ml/flux_3/flux3_overview","https://docs.bfl.ml/flux_3/flux3_video","https://docs.bfl.ml/api-reference/utility/generate-a-video-with-flux-3","https://docs.bfl.ml/api_integration/integration_guidelines"],"endpoint":{"method":"POST","path":"/v1/flux-3-video"},"modelParameter":{"path":["version"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","providerPath":["prompt"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":10000,"notes":[]},{"id":"images","label":"Keyframes","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png"],"extensions":[".jpeg",".jpg",".png"],"maxFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Add 1–10 images in playback order. Timed keyframes are not available in this preview."]},{"id":"videos","label":"Starting video","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":1,"mediaConstraints":{"mimeTypes":["video/mp4"],"extensions":[".mp4"],"maxFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Add one MP4 to continue it. Video continuation supports 5–15 seconds of generated output."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"hd","providerPath":["resolution"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"HD","value":"hd"},{"label":"Full HD","value":"fhd"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"auto","providerPath":["aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Auto","value":"auto"},{"label":"21:9","value":"21:9"},{"label":"2:1","value":"2:1"},{"label":"16:9","value":"16:9"},{"label":"4:3","value":"4:3"},{"label":"1:1","value":"1:1"},{"label":"3:4","value":"3:4"},{"label":"9:16","value":"9:16"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15},{"label":"16s","value":16},{"label":"17s","value":17},{"label":"18s","value":18},{"label":"19s","value":19},{"label":"20s","value":20}],"min":5,"max":20,"notes":[]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":true,"providerPath":["generate_audio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"On","value":true},{"label":"Off","value":false}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Attachments","fieldIds":["images","videos"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio","duration","generateAudio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: flux-3-video-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'flux-3-video-v1',
  'flux-3-video',
  1,
  1,
  'published',
  'bfl_flux_3_video',
  'enforced',
  '{"schemaVersion":1,"id":"flux-3-video","provider":"bfl","displayName":"FLUX 3 Video (Preview)","type":"video","status":"published","providerModelId":"latest","description":"Black Forest Labs FLUX 3 Video preview generation.","sourceUrls":["https://docs.bfl.ml/flux_3/flux3_overview","https://docs.bfl.ml/flux_3/flux3_video","https://docs.bfl.ml/api-reference/utility/generate-a-video-with-flux-3","https://docs.bfl.ml/api_integration/integration_guidelines"],"endpoint":{"method":"POST","path":"/v1/flux-3-video"},"modelParameter":{"path":["version"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","providerPath":["prompt"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":10000,"notes":[]},{"id":"images","label":"Keyframes","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png"],"extensions":[".jpeg",".jpg",".png"],"maxFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Add 1–10 images in playback order. Timed keyframes are not available in this preview."]},{"id":"videos","label":"Starting video","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":1,"mediaConstraints":{"mimeTypes":["video/mp4"],"extensions":[".mp4"],"maxFileSizeBytes":104857600},"mediaRoleCapabilities":["reference"],"notes":["Add one MP4 to continue it. Video continuation supports 5–15 seconds of generated output."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"hd","providerPath":["resolution"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"HD","value":"hd"},{"label":"Full HD","value":"fhd"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"auto","providerPath":["aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Auto","value":"auto"},{"label":"21:9","value":"21:9"},{"label":"2:1","value":"2:1"},{"label":"16:9","value":"16:9"},{"label":"4:3","value":"4:3"},{"label":"1:1","value":"1:1"},{"label":"3:4","value":"3:4"},{"label":"9:16","value":"9:16"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15},{"label":"16s","value":16},{"label":"17s","value":17},{"label":"18s","value":18},{"label":"19s","value":19},{"label":"20s","value":20}],"min":5,"max":20,"notes":[]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":true,"providerPath":["generate_audio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"On","value":true},{"label":"Off","value":false}],"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Attachments","fieldIds":["images","videos"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio","duration","generateAudio"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb,
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
    WHERE "id" = 'flux-3-video-output-video-hd-input-video-off'
      AND (
        "model_spec_id" <> 'flux-3-video-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: flux-3-video-output-video-hd-input-video-off';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'flux-3-video-output-video-hd-input-video-off',
  'flux-3-video-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  170000,
  '{"outputResolution":"hd","inputIncludesVideo":false}'::jsonb
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
    WHERE "id" = 'flux-3-video-output-video-fhd-input-video-off'
      AND (
        "model_spec_id" <> 'flux-3-video-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: flux-3-video-output-video-fhd-input-video-off';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'flux-3-video-output-video-fhd-input-video-off',
  'flux-3-video-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  290000,
  '{"outputResolution":"fhd","inputIncludesVideo":false}'::jsonb
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
    WHERE "id" = 'flux-3-video-output-video-hd-input-video-on'
      AND (
        "model_spec_id" <> 'flux-3-video-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: flux-3-video-output-video-hd-input-video-on';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'flux-3-video-output-video-hd-input-video-on',
  'flux-3-video-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  430000,
  '{"outputResolution":"hd","inputIncludesVideo":true}'::jsonb
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
    WHERE "id" = 'flux-3-video-output-video-fhd-input-video-on'
      AND (
        "model_spec_id" <> 'flux-3-video-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: flux-3-video-output-video-fhd-input-video-on';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'flux-3-video-output-video-fhd-input-video-on',
  'flux-3-video-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  540000,
  '{"outputResolution":"fhd","inputIncludesVideo":true}'::jsonb
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
    WHERE "id" = 'bfl-concurrent-task'
      AND (
        "provider_id" <> 'bfl'
        OR "kind" <> 'concurrent_task'
        OR "window_seconds" IS DISTINCT FROM NULL
        OR "window_alignment" IS DISTINCT FROM NULL
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: bfl-concurrent-task';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'bfl-concurrent-task',
  'bfl',
  'concurrent_task',
  24,
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
    WHERE "id" = 'flux-3-video-concurrent-task'
      AND (
        "model_spec_id" <> 'flux-3-video-v1'
        OR "bucket_id" <> 'bfl-concurrent-task'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: flux-3-video-concurrent-task';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'flux-3-video-concurrent-task',
  'flux-3-video-v1',
  'bfl-concurrent-task',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

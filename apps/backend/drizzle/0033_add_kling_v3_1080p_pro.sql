DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'kling'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: kling';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'kling-v3-1080p-pro'
      AND (
        "provider_id" <> 'kling'
        OR "type" <> 'video'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: kling-v3-1080p-pro';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'kling-v3-1080p-pro',
  'kling',
  'Kling 3.0 1080p (Pro)',
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
    WHERE "id" = 'kling-v3-1080p-pro-v1'
      AND (
        "model_id" <> 'kling-v3-1080p-pro'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'kling_v3_text_to_video'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"kling-v3-1080p-pro","provider":"kling","displayName":"Kling 3.0 1080p (Pro)","type":"video","status":"published","providerModelId":"kling-v3","description":"Kling 3.0 1080p text-to-video generation.","sourceUrls":["https://kling.ai/document-api/api/video/3-0-omni/text-to-video/legacy","https://kling.ai/document-api/api/get-started/authentication","https://kling.ai/dev/pricing","https://kling.ai/document-api/api/get-started/concurrency-rules"],"endpoint":{"method":"POST","path":"/v1/videos/text2video"},"modelParameter":{"path":["model_name"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","providerPath":["prompt"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":2500,"notes":[]},{"id":"resolution","label":"Resolution","componentKind":"hidden","valueKind":"string","required":false,"advanced":false,"defaultValue":"1080p","providerPath":["mode"],"providerValueMap":[{"canonicalValue":"1080p","providerValue":"pro"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1080p","value":"1080p"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"16:9","providerPath":["aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"16:9","value":"16:9"},{"label":"9:16","value":"9:16"},{"label":"1:1","value":"1:1"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"providerValueMap":[{"canonicalValue":3,"providerValue":"3"},{"canonicalValue":4,"providerValue":"4"},{"canonicalValue":5,"providerValue":"5"},{"canonicalValue":6,"providerValue":"6"},{"canonicalValue":7,"providerValue":"7"},{"canonicalValue":8,"providerValue":"8"},{"canonicalValue":9,"providerValue":"9"},{"canonicalValue":10,"providerValue":"10"},{"canonicalValue":11,"providerValue":"11"},{"canonicalValue":12,"providerValue":"12"},{"canonicalValue":13,"providerValue":"13"},{"canonicalValue":14,"providerValue":"14"},{"canonicalValue":15,"providerValue":"15"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"3s","value":3},{"label":"4s","value":4},{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15}],"min":3,"max":15,"notes":[]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":false,"providerPath":["sound"],"providerValueMap":[{"canonicalValue":false,"providerValue":"off"},{"canonicalValue":true,"providerValue":"on"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Off","value":false},{"label":"On","value":true}],"notes":[]},{"id":"callbackUrl","label":"Callback URL","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["callback_url"],"omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]}],"groups":[{"id":"generation","label":"Generation","fieldIds":["prompt","resolution","aspectRatio","duration","generateAudio","callbackUrl"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: kling-v3-1080p-pro-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'kling-v3-1080p-pro-v1',
  'kling-v3-1080p-pro',
  1,
  1,
  'published',
  'kling_v3_text_to_video',
  'enforced',
  '{"schemaVersion":1,"id":"kling-v3-1080p-pro","provider":"kling","displayName":"Kling 3.0 1080p (Pro)","type":"video","status":"published","providerModelId":"kling-v3","description":"Kling 3.0 1080p text-to-video generation.","sourceUrls":["https://kling.ai/document-api/api/video/3-0-omni/text-to-video/legacy","https://kling.ai/document-api/api/get-started/authentication","https://kling.ai/dev/pricing","https://kling.ai/document-api/api/get-started/concurrency-rules"],"endpoint":{"method":"POST","path":"/v1/videos/text2video"},"modelParameter":{"path":["model_name"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":true,"advanced":false,"defaultValue":"","providerPath":["prompt"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":2500,"notes":[]},{"id":"resolution","label":"Resolution","componentKind":"hidden","valueKind":"string","required":false,"advanced":false,"defaultValue":"1080p","providerPath":["mode"],"providerValueMap":[{"canonicalValue":"1080p","providerValue":"pro"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"1080p","value":"1080p"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"16:9","providerPath":["aspect_ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"16:9","value":"16:9"},{"label":"9:16","value":"9:16"},{"label":"1:1","value":"1:1"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"providerValueMap":[{"canonicalValue":3,"providerValue":"3"},{"canonicalValue":4,"providerValue":"4"},{"canonicalValue":5,"providerValue":"5"},{"canonicalValue":6,"providerValue":"6"},{"canonicalValue":7,"providerValue":"7"},{"canonicalValue":8,"providerValue":"8"},{"canonicalValue":9,"providerValue":"9"},{"canonicalValue":10,"providerValue":"10"},{"canonicalValue":11,"providerValue":"11"},{"canonicalValue":12,"providerValue":"12"},{"canonicalValue":13,"providerValue":"13"},{"canonicalValue":14,"providerValue":"14"},{"canonicalValue":15,"providerValue":"15"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"3s","value":3},{"label":"4s","value":4},{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15}],"min":3,"max":15,"notes":[]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":false,"providerPath":["sound"],"providerValueMap":[{"canonicalValue":false,"providerValue":"off"},{"canonicalValue":true,"providerValue":"on"}],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Off","value":false},{"label":"On","value":true}],"notes":[]},{"id":"callbackUrl","label":"Callback URL","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["callback_url"],"omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]}],"groups":[{"id":"generation","label":"Generation","fieldIds":["prompt","resolution","aspectRatio","duration","generateAudio","callbackUrl"],"advanced":false}],"transforms":[],"validationRules":[]}'::jsonb,
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
    WHERE "id" = 'kling-v3-1080p-pro-output-video-native-audio-off'
      AND (
        "model_spec_id" <> 'kling-v3-1080p-pro-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: kling-v3-1080p-pro-output-video-native-audio-off';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'kling-v3-1080p-pro-output-video-native-audio-off',
  'kling-v3-1080p-pro-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  112000,
  '{"outputResolution":"1080p","nativeAudio":false}'::jsonb
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
    WHERE "id" = 'kling-v3-1080p-pro-output-video-native-audio-on-voice-control-off'
      AND (
        "model_spec_id" <> 'kling-v3-1080p-pro-v1'
        OR "component" <> 'output_video'
        OR "quantity_source" <> 'output_duration_seconds'
        OR "final_quantity_source" IS DISTINCT FROM NULL
        OR "quantity_unit" <> 'second'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: kling-v3-1080p-pro-output-video-native-audio-on-voice-control-off';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'kling-v3-1080p-pro-output-video-native-audio-on-voice-control-off',
  'kling-v3-1080p-pro-v1',
  'output_video',
  'output_duration_seconds',
  NULL,
  'second',
  1,
  168000,
  '{"outputResolution":"1080p","nativeAudio":true,"voiceControl":false}'::jsonb
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
    WHERE "id" = 'kling-v3-1080p-pro-concurrent-task'
      AND (
        "provider_id" <> 'kling'
        OR "kind" <> 'concurrent_task'
        OR "window_seconds" IS DISTINCT FROM NULL
        OR "window_alignment" IS DISTINCT FROM NULL
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: kling-v3-1080p-pro-concurrent-task';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'kling-v3-1080p-pro-concurrent-task',
  'kling',
  'concurrent_task',
  20,
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
    WHERE "id" = 'kling-v3-1080p-pro-concurrent-task'
      AND (
        "model_spec_id" <> 'kling-v3-1080p-pro-v1'
        OR "bucket_id" <> 'kling-v3-1080p-pro-concurrent-task'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: kling-v3-1080p-pro-concurrent-task';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'kling-v3-1080p-pro-concurrent-task',
  'kling-v3-1080p-pro-v1',
  'kling-v3-1080p-pro-concurrent-task',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

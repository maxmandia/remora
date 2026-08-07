DO $model_definition$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "generation_provider"
    WHERE "id" = 'byteplus'
  ) THEN
    RAISE EXCEPTION 'Generation provider is not registered: byteplus';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "generation_model"
    WHERE "id" = 'seedance-2.5-video'
      AND (
        "provider_id" <> 'byteplus'
        OR "type" <> 'video'
      )
  ) THEN
    RAISE EXCEPTION 'Immutable generation model identity does not match: seedance-2.5-video';
  END IF;
END
$model_definition$;--> statement-breakpoint
INSERT INTO "generation_model" (
  "id", "provider_id", "display_name", "type", "status"
) VALUES (
  'seedance-2.5-video',
  'byteplus',
  'Seedance 2.5',
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
    WHERE "id" = 'seedance-2.5-video-v1'
      AND (
        "model_id" <> 'seedance-2.5-video'
        OR "version" <> 1
        OR "schema_version" <> 1
        OR (
          "status" <> 'draft'
          AND (
            "adapter" IS DISTINCT FROM 'byteplus_seedance_video'
            OR "rate_limit_mode" <> 'enforced'
            OR jsonb_set("spec", ARRAY['status'], '"published"'::jsonb, true)
              <> '{"schemaVersion":1,"id":"seedance-2.5-video","provider":"byteplus","displayName":"Seedance 2.5","type":"video","status":"published","providerModelId":"dreamina-seedance-2-5-260628","description":"BytePlus ModelArk Seedance 2.5 video generation.","sourceUrls":["https://ai.byteplus.com/ark/region:ap-southeast-1/model/detail?Id=dreamina-seedance-2-5","https://docs.byteplus.com/en/docs/ModelArk/1520757"],"endpoint":{"method":"POST","path":"/api/v3/contents/generations/tasks"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":false,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":10000,"notes":["Seedance recommends prompts under 1000 words."]},{"id":"images","label":"Images","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":30,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp","image/bmp","image/tiff","image/gif","image/heic","image/heif"],"extensions":[".jpeg",".jpg",".png",".webp",".bmp",".tiff",".gif",".heic",".heif"],"maxFileSizeBytes":31457280,"minDimensionPx":300,"maxDimensionPx":6000,"minAspectRatio":0.4,"maxAspectRatio":2.5},"mediaRoleCapabilities":["firstFrame","lastFrame","reference"],"notes":["Use role first_frame, last_frame, or reference_image.","Seedance 2.5 supports up to 30 images."]},{"id":"videos","label":"Videos","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["video/mp4","video/quicktime"],"extensions":[".mp4",".mov"],"maxFileSizeBytes":52428800,"minDimensionPx":300,"maxDimensionPx":6000,"minAspectRatio":0.4,"maxAspectRatio":2.5,"minDurationSec":2,"maxDurationSec":15,"maxTotalDurationSec":15,"minTotalPixels":409600,"maxTotalPixels":2086876,"minFps":24,"maxFps":60},"mediaRoleCapabilities":["reference"],"notes":["Use role reference_video. Seedance 2.5 supports up to 10 videos.","The current shared API documentation limits total reference-video duration to 15 seconds."]},{"id":"audios","label":"Audio","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["audio/wav","audio/x-wav","audio/mpeg"],"extensions":[".wav",".mp3"],"maxFileSizeBytes":15728640,"minDurationSec":2,"maxDurationSec":15,"maxTotalDurationSec":15},"mediaRoleCapabilities":["reference"],"notes":["Use role reference_audio. Seedance 2.5 supports up to 10 audio files.","Audio attachments cannot be submitted without an image or video attachment.","The current shared API documentation limits total reference-audio duration to 15 seconds."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"720p","providerPath":["resolution"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"480p","value":"480p"},{"label":"720p","value":"720p"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"adaptive","providerPath":["ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Adaptive","value":"adaptive"},{"label":"16:9","value":"16:9"},{"label":"4:3","value":"4:3"},{"label":"1:1","value":"1:1"},{"label":"3:4","value":"3:4"},{"label":"9:16","value":"9:16"},{"label":"21:9","value":"21:9"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Adaptive","value":-1},{"label":"4s","value":4},{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15},{"label":"16s","value":16},{"label":"17s","value":17},{"label":"18s","value":18},{"label":"19s","value":19},{"label":"20s","value":20},{"label":"21s","value":21},{"label":"22s","value":22},{"label":"23s","value":23},{"label":"24s","value":24},{"label":"25s","value":25},{"label":"26s","value":26},{"label":"27s","value":27},{"label":"28s","value":28},{"label":"29s","value":29},{"label":"30s","value":30}],"min":-1,"max":30,"notes":["Seedance 2.5 supports integer duration 4-30 seconds, or -1 for adaptive."]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":true,"providerPath":["generate_audio"],"omitWhenEmpty":true,"omitWhenDefault":true,"options":[{"label":"On","value":true},{"label":"Off","value":false}],"notes":[]},{"id":"watermark","label":"Watermark","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":false,"providerPath":["watermark"],"omitWhenEmpty":true,"omitWhenDefault":true,"notes":[]},{"id":"returnLastFrame","label":"Return last frame","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":true,"defaultValue":false,"providerPath":["return_last_frame"],"omitWhenEmpty":true,"omitWhenDefault":true,"notes":[]},{"id":"safetyIdentifier","label":"Safety identifier","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["safety_identifier"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":64,"notes":[]},{"id":"callbackUrl","label":"Callback URL","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["callback_url"],"omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]},{"id":"executionExpiresAfter","label":"Execution expiry","componentKind":"numberInput","valueKind":"integer","required":false,"advanced":true,"defaultValue":172800,"providerPath":["execution_expires_after"],"omitWhenEmpty":true,"omitWhenDefault":true,"min":3600,"max":259200,"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Attachments","fieldIds":["images","videos","audios"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio","duration","generateAudio","watermark"],"advanced":false},{"id":"advanced","label":"Advanced","fieldIds":["returnLastFrame","safetyIdentifier","callbackUrl","executionExpiresAfter"],"advanced":true}],"transforms":[{"kind":"seedanceContentArray"}],"validationRules":["seedance20ContentRules"]}'::jsonb
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Generation model spec identity or released configuration is immutable: seedance-2.5-video-v1';
  END IF;
END
$model_spec$;--> statement-breakpoint
INSERT INTO "generation_model_spec" (
  "id", "model_id", "version", "schema_version", "status", "adapter",
  "rate_limit_mode", "spec", "published_at"
) VALUES (
  'seedance-2.5-video-v1',
  'seedance-2.5-video',
  1,
  1,
  'published',
  'byteplus_seedance_video',
  'enforced',
  '{"schemaVersion":1,"id":"seedance-2.5-video","provider":"byteplus","displayName":"Seedance 2.5","type":"video","status":"published","providerModelId":"dreamina-seedance-2-5-260628","description":"BytePlus ModelArk Seedance 2.5 video generation.","sourceUrls":["https://ai.byteplus.com/ark/region:ap-southeast-1/model/detail?Id=dreamina-seedance-2-5","https://docs.byteplus.com/en/docs/ModelArk/1520757"],"endpoint":{"method":"POST","path":"/api/v3/contents/generations/tasks"},"modelParameter":{"path":["model"],"source":"spec"},"fields":[{"id":"prompt","label":"Prompt","componentKind":"promptTextarea","valueKind":"string","required":false,"advanced":false,"defaultValue":"","omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":10000,"notes":["Seedance recommends prompts under 1000 words."]},{"id":"images","label":"Images","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":30,"mediaConstraints":{"mimeTypes":["image/jpeg","image/png","image/webp","image/bmp","image/tiff","image/gif","image/heic","image/heif"],"extensions":[".jpeg",".jpg",".png",".webp",".bmp",".tiff",".gif",".heic",".heif"],"maxFileSizeBytes":31457280,"minDimensionPx":300,"maxDimensionPx":6000,"minAspectRatio":0.4,"maxAspectRatio":2.5},"mediaRoleCapabilities":["firstFrame","lastFrame","reference"],"notes":["Use role first_frame, last_frame, or reference_image.","Seedance 2.5 supports up to 30 images."]},{"id":"videos","label":"Videos","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["video/mp4","video/quicktime"],"extensions":[".mp4",".mov"],"maxFileSizeBytes":52428800,"minDimensionPx":300,"maxDimensionPx":6000,"minAspectRatio":0.4,"maxAspectRatio":2.5,"minDurationSec":2,"maxDurationSec":15,"maxTotalDurationSec":15,"minTotalPixels":409600,"maxTotalPixels":2086876,"minFps":24,"maxFps":60},"mediaRoleCapabilities":["reference"],"notes":["Use role reference_video. Seedance 2.5 supports up to 10 videos.","The current shared API documentation limits total reference-video duration to 15 seconds."]},{"id":"audios","label":"Audio","componentKind":"mediaList","valueKind":"array","required":false,"advanced":false,"defaultValue":[],"omitWhenEmpty":true,"omitWhenDefault":false,"arrayMax":10,"mediaConstraints":{"mimeTypes":["audio/wav","audio/x-wav","audio/mpeg"],"extensions":[".wav",".mp3"],"maxFileSizeBytes":15728640,"minDurationSec":2,"maxDurationSec":15,"maxTotalDurationSec":15},"mediaRoleCapabilities":["reference"],"notes":["Use role reference_audio. Seedance 2.5 supports up to 10 audio files.","Audio attachments cannot be submitted without an image or video attachment.","The current shared API documentation limits total reference-audio duration to 15 seconds."]},{"id":"resolution","label":"Resolution","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"720p","providerPath":["resolution"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"480p","value":"480p"},{"label":"720p","value":"720p"}],"notes":[]},{"id":"aspectRatio","label":"Aspect ratio","componentKind":"select","valueKind":"string","required":false,"advanced":false,"defaultValue":"adaptive","providerPath":["ratio"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Adaptive","value":"adaptive"},{"label":"16:9","value":"16:9"},{"label":"4:3","value":"4:3"},{"label":"1:1","value":"1:1"},{"label":"3:4","value":"3:4"},{"label":"9:16","value":"9:16"},{"label":"21:9","value":"21:9"}],"notes":[]},{"id":"duration","label":"Duration","componentKind":"select","valueKind":"integer","required":false,"advanced":false,"defaultValue":5,"providerPath":["duration"],"omitWhenEmpty":true,"omitWhenDefault":false,"options":[{"label":"Adaptive","value":-1},{"label":"4s","value":4},{"label":"5s","value":5},{"label":"6s","value":6},{"label":"7s","value":7},{"label":"8s","value":8},{"label":"9s","value":9},{"label":"10s","value":10},{"label":"11s","value":11},{"label":"12s","value":12},{"label":"13s","value":13},{"label":"14s","value":14},{"label":"15s","value":15},{"label":"16s","value":16},{"label":"17s","value":17},{"label":"18s","value":18},{"label":"19s","value":19},{"label":"20s","value":20},{"label":"21s","value":21},{"label":"22s","value":22},{"label":"23s","value":23},{"label":"24s","value":24},{"label":"25s","value":25},{"label":"26s","value":26},{"label":"27s","value":27},{"label":"28s","value":28},{"label":"29s","value":29},{"label":"30s","value":30}],"min":-1,"max":30,"notes":["Seedance 2.5 supports integer duration 4-30 seconds, or -1 for adaptive."]},{"id":"generateAudio","label":"Generate audio","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":true,"providerPath":["generate_audio"],"omitWhenEmpty":true,"omitWhenDefault":true,"options":[{"label":"On","value":true},{"label":"Off","value":false}],"notes":[]},{"id":"watermark","label":"Watermark","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":false,"defaultValue":false,"providerPath":["watermark"],"omitWhenEmpty":true,"omitWhenDefault":true,"notes":[]},{"id":"returnLastFrame","label":"Return last frame","componentKind":"toggle","valueKind":"boolean","required":false,"advanced":true,"defaultValue":false,"providerPath":["return_last_frame"],"omitWhenEmpty":true,"omitWhenDefault":true,"notes":[]},{"id":"safetyIdentifier","label":"Safety identifier","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["safety_identifier"],"omitWhenEmpty":true,"omitWhenDefault":false,"maxLength":64,"notes":[]},{"id":"callbackUrl","label":"Callback URL","componentKind":"textInput","valueKind":"string","required":false,"advanced":true,"defaultValue":"","providerPath":["callback_url"],"omitWhenEmpty":true,"omitWhenDefault":false,"notes":[]},{"id":"executionExpiresAfter","label":"Execution expiry","componentKind":"numberInput","valueKind":"integer","required":false,"advanced":true,"defaultValue":172800,"providerPath":["execution_expires_after"],"omitWhenEmpty":true,"omitWhenDefault":true,"min":3600,"max":259200,"notes":[]}],"groups":[{"id":"prompt","label":"Prompt","fieldIds":["prompt"],"advanced":false},{"id":"attachments","label":"Attachments","fieldIds":["images","videos","audios"],"advanced":false},{"id":"output","label":"Output","fieldIds":["resolution","aspectRatio","duration","generateAudio","watermark"],"advanced":false},{"id":"advanced","label":"Advanced","fieldIds":["returnLastFrame","safetyIdentifier","callbackUrl","executionExpiresAfter"],"advanced":true}],"transforms":[{"kind":"seedanceContentArray"}],"validationRules":["seedance20ContentRules"]}'::jsonb,
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
    WHERE "id" = 'seedance-2.5-video-provider-video-tokens-input-video-off'
      AND (
        "model_spec_id" <> 'seedance-2.5-video-v1'
        OR "component" <> 'provider_video_tokens'
        OR "quantity_source" <> 'seedance_estimated_video_tokens'
        OR "final_quantity_source" IS DISTINCT FROM 'provider_completion_tokens'
        OR "quantity_unit" <> 'token'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: seedance-2.5-video-provider-video-tokens-input-video-off';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'seedance-2.5-video-provider-video-tokens-input-video-off',
  'seedance-2.5-video-v1',
  'provider_video_tokens',
  'seedance_estimated_video_tokens',
  'provider_completion_tokens',
  'token',
  1000000,
  10700000,
  '{"outputResolution":["480p","720p"],"inputIncludesVideo":false}'::jsonb
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
    WHERE "id" = 'seedance-2.5-video-provider-video-tokens-input-video-on'
      AND (
        "model_spec_id" <> 'seedance-2.5-video-v1'
        OR "component" <> 'provider_video_tokens'
        OR "quantity_source" <> 'seedance_estimated_video_tokens'
        OR "final_quantity_source" IS DISTINCT FROM 'provider_completion_tokens'
        OR "quantity_unit" <> 'token'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate identity is immutable: seedance-2.5-video-provider-video-tokens-input-video-on';
  END IF;
END
$model_rate$;--> statement-breakpoint
INSERT INTO "generation_model_rate" (
  "id", "model_spec_id", "component", "quantity_source",
  "final_quantity_source", "quantity_unit", "unit_quantity",
  "unit_price_usd_micros", "conditions"
) VALUES (
  'seedance-2.5-video-provider-video-tokens-input-video-on',
  'seedance-2.5-video-v1',
  'provider_video_tokens',
  'seedance_estimated_video_tokens',
  'provider_completion_tokens',
  'token',
  1000000,
  6400000,
  '{"outputResolution":["480p","720p"],"inputIncludesVideo":true}'::jsonb
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
    WHERE "id" = 'byteplus-seedance-2.5-video-concurrent-task'
      AND (
        "provider_id" <> 'byteplus'
        OR "kind" <> 'concurrent_task'
        OR "window_seconds" IS DISTINCT FROM NULL
        OR "window_alignment" IS DISTINCT FROM NULL
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: byteplus-seedance-2.5-video-concurrent-task';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'byteplus-seedance-2.5-video-concurrent-task',
  'byteplus',
  'concurrent_task',
  10,
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
    WHERE "id" = 'seedance-2.5-video-concurrent-task'
      AND (
        "model_spec_id" <> 'seedance-2.5-video-v1'
        OR "bucket_id" <> 'byteplus-seedance-2.5-video-concurrent-task'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: seedance-2.5-video-concurrent-task';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'seedance-2.5-video-concurrent-task',
  'seedance-2.5-video-v1',
  'byteplus-seedance-2.5-video-concurrent-task',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now();--> statement-breakpoint
DO $rate_limit_bucket$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "generation_rate_limit_bucket"
    WHERE "id" = 'byteplus-seedance-2.5-video-rpm'
      AND (
        "provider_id" <> 'byteplus'
        OR "kind" <> 'request_window'
        OR "window_seconds" IS DISTINCT FROM 60
        OR "window_alignment" IS DISTINCT FROM 'rolling'
      )
  ) THEN
    RAISE EXCEPTION 'Generation rate-limit bucket identity is immutable: byteplus-seedance-2.5-video-rpm';
  END IF;
END
$rate_limit_bucket$;--> statement-breakpoint
INSERT INTO "generation_rate_limit_bucket" (
  "id", "provider_id", "kind", "max_value", "window_seconds", "window_alignment"
) VALUES (
  'byteplus-seedance-2.5-video-rpm',
  'byteplus',
  'request_window',
  600,
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
    WHERE "id" = 'seedance-2.5-video-rpm'
      AND (
        "model_spec_id" <> 'seedance-2.5-video-v1'
        OR "bucket_id" <> 'byteplus-seedance-2.5-video-rpm'
      )
  ) THEN
    RAISE EXCEPTION 'Generation model rate-limit identity is immutable: seedance-2.5-video-rpm';
  END IF;
END
$model_rate_limit$;--> statement-breakpoint
INSERT INTO "generation_model_rate_limit" (
  "id", "model_spec_id", "bucket_id", "conditions"
) VALUES (
  'seedance-2.5-video-rpm',
  'seedance-2.5-video-v1',
  'byteplus-seedance-2.5-video-rpm',
  '{}'::jsonb
)
ON CONFLICT ("id") DO UPDATE SET
  "conditions" = excluded."conditions",
  "updated_at" = now() ;

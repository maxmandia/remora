INSERT INTO "generation_rate_limit_bucket" (
  "id",
  "provider_id",
  "kind",
  "max_value",
  "window_seconds",
  "window_alignment"
)
VALUES
  (
    'byteplus-seedance-2.0-video-non-4k-concurrent-task',
    'byteplus',
    'concurrent_task',
    10,
    NULL,
    NULL
  ),
  (
    'byteplus-seedance-2.0-video-non-4k-rpm',
    'byteplus',
    'request_window',
    600,
    60,
    'rolling'
  ),
  (
    'byteplus-seedance-2.0-video-4k-concurrent-task',
    'byteplus',
    'concurrent_task',
    1,
    NULL,
    NULL
  ),
  (
    'byteplus-seedance-2.0-video-4k-rpm',
    'byteplus',
    'request_window',
    15,
    60,
    'rolling'
  ),
  (
    'byteplus-seedance-2.0-fast-video-concurrent-task',
    'byteplus',
    'concurrent_task',
    10,
    NULL,
    NULL
  ),
  (
    'byteplus-seedance-2.0-fast-video-rpm',
    'byteplus',
    'request_window',
    600,
    60,
    'rolling'
  )
ON CONFLICT ("id") DO UPDATE SET
  "provider_id" = excluded."provider_id",
  "kind" = excluded."kind",
  "max_value" = excluded."max_value",
  "window_seconds" = excluded."window_seconds",
  "window_alignment" = excluded."window_alignment",
  "updated_at" = now();--> statement-breakpoint

INSERT INTO "generation_model_rate_limit" (
  "id",
  "model_id",
  "bucket_id",
  "conditions"
)
VALUES
  (
    'seedance-2.0-video-non-4k-concurrent-task',
    'seedance-2.0-video',
    'byteplus-seedance-2.0-video-non-4k-concurrent-task',
    '{"outputResolution":["480p","720p","1080p"]}'::jsonb
  ),
  (
    'seedance-2.0-video-non-4k-rpm',
    'seedance-2.0-video',
    'byteplus-seedance-2.0-video-non-4k-rpm',
    '{"outputResolution":["480p","720p","1080p"]}'::jsonb
  ),
  (
    'seedance-2.0-video-4k-concurrent-task',
    'seedance-2.0-video',
    'byteplus-seedance-2.0-video-4k-concurrent-task',
    '{"outputResolution":"4k"}'::jsonb
  ),
  (
    'seedance-2.0-video-4k-rpm',
    'seedance-2.0-video',
    'byteplus-seedance-2.0-video-4k-rpm',
    '{"outputResolution":"4k"}'::jsonb
  ),
  (
    'seedance-2.0-fast-video-concurrent-task',
    'seedance-2.0-fast-video',
    'byteplus-seedance-2.0-fast-video-concurrent-task',
    '{}'::jsonb
  ),
  (
    'seedance-2.0-fast-video-rpm',
    'seedance-2.0-fast-video',
    'byteplus-seedance-2.0-fast-video-rpm',
    '{}'::jsonb
  )
ON CONFLICT ("id") DO UPDATE SET
  "model_id" = excluded."model_id",
  "bucket_id" = excluded."bucket_id",
  "conditions" = excluded."conditions",
  "updated_at" = now();

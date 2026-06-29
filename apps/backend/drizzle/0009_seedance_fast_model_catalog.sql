INSERT INTO "generation_model" ("id", "provider_id", "display_name", "type", "status")
VALUES
  ('seedance-2.0-fast-video', 'byteplus', 'Seedance 2.0 Fast', 'video', 'published')
ON CONFLICT ("id") DO UPDATE SET
  "provider_id" = excluded."provider_id",
  "display_name" = excluded."display_name",
  "type" = excluded."type",
  "status" = excluded."status",
  "updated_at" = now();--> statement-breakpoint
WITH seedance_spec AS (
  SELECT "spec"
  FROM "generation_model_spec"
  WHERE "model_id" = 'seedance-2.0-video'
    AND "version" = 1
    AND "schema_version" = 1
  LIMIT 1
),
seedance_fast_fields AS (
  SELECT
    jsonb_agg(
      CASE
        WHEN field_entry.field_spec ->> 'id' = 'resolution' THEN
          jsonb_set(
            field_entry.field_spec,
            ARRAY['options'],
            (
              SELECT jsonb_agg(option_entry.option_spec ORDER BY option_entry.ordinality)
              FROM jsonb_array_elements(field_entry.field_spec -> 'options')
                WITH ORDINALITY AS option_entry(option_spec, ordinality)
              WHERE option_entry.option_spec ->> 'value' NOT IN ('1080p', '4k')
            ),
            false
          )
        ELSE field_entry.field_spec
      END
      ORDER BY field_entry.ordinality
    ) AS fields
  FROM seedance_spec
  CROSS JOIN LATERAL jsonb_array_elements(seedance_spec.spec -> 'fields')
    WITH ORDINALITY AS field_entry(field_spec, ordinality)
),
seedance_fast_spec AS (
  SELECT
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                seedance_spec.spec,
                ARRAY['id'],
                '"seedance-2.0-fast-video"'::jsonb,
                false
              ),
              ARRAY['providerModelId'],
              '"dreamina-seedance-2-0-fast-260128"'::jsonb,
              false
            ),
            ARRAY['displayName'],
            '"Seedance 2.0 Fast"'::jsonb,
            false
          ),
          ARRAY['description'],
          '"BytePlus ModelArk Seedance 2.0 Fast video generation."'::jsonb,
          false
        ),
        ARRAY['sourceUrls'],
        '[
          "https://docs.byteplus.com/en/docs/ModelArk/1520757",
          "https://docs.byteplus.com/en/docs/ModelArk/2291680",
          "https://docs.byteplus.com/en/docs/ModelArk/1159178",
          "https://docs.byteplus.com/en/docs/ModelArk/1330310"
        ]'::jsonb,
        false
      ),
      ARRAY['fields'],
      seedance_fast_fields.fields,
      false
    ) AS spec
  FROM seedance_spec
  CROSS JOIN seedance_fast_fields
)
INSERT INTO "generation_model_spec" (
  "id",
  "model_id",
  "version",
  "schema_version",
  "status",
  "spec",
  "published_at"
)
SELECT
  'seedance-2.0-fast-video-v1',
  'seedance-2.0-fast-video',
  1,
  1,
  'published',
  seedance_fast_spec.spec,
  now()
FROM seedance_fast_spec
ON CONFLICT ("id") DO UPDATE SET
  "model_id" = excluded."model_id",
  "version" = excluded."version",
  "schema_version" = excluded."schema_version",
  "status" = excluded."status",
  "spec" = excluded."spec",
  "published_at" = excluded."published_at",
  "updated_at" = now();

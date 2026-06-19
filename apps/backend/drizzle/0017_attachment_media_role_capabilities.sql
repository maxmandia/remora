WITH seedance_specs AS (
  SELECT
    "id",
    "spec"
  FROM "generation_model_spec"
  WHERE "model_id" IN ('seedance-2.0-video', 'seedance-2.0-fast-video')
),
seedance_fields AS (
  SELECT
    seedance_specs."id",
    jsonb_agg(
      CASE
        WHEN field_entry.field_spec ->> 'id' = 'images' THEN
          jsonb_set(
            field_entry.field_spec,
            ARRAY['mediaRoleCapabilities'],
            '["firstFrame", "lastFrame", "reference"]'::jsonb,
            true
          )
        WHEN field_entry.field_spec ->> 'id' IN ('videos', 'audios') THEN
          jsonb_set(
            field_entry.field_spec,
            ARRAY['mediaRoleCapabilities'],
            '["reference"]'::jsonb,
            true
          )
        ELSE field_entry.field_spec
      END
      ORDER BY field_entry.ordinality
    ) AS fields
  FROM seedance_specs
  CROSS JOIN LATERAL jsonb_array_elements(seedance_specs."spec" -> 'fields')
    WITH ORDINALITY AS field_entry(field_spec, ordinality)
  GROUP BY seedance_specs."id"
)
UPDATE "generation_model_spec"
SET
  "spec" = jsonb_set(
    "generation_model_spec"."spec",
    ARRAY['fields'],
    seedance_fields.fields,
    false
  ),
  "updated_at" = now()
FROM seedance_fields
WHERE "generation_model_spec"."id" = seedance_fields."id";

WITH kling_duration_field AS (
  SELECT
    generation_model_spec.id,
    (field_entry.ordinality - 1)::text AS field_index
  FROM generation_model_spec
  CROSS JOIN LATERAL jsonb_array_elements(spec -> 'fields')
    WITH ORDINALITY AS field_entry(field_spec, ordinality)
  WHERE generation_model_spec.model_id = 'kling-v3-text-to-video'
    AND generation_model_spec.version = 1
    AND generation_model_spec.schema_version = 1
    AND field_entry.field_spec ->> 'id' = 'duration'
)
UPDATE generation_model_spec
SET
  spec = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              generation_model_spec.spec,
              ARRAY['fields', kling_duration_field.field_index, 'valueKind'],
              '"integer"'::jsonb,
              false
            ),
            ARRAY['fields', kling_duration_field.field_index, 'defaultValue'],
            '5'::jsonb,
            false
          ),
          ARRAY['fields', kling_duration_field.field_index, 'providerValueMap'],
          '[
            { "canonicalValue": 3, "providerValue": "3" },
            { "canonicalValue": 4, "providerValue": "4" },
            { "canonicalValue": 5, "providerValue": "5" },
            { "canonicalValue": 6, "providerValue": "6" },
            { "canonicalValue": 7, "providerValue": "7" },
            { "canonicalValue": 8, "providerValue": "8" },
            { "canonicalValue": 9, "providerValue": "9" },
            { "canonicalValue": 10, "providerValue": "10" },
            { "canonicalValue": 11, "providerValue": "11" },
            { "canonicalValue": 12, "providerValue": "12" },
            { "canonicalValue": 13, "providerValue": "13" },
            { "canonicalValue": 14, "providerValue": "14" },
            { "canonicalValue": 15, "providerValue": "15" }
          ]'::jsonb,
          true
        ),
        ARRAY['fields', kling_duration_field.field_index, 'min'],
        '3'::jsonb,
        true
      ),
      ARRAY['fields', kling_duration_field.field_index, 'max'],
      '15'::jsonb,
      true
    ),
    ARRAY['fields', kling_duration_field.field_index, 'options'],
    '[
      { "label": "3s", "value": 3 },
      { "label": "4s", "value": 4 },
      { "label": "5s", "value": 5 },
      { "label": "6s", "value": 6 },
      { "label": "7s", "value": 7 },
      { "label": "8s", "value": 8 },
      { "label": "9s", "value": 9 },
      { "label": "10s", "value": 10 },
      { "label": "11s", "value": 11 },
      { "label": "12s", "value": 12 },
      { "label": "13s", "value": 13 },
      { "label": "14s", "value": 14 },
      { "label": "15s", "value": 15 }
    ]'::jsonb,
    false
  ),
  updated_at = now()
FROM kling_duration_field
WHERE generation_model_spec.id = kling_duration_field.id;

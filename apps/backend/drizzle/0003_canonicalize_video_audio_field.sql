WITH seedance_audio_field AS (
  SELECT
    generation_model_spec.id,
    (field_entry.ordinality - 1)::text AS field_index
  FROM generation_model_spec
  CROSS JOIN LATERAL jsonb_array_elements(spec -> 'fields')
    WITH ORDINALITY AS field_entry(field_spec, ordinality)
  WHERE generation_model_spec.model_id = 'seedance-2.0-video'
    AND generation_model_spec.version = 1
    AND generation_model_spec.schema_version = 1
    AND field_entry.field_spec ->> 'id' = 'generateAudio'
)
UPDATE generation_model_spec
SET
  spec = jsonb_set(
    generation_model_spec.spec,
    ARRAY['fields', seedance_audio_field.field_index, 'options'],
    '[
      { "label": "On", "value": true },
      { "label": "Off", "value": false }
    ]'::jsonb,
    true
  ),
  updated_at = now()
FROM seedance_audio_field
WHERE generation_model_spec.id = seedance_audio_field.id;

WITH kling_audio_field AS (
  SELECT
    generation_model_spec.id,
    (field_entry.ordinality - 1)::text AS field_index,
    (group_entry.ordinality - 1)::text AS group_index,
    (group_field_entry.ordinality - 1)::text AS group_field_index
  FROM generation_model_spec
  CROSS JOIN LATERAL jsonb_array_elements(spec -> 'fields')
    WITH ORDINALITY AS field_entry(field_spec, ordinality)
  CROSS JOIN LATERAL jsonb_array_elements(spec -> 'groups')
    WITH ORDINALITY AS group_entry(field_group, ordinality)
  CROSS JOIN LATERAL jsonb_array_elements(group_entry.field_group -> 'fieldIds')
    WITH ORDINALITY AS group_field_entry(field_id, ordinality)
  WHERE generation_model_spec.model_id = 'kling-v3-text-to-video'
    AND generation_model_spec.version = 1
    AND generation_model_spec.schema_version = 1
    AND field_entry.field_spec ->> 'id' = 'sound'
    AND group_entry.field_group ->> 'id' = 'output'
    AND group_field_entry.field_id = '"sound"'::jsonb
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
              ARRAY['fields', kling_audio_field.field_index, 'id'],
              '"generateAudio"'::jsonb,
              false
            ),
            ARRAY['fields', kling_audio_field.field_index, 'valueKind'],
            '"boolean"'::jsonb,
            false
          ),
          ARRAY['fields', kling_audio_field.field_index, 'defaultValue'],
          'false'::jsonb,
          false
        ),
        ARRAY['fields', kling_audio_field.field_index, 'providerValueMap'],
        '[
          { "canonicalValue": true, "providerValue": "on" },
          { "canonicalValue": false, "providerValue": "off" }
        ]'::jsonb,
        true
      ),
      ARRAY['fields', kling_audio_field.field_index, 'options'],
      '[
        { "label": "On", "value": true },
        { "label": "Off", "value": false }
      ]'::jsonb,
      false
    ),
    ARRAY[
      'groups',
      kling_audio_field.group_index,
      'fieldIds',
      kling_audio_field.group_field_index
    ],
    '"generateAudio"'::jsonb,
    false
  ),
  updated_at = now()
FROM kling_audio_field
WHERE generation_model_spec.id = kling_audio_field.id;

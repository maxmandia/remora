UPDATE "generation_model_spec"
SET
  "spec" = jsonb_set(
    jsonb_set(
      "spec",
      ARRAY['providerModelId'],
      '"dreamina-seedance-2-0-260128"'::jsonb,
      false
    ),
    ARRAY['modelParameter', 'source'],
    '"spec"'::jsonb,
    false
  ),
  "updated_at" = now()
WHERE "model_id" = 'seedance-2.0-video'
  AND "version" = 1
  AND "schema_version" = 1;

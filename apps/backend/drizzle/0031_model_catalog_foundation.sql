CREATE TYPE "public"."generation_model_adapter" AS ENUM('byteplus_seedance_video');--> statement-breakpoint
CREATE TYPE "public"."generation_model_rate_limit_mode" AS ENUM('unconfigured', 'enforced', 'unlimited');--> statement-breakpoint
CREATE TYPE "public"."generation_model_rate_final_quantity_source" AS ENUM('provider_completion_tokens');--> statement-breakpoint
CREATE TYPE "public"."generation_model_rate_quantity_source" AS ENUM('output_duration_seconds', 'input_video_duration_seconds', 'input_image_count', 'seedance_estimated_video_tokens');--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" RENAME COLUMN "model_id" TO "model_spec_id";--> statement-breakpoint
ALTER TABLE "generation_model_rate" RENAME COLUMN "model_id" TO "model_spec_id";--> statement-breakpoint
ALTER TABLE "generation_submission" DROP CONSTRAINT "generation_submission_model_spec_id_generation_model_spec_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_model" DROP CONSTRAINT "generation_model_provider_id_generation_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_model_spec" DROP CONSTRAINT "generation_model_spec_model_id_generation_model_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" DROP CONSTRAINT "generation_model_rate_limit_model_id_generation_model_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" DROP CONSTRAINT "generation_model_rate_limit_bucket_id_generation_rate_limit_bucket_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_rate_limit_bucket" DROP CONSTRAINT "generation_rate_limit_bucket_provider_id_generation_provider_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_rate_limit_concurrency_lease" DROP CONSTRAINT "generation_rate_limit_concurrency_lease_bucket_id_generation_rate_limit_bucket_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_rate_limit_window_entry" DROP CONSTRAINT "generation_rate_limit_window_entry_bucket_id_generation_rate_limit_bucket_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_model_rate" DROP CONSTRAINT "generation_model_rate_model_id_generation_model_id_fk";
--> statement-breakpoint
DROP INDEX "generation_model_rate_limit_model_id_bucket_id_idx";--> statement-breakpoint
DROP INDEX "generation_model_rate_model_id_idx";--> statement-breakpoint
DROP INDEX "generation_model_rate_model_id_component_idx";--> statement-breakpoint
ALTER TABLE "generation_model_rate" ALTER COLUMN "quantity_source" SET DATA TYPE "public"."generation_model_rate_quantity_source" USING "quantity_source"::"public"."generation_model_rate_quantity_source";--> statement-breakpoint
ALTER TABLE "generation_model_rate" ALTER COLUMN "final_quantity_source" SET DATA TYPE "public"."generation_model_rate_final_quantity_source" USING "final_quantity_source"::"public"."generation_model_rate_final_quantity_source";--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD COLUMN "adapter" "generation_model_adapter";--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD COLUMN "rate_limit_mode" "generation_model_rate_limit_mode" DEFAULT 'unconfigured' NOT NULL;--> statement-breakpoint
DO $model_catalog_backfill$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "generation_model_rate" AS rate
    LEFT JOIN "generation_model_spec" AS spec
      ON spec."model_id" = rate."model_spec_id"
      AND spec."version" = 1
    WHERE spec."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill generation_model_rate.model_spec_id';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "generation_model_rate_limit" AS rate_limit
    LEFT JOIN "generation_model_spec" AS spec
      ON spec."model_id" = rate_limit."model_spec_id"
      AND spec."version" = 1
    WHERE spec."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot backfill generation_model_rate_limit.model_spec_id';
  END IF;
END
$model_catalog_backfill$;--> statement-breakpoint
UPDATE "generation_model_rate" AS rate
SET "model_spec_id" = spec."id"
FROM "generation_model_spec" AS spec
WHERE spec."model_id" = rate."model_spec_id"
  AND spec."version" = 1;--> statement-breakpoint
UPDATE "generation_model_rate_limit" AS rate_limit
SET "model_spec_id" = spec."id"
FROM "generation_model_spec" AS spec
WHERE spec."model_id" = rate_limit."model_spec_id"
  AND spec."version" = 1;--> statement-breakpoint
UPDATE "generation_model_spec"
SET
  "adapter" = 'byteplus_seedance_video',
  "rate_limit_mode" = 'enforced',
  "updated_at" = now()
WHERE "model_id" IN ('seedance-2.0-video', 'seedance-2.0-fast-video');--> statement-breakpoint
UPDATE "generation_model_spec"
SET
  "status" = 'archived',
  "spec" = jsonb_set("spec", ARRAY['status'], '"archived"'::jsonb, true),
  "updated_at" = now()
WHERE "model_id" = 'kling-v3-text-to-video';--> statement-breakpoint
UPDATE "generation_model"
SET
  "status" = 'archived',
  "updated_at" = now()
WHERE "id" = 'kling-v3-text-to-video';--> statement-breakpoint
CREATE UNIQUE INDEX "generation_model_spec_id_model_id_idx" ON "generation_model_spec" USING btree ("id","model_id");--> statement-breakpoint
ALTER TABLE "generation_submission" ADD CONSTRAINT "generation_submission_model_spec_model_fk" FOREIGN KEY ("model_spec_id","model_id") REFERENCES "public"."generation_model_spec"("id","model_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model" ADD CONSTRAINT "generation_model_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" ADD CONSTRAINT "generation_model_rate_limit_model_spec_id_generation_model_spec_id_fk" FOREIGN KEY ("model_spec_id") REFERENCES "public"."generation_model_spec"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" ADD CONSTRAINT "generation_model_rate_limit_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_bucket" ADD CONSTRAINT "generation_rate_limit_bucket_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_concurrency_lease" ADD CONSTRAINT "generation_rate_limit_concurrency_lease_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_window_entry" ADD CONSTRAINT "generation_rate_limit_window_entry_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_rate" ADD CONSTRAINT "generation_model_rate_model_spec_id_generation_model_spec_id_fk" FOREIGN KEY ("model_spec_id") REFERENCES "public"."generation_model_spec"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_model_rate_limit_spec_id_bucket_id_idx" ON "generation_model_rate_limit" USING btree ("model_spec_id","bucket_id");--> statement-breakpoint
CREATE INDEX "generation_model_rate_limit_model_spec_id_idx" ON "generation_model_rate_limit" USING btree ("model_spec_id");--> statement-breakpoint
CREATE INDEX "generation_model_rate_model_spec_id_idx" ON "generation_model_rate" USING btree ("model_spec_id");--> statement-breakpoint
CREATE INDEX "generation_model_rate_model_spec_id_component_idx" ON "generation_model_rate" USING btree ("model_spec_id","component");--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_version_positive" CHECK ("generation_model_spec"."version" > 0);--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_schema_version_positive" CHECK ("generation_model_spec"."schema_version" > 0);--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_spec_object" CHECK (jsonb_typeof("generation_model_spec"."spec") = 'object');--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_publication_shape" CHECK ((
        "generation_model_spec"."status" = 'draft'
        AND "generation_model_spec"."published_at" IS NULL
      ) OR (
        "generation_model_spec"."status" IN ('published', 'archived')
        AND "generation_model_spec"."published_at" IS NOT NULL
      ));--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_published_configuration" CHECK ("generation_model_spec"."status" <> 'published' OR (
        "generation_model_spec"."adapter" IS NOT NULL
        AND "generation_model_spec"."rate_limit_mode" <> 'unconfigured'
      ));

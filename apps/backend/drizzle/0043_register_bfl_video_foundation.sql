ALTER TYPE "public"."generation_job_status" ADD VALUE 'waiting_for_provider_result' BEFORE 'succeeded';--> statement-breakpoint
ALTER TYPE "public"."generation_model_adapter" ADD VALUE 'bfl_flux_3_video' BEFORE 'byteplus_seedance_video';--> statement-breakpoint
INSERT INTO "generation_provider" ("id", "name")
VALUES ('bfl', 'Black Forest Labs')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = now();

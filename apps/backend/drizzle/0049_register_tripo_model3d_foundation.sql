ALTER TYPE "public"."generation_result_asset_kind" ADD VALUE 'model3d';--> statement-breakpoint
ALTER TYPE "public"."generation_model_adapter" ADD VALUE 'tripo_model3d';--> statement-breakpoint
ALTER TYPE "public"."generation_model_type" ADD VALUE 'model3d';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_component" ADD VALUE 'output_model3d';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_source" ADD VALUE 'output_model3d_count';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_unit" ADD VALUE 'model';--> statement-breakpoint
INSERT INTO "generation_provider" ("id", "name")
VALUES ('tripo', 'Tripo')
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "updated_at" = now();

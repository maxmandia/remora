ALTER TYPE "public"."generation_result_asset_kind" ADD VALUE 'image';--> statement-breakpoint
ALTER TYPE "public"."generation_model_type" ADD VALUE 'image';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_component" ADD VALUE 'output_image';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_source" ADD VALUE 'output_image_count';
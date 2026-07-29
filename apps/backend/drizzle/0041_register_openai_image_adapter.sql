ALTER TYPE "public"."generation_model_adapter" ADD VALUE 'openai_gpt_image_2';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_component" ADD VALUE 'input_text' BEFORE 'output_video';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_final_quantity_source" ADD VALUE 'provider_text_input_tokens';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_final_quantity_source" ADD VALUE 'provider_image_input_tokens';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_final_quantity_source" ADD VALUE 'provider_image_output_tokens';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_source" ADD VALUE 'openai_estimated_text_input_tokens';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_source" ADD VALUE 'openai_estimated_image_input_tokens';--> statement-breakpoint
ALTER TYPE "public"."generation_model_rate_quantity_source" ADD VALUE 'openai_estimated_image_output_tokens';--> statement-breakpoint
INSERT INTO "generation_provider" ("id", "name")
VALUES ('openai', 'OpenAI')
ON CONFLICT ("id") DO UPDATE SET
	"name" = excluded."name",
	"updated_at" = now();

ALTER TYPE "public"."generation_model_adapter" ADD VALUE 'google_gemini_interactions_image' BEFORE 'kling_v3_text_to_video';--> statement-breakpoint
INSERT INTO "generation_provider" ("id", "name")
VALUES ('google', 'Google')
ON CONFLICT ("id") DO UPDATE SET
	"name" = excluded."name",
	"updated_at" = now();

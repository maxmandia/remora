ALTER TABLE "generation_attachment_media" DROP CONSTRAINT "generation_attachment_media_model_id_generation_model_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_attachment_media" DROP CONSTRAINT "generation_attachment_media_model_spec_id_generation_model_spec_id_fk";
--> statement-breakpoint
DROP INDEX "generation_attachment_media_model_spec_id_idx";--> statement-breakpoint
ALTER TABLE "generation_attachment_media" ADD COLUMN "kind" text;--> statement-breakpoint
UPDATE "generation_attachment_media"
SET "kind" = CASE
  WHEN "field_id" = 'images' THEN 'image'
  WHEN "field_id" = 'videos' THEN 'video'
  WHEN "field_id" = 'audios' THEN 'audio'
  ELSE 'image'
END;--> statement-breakpoint
ALTER TABLE "generation_attachment_media" ALTER COLUMN "kind" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "generation_attachment_media_user_id_kind_idx" ON "generation_attachment_media" USING btree ("user_id","kind");--> statement-breakpoint
ALTER TABLE "generation_attachment_media" DROP COLUMN "model_id";--> statement-breakpoint
ALTER TABLE "generation_attachment_media" DROP COLUMN "model_spec_id";--> statement-breakpoint
ALTER TABLE "generation_attachment_media" DROP COLUMN "field_id";--> statement-breakpoint
ALTER TABLE "generation_attachment_media" DROP COLUMN "expires_at";

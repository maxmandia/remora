CREATE TYPE "public"."generation_attachment_media_role" AS ENUM('reference', 'firstFrame', 'lastFrame');--> statement-breakpoint
ALTER TABLE "generation_submission_attachment_media"
ADD COLUMN "role" "generation_attachment_media_role";--> statement-breakpoint
UPDATE "generation_submission_attachment_media"
SET "role" = 'reference'
WHERE "role" IS NULL;--> statement-breakpoint
ALTER TABLE "generation_submission_attachment_media"
ALTER COLUMN "role" SET NOT NULL;

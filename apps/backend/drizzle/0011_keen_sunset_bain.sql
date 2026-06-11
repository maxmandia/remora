ALTER TABLE "generation_result_asset" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."generation_result_asset_kind";--> statement-breakpoint
CREATE TYPE "public"."generation_result_asset_kind" AS ENUM('video');--> statement-breakpoint
ALTER TABLE "generation_result_asset" ALTER COLUMN "kind" SET DATA TYPE "public"."generation_result_asset_kind" USING "kind"::"public"."generation_result_asset_kind";--> statement-breakpoint
ALTER TABLE "generation_result" DROP COLUMN "last_frame_url";
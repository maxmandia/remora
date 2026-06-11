CREATE TYPE "public"."generation_result_asset_kind" AS ENUM('video', 'last_frame');--> statement-breakpoint
CREATE TABLE "generation_result_asset" (
	"id" text PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"kind" "generation_result_asset_kind" NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"content_length" bigint,
	"etag" text,
	"checksum_sha256" text,
	"source_provider_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_result_asset" ADD CONSTRAINT "generation_result_asset_result_id_generation_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."generation_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_result_asset_result_id_kind_idx" ON "generation_result_asset" USING btree ("result_id","kind");--> statement-breakpoint
CREATE INDEX "generation_result_asset_result_id_idx" ON "generation_result_asset" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "generation_result_asset_bucket_object_key_idx" ON "generation_result_asset" USING btree ("bucket","object_key");
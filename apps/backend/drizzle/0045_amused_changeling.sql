CREATE TABLE "generation_result_draft_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"content_length" bigint,
	"etag" text,
	"checksum_sha256" text,
	"source_provider_url" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_result_draft_cache" ADD CONSTRAINT "generation_result_draft_cache_result_id_generation_result_id_fk" FOREIGN KEY ("result_id") REFERENCES "public"."generation_result"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_result_draft_cache_result_id_idx" ON "generation_result_draft_cache" USING btree ("result_id");--> statement-breakpoint
CREATE INDEX "generation_result_draft_cache_bucket_object_key_idx" ON "generation_result_draft_cache" USING btree ("bucket","object_key");
CREATE TABLE "generation_reference_media" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"model_spec_id" text NOT NULL,
	"field_id" text NOT NULL,
	"original_file_name" text NOT NULL,
	"bucket" text NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text,
	"content_length" bigint,
	"etag" text,
	"checksum_sha256" text,
	"metadata" jsonb NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_submission_reference_media" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"reference_media_id" text NOT NULL,
	"field_id" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_reference_media" ADD CONSTRAINT "generation_reference_media_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_reference_media" ADD CONSTRAINT "generation_reference_media_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_reference_media" ADD CONSTRAINT "generation_reference_media_model_spec_id_generation_model_spec_id_fk" FOREIGN KEY ("model_spec_id") REFERENCES "public"."generation_model_spec"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_submission_reference_media" ADD CONSTRAINT "generation_submission_reference_media_submission_id_generation_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."generation_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_submission_reference_media" ADD CONSTRAINT "generation_submission_reference_media_reference_media_id_generation_reference_media_id_fk" FOREIGN KEY ("reference_media_id") REFERENCES "public"."generation_reference_media"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_reference_media_user_id_idx" ON "generation_reference_media" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_reference_media_model_spec_id_idx" ON "generation_reference_media" USING btree ("model_spec_id");--> statement-breakpoint
CREATE INDEX "generation_reference_media_bucket_object_key_idx" ON "generation_reference_media" USING btree ("bucket","object_key");--> statement-breakpoint
CREATE INDEX "generation_submission_reference_media_submission_id_idx" ON "generation_submission_reference_media" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "generation_submission_reference_media_reference_media_id_idx" ON "generation_submission_reference_media" USING btree ("reference_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_submission_reference_media_submission_media_idx" ON "generation_submission_reference_media" USING btree ("submission_id","reference_media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_submission_reference_media_submission_field_position_idx" ON "generation_submission_reference_media" USING btree ("submission_id","field_id","position");
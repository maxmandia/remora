ALTER TYPE "public"."generation_job_status" ADD VALUE 'waiting_for_provider_callback' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."generation_job_status" ADD VALUE 'succeeded' BEFORE 'failed';--> statement-breakpoint
ALTER TYPE "public"."generation_job_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."generation_job_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "generation_result" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_task_id" text NOT NULL,
	"provider_model_id" text,
	"provider_status" text NOT NULL,
	"video_url" text,
	"last_frame_url" text,
	"usage" jsonb,
	"provider_error" jsonb,
	"raw_payload" jsonb NOT NULL,
	"received_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_job" ADD COLUMN "callback_token_hash" text;--> statement-breakpoint
ALTER TABLE "generation_result" ADD CONSTRAINT "generation_result_job_id_generation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_result" ADD CONSTRAINT "generation_result_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_result_job_id_idx" ON "generation_result" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "generation_result_provider_task_id_idx" ON "generation_result" USING btree ("provider_task_id");--> statement-breakpoint
CREATE INDEX "generation_result_provider_status_idx" ON "generation_result" USING btree ("provider_status");
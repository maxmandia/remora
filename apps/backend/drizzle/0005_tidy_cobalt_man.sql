CREATE TYPE "public"."generation_job_status" AS ENUM('queued', 'creating_provider_task', 'provider_task_created', 'failed');--> statement-breakpoint
CREATE TABLE "generation_job" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"model_spec_id" text NOT NULL,
	"status" "generation_job_status" DEFAULT 'queued' NOT NULL,
	"submitted_input" jsonb NOT NULL,
	"temporal_workflow_id" text,
	"temporal_run_id" text,
	"provider_id" text,
	"provider_task_id" text,
	"provider_model_id" text,
	"terminal_error" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_model_spec_id_generation_model_spec_id_fk" FOREIGN KEY ("model_spec_id") REFERENCES "public"."generation_model_spec"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_job_user_id_idx" ON "generation_job" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_job_model_id_idx" ON "generation_job" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "generation_job_model_spec_id_idx" ON "generation_job" USING btree ("model_spec_id");--> statement-breakpoint
CREATE INDEX "generation_job_status_idx" ON "generation_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_job_temporal_workflow_id_idx" ON "generation_job" USING btree ("temporal_workflow_id");--> statement-breakpoint
CREATE INDEX "generation_job_provider_task_id_idx" ON "generation_job" USING btree ("provider_task_id");

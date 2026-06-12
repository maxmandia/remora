CREATE TABLE "generation_submission" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"user_id" text NOT NULL,
	"model_id" text NOT NULL,
	"model_spec_id" text NOT NULL,
	"submitted_input" jsonb NOT NULL,
	"requested_generations" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_job" DROP CONSTRAINT "generation_job_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_job" DROP CONSTRAINT "generation_job_model_id_generation_model_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_job" DROP CONSTRAINT "generation_job_model_spec_id_generation_model_spec_id_fk";
--> statement-breakpoint
ALTER TABLE "generation_job" DROP CONSTRAINT "generation_job_thread_user_fk";
--> statement-breakpoint
DROP INDEX "generation_job_thread_id_idx";--> statement-breakpoint
DROP INDEX "generation_job_user_id_idx";--> statement-breakpoint
DROP INDEX "generation_job_model_id_idx";--> statement-breakpoint
DROP INDEX "generation_job_model_spec_id_idx";--> statement-breakpoint
ALTER TABLE "generation_job" ADD COLUMN "submission_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_job" ADD COLUMN "submission_index" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "generation_submission" ADD CONSTRAINT "generation_submission_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_submission" ADD CONSTRAINT "generation_submission_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_submission" ADD CONSTRAINT "generation_submission_model_spec_id_generation_model_spec_id_fk" FOREIGN KEY ("model_spec_id") REFERENCES "public"."generation_model_spec"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_submission" ADD CONSTRAINT "generation_submission_thread_user_fk" FOREIGN KEY ("thread_id","user_id") REFERENCES "public"."generation_thread"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_submission_thread_id_idx" ON "generation_submission" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "generation_submission_user_id_idx" ON "generation_submission" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_submission_model_id_idx" ON "generation_submission" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "generation_submission_model_spec_id_idx" ON "generation_submission" USING btree ("model_spec_id");--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_submission_id_generation_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."generation_submission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_job_submission_id_idx" ON "generation_job" USING btree ("submission_id");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_job_submission_id_submission_index_idx" ON "generation_job" USING btree ("submission_id","submission_index");--> statement-breakpoint
ALTER TABLE "generation_job" DROP COLUMN "thread_id";--> statement-breakpoint
ALTER TABLE "generation_job" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "generation_job" DROP COLUMN "model_id";--> statement-breakpoint
ALTER TABLE "generation_job" DROP COLUMN "model_spec_id";--> statement-breakpoint
ALTER TABLE "generation_job" DROP COLUMN "submitted_input";
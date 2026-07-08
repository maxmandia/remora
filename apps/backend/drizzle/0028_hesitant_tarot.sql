CREATE TYPE "public"."generation_rate_limit_bucket_kind" AS ENUM('request_window', 'concurrent_task');--> statement-breakpoint
CREATE TYPE "public"."generation_rate_limit_window_alignment" AS ENUM('rolling', 'calendar_day');--> statement-breakpoint
CREATE TABLE "generation_model_rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"bucket_id" text NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_model_rate_limit_conditions_object" CHECK (jsonb_typeof("generation_model_rate_limit"."conditions") = 'object')
);
--> statement-breakpoint
CREATE TABLE "generation_rate_limit_bucket" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"kind" "generation_rate_limit_bucket_kind" NOT NULL,
	"max_value" integer NOT NULL,
	"window_seconds" integer,
	"window_alignment" "generation_rate_limit_window_alignment",
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_rate_limit_bucket_max_value_positive" CHECK ("generation_rate_limit_bucket"."max_value" > 0),
	CONSTRAINT "generation_rate_limit_bucket_window_shape" CHECK ((
        "generation_rate_limit_bucket"."kind" = 'request_window'
        AND "generation_rate_limit_bucket"."window_seconds" > 0
        AND "generation_rate_limit_bucket"."window_alignment" IS NOT NULL
      ) OR (
        "generation_rate_limit_bucket"."kind" = 'concurrent_task'
        AND "generation_rate_limit_bucket"."window_seconds" IS NULL
        AND "generation_rate_limit_bucket"."window_alignment" IS NULL
      ))
);
--> statement-breakpoint
CREATE TABLE "generation_rate_limit_concurrency_lease" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_id" text NOT NULL,
	"job_id" text NOT NULL,
	"acquired_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"released_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_rate_limit_concurrency_lease_expires_after_acquired" CHECK ("generation_rate_limit_concurrency_lease"."expires_at" > "generation_rate_limit_concurrency_lease"."acquired_at"),
	CONSTRAINT "generation_rate_limit_concurrency_lease_released_after_acquired" CHECK ("generation_rate_limit_concurrency_lease"."released_at" IS NULL OR "generation_rate_limit_concurrency_lease"."released_at" >= "generation_rate_limit_concurrency_lease"."acquired_at")
);
--> statement-breakpoint
CREATE TABLE "generation_rate_limit_window_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_id" text NOT NULL,
	"job_id" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" ADD CONSTRAINT "generation_model_rate_limit_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_rate_limit" ADD CONSTRAINT "generation_model_rate_limit_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_bucket" ADD CONSTRAINT "generation_rate_limit_bucket_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_concurrency_lease" ADD CONSTRAINT "generation_rate_limit_concurrency_lease_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_concurrency_lease" ADD CONSTRAINT "generation_rate_limit_concurrency_lease_job_id_generation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_window_entry" ADD CONSTRAINT "generation_rate_limit_window_entry_bucket_id_generation_rate_limit_bucket_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "public"."generation_rate_limit_bucket"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_rate_limit_window_entry" ADD CONSTRAINT "generation_rate_limit_window_entry_job_id_generation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_model_rate_limit_model_id_bucket_id_idx" ON "generation_model_rate_limit" USING btree ("model_id","bucket_id");--> statement-breakpoint
CREATE INDEX "generation_model_rate_limit_bucket_id_idx" ON "generation_model_rate_limit" USING btree ("bucket_id");--> statement-breakpoint
CREATE INDEX "generation_rate_limit_concurrency_lease_bucket_active_idx" ON "generation_rate_limit_concurrency_lease" USING btree ("bucket_id","released_at","expires_at");--> statement-breakpoint
CREATE INDEX "generation_rate_limit_concurrency_lease_job_id_idx" ON "generation_rate_limit_concurrency_lease" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "generation_rate_limit_window_entry_bucket_occurred_at_idx" ON "generation_rate_limit_window_entry" USING btree ("bucket_id","occurred_at");
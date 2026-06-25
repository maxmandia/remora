CREATE TABLE "generation_job_cost_estimate" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"estimated_cost_usd_micros" bigint NOT NULL,
	"currency_code" text DEFAULT 'USD' NOT NULL,
	"pricing_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_job_cost_estimate_cost_nonnegative" CHECK ("generation_job_cost_estimate"."estimated_cost_usd_micros" >= 0),
	CONSTRAINT "generation_job_cost_estimate_currency_usd" CHECK ("generation_job_cost_estimate"."currency_code" = 'USD'),
	CONSTRAINT "generation_job_cost_estimate_pricing_snapshot_object" CHECK (jsonb_typeof("generation_job_cost_estimate"."pricing_snapshot") = 'object')
);
--> statement-breakpoint
ALTER TABLE "generation_job_cost_estimate" ADD CONSTRAINT "generation_job_cost_estimate_job_id_generation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "generation_job_cost_estimate_job_id_idx" ON "generation_job_cost_estimate" USING btree ("job_id");

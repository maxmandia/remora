ALTER TABLE "generation_job_cost" ADD COLUMN "provider_cost_usd_micros" bigint;--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD COLUMN "provider_cost_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD CONSTRAINT "generation_job_cost_provider_cost_nonnegative" CHECK ("generation_job_cost"."provider_cost_usd_micros" IS NULL OR "generation_job_cost"."provider_cost_usd_micros" >= 0);--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD CONSTRAINT "generation_job_cost_provider_cost_snapshot_object" CHECK ("generation_job_cost"."provider_cost_snapshot" IS NULL OR jsonb_typeof("generation_job_cost"."provider_cost_snapshot") = 'object');--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD CONSTRAINT "generation_job_cost_provider_cost_fields_all_or_none" CHECK ((
        "generation_job_cost"."provider_cost_usd_micros" IS NULL
        AND "generation_job_cost"."provider_cost_snapshot" IS NULL
      ) OR (
        "generation_job_cost"."provider_cost_usd_micros" IS NOT NULL
        AND "generation_job_cost"."provider_cost_snapshot" IS NOT NULL
      ));
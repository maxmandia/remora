CREATE TYPE "public"."generation_job_final_cost_basis" AS ENUM('provider_reported_cost', 'provider_reported_units', 'provider_usage', 'pricing_formula', 'not_charged');--> statement-breakpoint
ALTER TABLE "generation_job_cost_estimate" RENAME TO "generation_job_cost";--> statement-breakpoint
ALTER TABLE "generation_job_cost" RENAME COLUMN "pricing_snapshot" TO "estimated_cost_snapshot";--> statement-breakpoint
ALTER TABLE "generation_job_cost" RENAME CONSTRAINT "generation_job_cost_estimate_cost_nonnegative" TO "generation_job_cost_estimated_cost_nonnegative";--> statement-breakpoint
ALTER TABLE "generation_job_cost" RENAME CONSTRAINT "generation_job_cost_estimate_currency_usd" TO "generation_job_cost_currency_usd";--> statement-breakpoint
ALTER TABLE "generation_job_cost" RENAME CONSTRAINT "generation_job_cost_estimate_pricing_snapshot_object" TO "generation_job_cost_estimated_cost_snapshot_object";--> statement-breakpoint
ALTER TABLE "generation_job_cost" RENAME CONSTRAINT "generation_job_cost_estimate_job_id_generation_job_id_fk" TO "generation_job_cost_job_id_generation_job_id_fk";--> statement-breakpoint
ALTER INDEX "generation_job_cost_estimate_job_id_idx" RENAME TO "generation_job_cost_job_id_idx";--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD COLUMN "final_cost_usd_micros" bigint;--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD COLUMN "final_cost_basis" "generation_job_final_cost_basis";--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD COLUMN "finalized_at" timestamp;--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD CONSTRAINT "generation_job_cost_final_cost_nonnegative" CHECK ("generation_job_cost"."final_cost_usd_micros" IS NULL OR "generation_job_cost"."final_cost_usd_micros" >= 0);--> statement-breakpoint
ALTER TABLE "generation_job_cost" ADD CONSTRAINT "generation_job_cost_final_fields_all_or_none" CHECK ((
        "generation_job_cost"."final_cost_usd_micros" IS NULL
        AND "generation_job_cost"."final_cost_basis" IS NULL
        AND "generation_job_cost"."finalized_at" IS NULL
      ) OR (
        "generation_job_cost"."final_cost_usd_micros" IS NOT NULL
        AND "generation_job_cost"."final_cost_basis" IS NOT NULL
        AND "generation_job_cost"."finalized_at" IS NOT NULL
      ));

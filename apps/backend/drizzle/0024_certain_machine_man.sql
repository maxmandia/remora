CREATE TABLE "generation_pricing_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"surcharge_basis_points" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_pricing_policy_surcharge_basis_points_nonnegative" CHECK ("generation_pricing_policy"."surcharge_basis_points" >= 0)
);--> statement-breakpoint
INSERT INTO "generation_pricing_policy" (
  "id",
  "surcharge_basis_points"
)
VALUES (
  'global-generation-surcharge-2026-06-25',
  1000
);

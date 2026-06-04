CREATE TYPE "public"."generation_model_type" AS ENUM('video');--> statement-breakpoint
CREATE TYPE "public"."generation_publication_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "generation_model" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"display_name" text NOT NULL,
	"type" "generation_model_type" NOT NULL,
	"status" "generation_publication_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_model_spec" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"version" integer NOT NULL,
	"schema_version" integer NOT NULL,
	"status" "generation_publication_status" DEFAULT 'draft' NOT NULL,
	"spec" jsonb NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_provider" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_model" ADD CONSTRAINT "generation_model_provider_id_generation_provider_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."generation_provider"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_model_spec" ADD CONSTRAINT "generation_model_spec_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_model_provider_id_idx" ON "generation_model" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "generation_model_status_idx" ON "generation_model" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "generation_model_spec_model_id_version_idx" ON "generation_model_spec" USING btree ("model_id","version");--> statement-breakpoint
CREATE INDEX "generation_model_spec_model_id_idx" ON "generation_model_spec" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "generation_model_spec_status_idx" ON "generation_model_spec" USING btree ("status");

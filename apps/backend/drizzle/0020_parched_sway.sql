CREATE TYPE "public"."generation_model_rate_component" AS ENUM('output_video', 'input_video', 'input_image', 'provider_video_tokens');--> statement-breakpoint
CREATE TYPE "public"."generation_model_rate_quantity_unit" AS ENUM('second', 'image', 'token');--> statement-breakpoint
CREATE TABLE "generation_model_rate" (
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"component" "generation_model_rate_component" NOT NULL,
	"quantity_source" text NOT NULL,
	"final_quantity_source" text,
	"quantity_unit" "generation_model_rate_quantity_unit" NOT NULL,
	"unit_quantity" integer NOT NULL,
	"unit_price_usd_micros" bigint NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "generation_model_rate_unit_quantity_positive" CHECK ("generation_model_rate"."unit_quantity" > 0),
	CONSTRAINT "generation_model_rate_unit_price_usd_micros_nonnegative" CHECK ("generation_model_rate"."unit_price_usd_micros" >= 0),
	CONSTRAINT "generation_model_rate_conditions_object" CHECK (jsonb_typeof("generation_model_rate"."conditions") = 'object')
);
--> statement-breakpoint
ALTER TABLE "generation_model_rate" ADD CONSTRAINT "generation_model_rate_model_id_generation_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."generation_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_model_rate_model_id_idx" ON "generation_model_rate" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "generation_model_rate_model_id_component_idx" ON "generation_model_rate" USING btree ("model_id","component");
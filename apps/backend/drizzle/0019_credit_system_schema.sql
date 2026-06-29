CREATE TYPE "public"."billing_payment_method_status" AS ENUM('none', 'active', 'requires_action', 'failed');--> statement-breakpoint
CREATE TYPE "public"."credit_ledger_entry_type" AS ENUM('manual_credit_purchase', 'auto_top_up_credit_purchase', 'generation_credit_reservation', 'generation_credit_charge', 'generation_credit_reservation_release', 'generation_credit_refund', 'admin_credit_adjustment');--> statement-breakpoint
CREATE TABLE "billing_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"default_stripe_payment_method_id" text,
	"off_session_payments_enabled" boolean DEFAULT false NOT NULL,
	"off_session_consent_at" timestamp,
	"payment_method_status" "billing_payment_method_status" DEFAULT 'none' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_auto_top_up_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"top_up_floor_usd_micros" bigint DEFAULT 0 NOT NULL,
	"top_up_amount_usd_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_auto_top_up_floor_nonnegative" CHECK ("credit_auto_top_up_settings"."top_up_floor_usd_micros" >= 0),
	CONSTRAINT "credit_auto_top_up_amount_nonnegative" CHECK ("credit_auto_top_up_settings"."top_up_amount_usd_micros" >= 0)
);
--> statement-breakpoint
CREATE TABLE "credit_ledger_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"entry_type" "credit_ledger_entry_type" NOT NULL,
	"available_credit_delta_usd_micros" bigint NOT NULL,
	"reserved_credit_delta_usd_micros" bigint NOT NULL,
	"available_credit_amount_usd_micros_after" bigint NOT NULL,
	"reserved_credit_amount_usd_micros_after" bigint NOT NULL,
	"generation_job_id" text,
	"stripe_checkout_session_id" text,
	"stripe_payment_intent_id" text,
	"stripe_event_id" text,
	"idempotency_key" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_ledger_entry_available_after_nonnegative" CHECK ("credit_ledger_entry"."available_credit_amount_usd_micros_after" >= 0),
	CONSTRAINT "credit_ledger_entry_reserved_after_nonnegative" CHECK ("credit_ledger_entry"."reserved_credit_amount_usd_micros_after" >= 0)
);
--> statement-breakpoint
CREATE TABLE "user_balance" (
	"user_id" text PRIMARY KEY NOT NULL,
	"available_credit_amount_usd_micros" bigint DEFAULT 0 NOT NULL,
	"reserved_credit_amount_usd_micros" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_balance_available_nonnegative" CHECK ("user_balance"."available_credit_amount_usd_micros" >= 0),
	CONSTRAINT "user_balance_reserved_nonnegative" CHECK ("user_balance"."reserved_credit_amount_usd_micros" >= 0)
);
--> statement-breakpoint
ALTER TABLE "billing_profile" ADD CONSTRAINT "billing_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_auto_top_up_settings" ADD CONSTRAINT "credit_auto_top_up_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger_entry" ADD CONSTRAINT "credit_ledger_entry_generation_job_id_generation_job_id_fk" FOREIGN KEY ("generation_job_id") REFERENCES "public"."generation_job"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_balance" ADD CONSTRAINT "user_balance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_profile_stripe_customer_id_idx" ON "billing_profile" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_entry_user_created_at_idx" ON "credit_ledger_entry" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_entry_generation_job_id_idx" ON "credit_ledger_entry" USING btree ("generation_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entry_idempotency_key_idx" ON "credit_ledger_entry" USING btree ("idempotency_key");

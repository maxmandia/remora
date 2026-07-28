CREATE TYPE "public"."google_ads_click_id_type" AS ENUM('gclid', 'gbraid', 'wbraid');--> statement-breakpoint
CREATE TYPE "public"."google_ads_purchase_conversion_status" AS ENUM('skipped', 'pending', 'accepted', 'processing', 'succeeded', 'failed', 'timed_out');--> statement-breakpoint
CREATE TABLE "google_ads_click_attribution" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"click_id_type" "google_ads_click_id_type" NOT NULL,
	"click_id" text NOT NULL,
	"captured_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "google_ads_click_attribution_expiry_valid" CHECK ("google_ads_click_attribution"."expires_at" > "google_ads_click_attribution"."captured_at")
);
--> statement-breakpoint
CREATE TABLE "google_ads_purchase_conversion" (
	"transaction_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"attribution_id" text,
	"stripe_checkout_session_id" text NOT NULL,
	"credit_ledger_entry_id" text NOT NULL,
	"event_occurred_at" timestamp NOT NULL,
	"status" "google_ads_purchase_conversion_status" DEFAULT 'pending' NOT NULL,
	"google_request_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "google_ads_click_attribution" ADD CONSTRAINT "google_ads_click_attribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_purchase_conversion" ADD CONSTRAINT "google_ads_purchase_conversion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_purchase_conversion" ADD CONSTRAINT "google_ads_purchase_conversion_attribution_id_google_ads_click_attribution_id_fk" FOREIGN KEY ("attribution_id") REFERENCES "public"."google_ads_click_attribution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "google_ads_purchase_conversion" ADD CONSTRAINT "google_ads_purchase_conversion_credit_ledger_entry_id_credit_ledger_entry_id_fk" FOREIGN KEY ("credit_ledger_entry_id") REFERENCES "public"."credit_ledger_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "google_ads_click_attribution_user_click_idx" ON "google_ads_click_attribution" USING btree ("user_id","click_id_type","click_id");--> statement-breakpoint
CREATE INDEX "google_ads_click_attribution_user_captured_at_idx" ON "google_ads_click_attribution" USING btree ("user_id","captured_at");--> statement-breakpoint
CREATE INDEX "google_ads_click_attribution_expires_at_idx" ON "google_ads_click_attribution" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "google_ads_purchase_conversion_checkout_session_idx" ON "google_ads_purchase_conversion" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_ads_purchase_conversion_ledger_entry_idx" ON "google_ads_purchase_conversion" USING btree ("credit_ledger_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "google_ads_purchase_conversion_request_idx" ON "google_ads_purchase_conversion" USING btree ("google_request_id");--> statement-breakpoint
CREATE INDEX "google_ads_purchase_conversion_status_updated_at_idx" ON "google_ads_purchase_conversion" USING btree ("status","updated_at");

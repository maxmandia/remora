CREATE TYPE "public"."promotion_offer_version" AS ENUM('guest_generation_v1');--> statement-breakpoint
ALTER TYPE "public"."credit_ledger_entry_type" ADD VALUE 'promotional_credit_grant';--> statement-breakpoint
CREATE TABLE "promotion_claim" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"offer_version" "promotion_offer_version" NOT NULL,
	"amount_usd_micros" bigint NOT NULL,
	"ticket_issued_at" timestamp NOT NULL,
	"ticket_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"redeemed_at" timestamp,
	"credit_ledger_entry_id" text,
	CONSTRAINT "promotion_claim_amount_positive" CHECK ("promotion_claim"."amount_usd_micros" > 0),
	CONSTRAINT "promotion_claim_ticket_window_valid" CHECK ("promotion_claim"."ticket_expires_at" > "promotion_claim"."ticket_issued_at"),
	CONSTRAINT "promotion_claim_redemption_complete" CHECK (("promotion_claim"."redeemed_at" IS NULL AND "promotion_claim"."credit_ledger_entry_id" IS NULL) OR ("promotion_claim"."redeemed_at" IS NOT NULL AND "promotion_claim"."credit_ledger_entry_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "promotion_claim" ADD CONSTRAINT "promotion_claim_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_claim" ADD CONSTRAINT "promotion_claim_credit_ledger_entry_id_fk" FOREIGN KEY ("credit_ledger_entry_id") REFERENCES "public"."credit_ledger_entry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_claim_user_id_idx" ON "promotion_claim" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_claim_credit_ledger_entry_id_idx" ON "promotion_claim" USING btree ("credit_ledger_entry_id");

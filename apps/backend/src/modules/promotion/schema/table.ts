import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  foreignKey,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { creditLedgerEntry } from "../../credits/schema/table.ts";
import {
  promotionOfferVersions,
  type PromotionOfferVersion,
} from "../promotion.types.ts";

export const promotionOfferVersion = pgEnum(
  "promotion_offer_version",
  promotionOfferVersions,
);

export const promotionClaim = pgTable(
  "promotion_claim",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    offerVersion: promotionOfferVersion("offer_version")
      .$type<PromotionOfferVersion>()
      .notNull(),
    amountUsdMicros: bigint("amount_usd_micros", {
      mode: "number",
    }).notNull(),
    ticketIssuedAt: timestamp("ticket_issued_at").notNull(),
    ticketExpiresAt: timestamp("ticket_expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    redeemedAt: timestamp("redeemed_at"),
    creditLedgerEntryId: text("credit_ledger_entry_id"),
  },
  (table) => [
    uniqueIndex("promotion_claim_user_id_idx").on(table.userId),
    uniqueIndex("promotion_claim_credit_ledger_entry_id_idx").on(
      table.creditLedgerEntryId,
    ),
    foreignKey({
      name: "promotion_claim_credit_ledger_entry_id_fk",
      columns: [table.creditLedgerEntryId],
      foreignColumns: [creditLedgerEntry.id],
    }),
    check("promotion_claim_amount_positive", sql`${table.amountUsdMicros} > 0`),
    check(
      "promotion_claim_ticket_window_valid",
      sql`${table.ticketExpiresAt} > ${table.ticketIssuedAt}`,
    ),
    check(
      "promotion_claim_redemption_complete",
      sql`(${table.redeemedAt} IS NULL AND ${table.creditLedgerEntryId} IS NULL) OR (${table.redeemedAt} IS NOT NULL AND ${table.creditLedgerEntryId} IS NOT NULL)`,
    ),
  ],
);

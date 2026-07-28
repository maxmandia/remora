import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { creditLedgerEntry } from "../../credits/schema/table.ts";
import {
  googleAdsClickIdTypes,
  googleAdsPurchaseConversionStatuses,
  type GoogleAdsClickIdType,
  type GoogleAdsPurchaseConversionStatus,
} from "../google_ads.types.ts";

export const googleAdsClickIdType = pgEnum(
  "google_ads_click_id_type",
  googleAdsClickIdTypes,
);

export const googleAdsPurchaseConversionStatus = pgEnum(
  "google_ads_purchase_conversion_status",
  googleAdsPurchaseConversionStatuses,
);

export const googleAdsClickAttribution = pgTable(
  "google_ads_click_attribution",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    clickIdType: googleAdsClickIdType("click_id_type")
      .$type<GoogleAdsClickIdType>()
      .notNull(),
    clickId: text("click_id").notNull(),
    capturedAt: timestamp("captured_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("google_ads_click_attribution_user_click_idx").on(
      table.userId,
      table.clickIdType,
      table.clickId,
    ),
    index("google_ads_click_attribution_user_captured_at_idx").on(
      table.userId,
      table.capturedAt,
    ),
    index("google_ads_click_attribution_expires_at_idx").on(table.expiresAt),
    check(
      "google_ads_click_attribution_expiry_valid",
      sql`${table.expiresAt} > ${table.capturedAt}`,
    ),
  ],
);

export const googleAdsPurchaseConversion = pgTable(
  "google_ads_purchase_conversion",
  {
    transactionId: text("transaction_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    attributionId: text("attribution_id").references(
      () => googleAdsClickAttribution.id,
      { onDelete: "set null" },
    ),
    stripeCheckoutSessionId: text("stripe_checkout_session_id").notNull(),
    creditLedgerEntryId: text("credit_ledger_entry_id")
      .notNull()
      .references(() => creditLedgerEntry.id),
    eventOccurredAt: timestamp("event_occurred_at").notNull(),
    status: googleAdsPurchaseConversionStatus("status")
      .$type<GoogleAdsPurchaseConversionStatus>()
      .default("pending")
      .notNull(),
    googleRequestId: text("google_request_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("google_ads_purchase_conversion_checkout_session_idx").on(
      table.stripeCheckoutSessionId,
    ),
    uniqueIndex("google_ads_purchase_conversion_ledger_entry_idx").on(
      table.creditLedgerEntryId,
    ),
    uniqueIndex("google_ads_purchase_conversion_request_idx").on(
      table.googleRequestId,
    ),
    index("google_ads_purchase_conversion_status_updated_at_idx").on(
      table.status,
      table.updatedAt,
    ),
  ],
);

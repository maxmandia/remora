import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import {
  billingPaymentMethodStatuses,
  type BillingPaymentMethodStatus,
} from "../billing.types.ts";

export const billingPaymentMethodStatus = pgEnum(
  "billing_payment_method_status",
  billingPaymentMethodStatuses,
);

export const billingProfile = pgTable(
  "billing_profile",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    defaultStripePaymentMethodId: text("default_stripe_payment_method_id"),
    offSessionPaymentsEnabled: boolean("off_session_payments_enabled")
      .default(false)
      .notNull(),
    offSessionConsentAt: timestamp("off_session_consent_at"),
    paymentMethodStatus: billingPaymentMethodStatus("payment_method_status")
      .$type<BillingPaymentMethodStatus>()
      .default("none")
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("billing_profile_stripe_customer_id_idx").on(
      table.stripeCustomerId,
    ),
  ],
);

export const creditAutoTopUpSettings = pgTable(
  "credit_auto_top_up_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    topUpFloor: integer("top_up_floor").default(0).notNull(),
    topUpAmount: integer("top_up_amount").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check("credit_auto_top_up_floor_nonnegative", sql`${table.topUpFloor} >= 0`),
    check(
      "credit_auto_top_up_amount_nonnegative",
      sql`${table.topUpAmount} >= 0`,
    ),
  ],
);

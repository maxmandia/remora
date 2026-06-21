import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { generationJob } from "../../generation/schema/table.ts";
import type {
  CreditLedgerEntryMetadata,
  CreditLedgerEntryType,
} from "../credits.types.ts";
import { creditLedgerEntryTypes } from "../credits.types.ts";

export const creditLedgerEntryType = pgEnum(
  "credit_ledger_entry_type",
  creditLedgerEntryTypes,
);

export const userBalance = pgTable(
  "user_balance",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    availableCreditAmount: integer("available_credit_amount")
      .default(0)
      .notNull(),
    reservedCreditAmount: integer("reserved_credit_amount")
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    check(
      "user_balance_available_nonnegative",
      sql`${table.availableCreditAmount} >= 0`,
    ),
    check(
      "user_balance_reserved_nonnegative",
      sql`${table.reservedCreditAmount} >= 0`,
    ),
  ],
);

export const creditLedgerEntry = pgTable(
  "credit_ledger_entry",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    entryType: creditLedgerEntryType("entry_type")
      .$type<CreditLedgerEntryType>()
      .notNull(),
    availableCreditDelta: integer("available_credit_delta").notNull(),
    reservedCreditDelta: integer("reserved_credit_delta").notNull(),
    availableCreditAmountAfter: integer(
      "available_credit_amount_after",
    ).notNull(),
    reservedCreditAmountAfter: integer("reserved_credit_amount_after").notNull(),
    generationJobId: text("generation_job_id").references(
      () => generationJob.id,
    ),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    stripeEventId: text("stripe_event_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    metadata: jsonb("metadata")
      .$type<CreditLedgerEntryMetadata>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("credit_ledger_entry_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    index("credit_ledger_entry_generation_job_id_idx").on(
      table.generationJobId,
    ),
    uniqueIndex("credit_ledger_entry_idempotency_key_idx").on(
      table.idempotencyKey,
    ),
    check(
      "credit_ledger_entry_available_after_nonnegative",
      sql`${table.availableCreditAmountAfter} >= 0`,
    ),
    check(
      "credit_ledger_entry_reserved_after_nonnegative",
      sql`${table.reservedCreditAmountAfter} >= 0`,
    ),
  ],
);

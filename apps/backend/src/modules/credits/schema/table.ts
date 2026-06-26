import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
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
    availableCreditAmountUsdMicros: bigint(
      "available_credit_amount_usd_micros",
      { mode: "number" },
    )
      .default(0)
      .notNull(),
    reservedCreditAmountUsdMicros: bigint("reserved_credit_amount_usd_micros", {
      mode: "number",
    })
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
      "user_balance_reserved_nonnegative",
      sql`${table.reservedCreditAmountUsdMicros} >= 0`,
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
    availableCreditDeltaUsdMicros: bigint("available_credit_delta_usd_micros", {
      mode: "number",
    }).notNull(),
    reservedCreditDeltaUsdMicros: bigint("reserved_credit_delta_usd_micros", {
      mode: "number",
    }).notNull(),
    availableCreditAmountUsdMicrosAfter: bigint(
      "available_credit_amount_usd_micros_after",
      { mode: "number" },
    ).notNull(),
    reservedCreditAmountUsdMicrosAfter: bigint(
      "reserved_credit_amount_usd_micros_after",
      { mode: "number" },
    ).notNull(),
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
      "credit_ledger_entry_reserved_after_nonnegative",
      sql`${table.reservedCreditAmountUsdMicrosAfter} >= 0`,
    ),
  ],
);

import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";

export const creditAutoTopUpSettings = pgTable(
  "credit_auto_top_up_settings",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(false).notNull(),
    topUpFloorUsdMicros: bigint("top_up_floor_usd_micros", {
      mode: "number",
    })
      .default(0)
      .notNull(),
    topUpAmountUsdMicros: bigint("top_up_amount_usd_micros", {
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
      "credit_auto_top_up_floor_nonnegative",
      sql`${table.topUpFloorUsdMicros} >= 0`,
    ),
    check(
      "credit_auto_top_up_amount_nonnegative",
      sql`${table.topUpAmountUsdMicros} >= 0`,
    ),
  ],
);

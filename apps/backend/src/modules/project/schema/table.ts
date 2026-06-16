import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { projectUserIdLowerNameIndexName } from "../project.types.ts";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_user_id_idx").on(table.userId),
    index("project_user_id_archived_at_updated_at_idx").on(
      table.userId,
      table.archivedAt,
      table.updatedAt,
    ),
    uniqueIndex("project_id_user_id_idx").on(table.id, table.userId),
    uniqueIndex(projectUserIdLowerNameIndexName).on(
      table.userId,
      sql`lower(${table.name})`,
    ),
  ],
);

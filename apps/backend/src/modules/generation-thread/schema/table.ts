import {
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "../../auth/schema/table.ts";
import { project } from "../../project/schema/table.ts";

export const generationThread = pgTable(
  "generation_thread",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("generation_thread_user_id_idx").on(table.userId),
    index("generation_thread_user_id_updated_at_idx").on(
      table.userId,
      table.updatedAt,
    ),
    index("generation_thread_user_id_project_id_updated_at_idx").on(
      table.userId,
      table.projectId,
      table.updatedAt,
    ),
    uniqueIndex("generation_thread_id_user_id_idx").on(table.id, table.userId),
    foreignKey({
      columns: [table.projectId, table.userId],
      foreignColumns: [project.id, project.userId],
      name: "generation_thread_project_user_fk",
    }),
  ],
);

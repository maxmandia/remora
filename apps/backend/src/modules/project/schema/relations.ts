import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { generationThread } from "../../generation/schema/table.ts";
import { project } from "./table.ts";

export const projectRelations = relations(project, ({ many, one }) => ({
  user: one(user, {
    fields: [project.userId],
    references: [user.id],
  }),
  threads: many(generationThread),
}));

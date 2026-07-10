import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { generationSubmission } from "../../generation/schema/table.ts";
import { project } from "../../project/schema/table.ts";
import { generationThread } from "./table.ts";

export const generationThreadRelations = relations(
  generationThread,
  ({ many, one }) => ({
    project: one(project, {
      fields: [generationThread.projectId, generationThread.userId],
      references: [project.id, project.userId],
    }),
    user: one(user, {
      fields: [generationThread.userId],
      references: [user.id],
    }),
    submissions: many(generationSubmission),
  }),
);

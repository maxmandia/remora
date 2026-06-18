import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { generationSubmission } from "../../generation/schema/table.ts";
import {
  generationReferenceMedia,
  generationSubmissionReferenceMedia,
} from "./table.ts";

export const generationReferenceMediaRelations = relations(
  generationReferenceMedia,
  ({ many, one }) => ({
    user: one(user, {
      fields: [generationReferenceMedia.userId],
      references: [user.id],
    }),
    submissions: many(generationSubmissionReferenceMedia),
  }),
);

export const generationSubmissionReferenceMediaRelations = relations(
  generationSubmissionReferenceMedia,
  ({ one }) => ({
    submission: one(generationSubmission, {
      fields: [generationSubmissionReferenceMedia.submissionId],
      references: [generationSubmission.id],
    }),
    referenceMedia: one(generationReferenceMedia, {
      fields: [generationSubmissionReferenceMedia.referenceMediaId],
      references: [generationReferenceMedia.id],
    }),
  }),
);

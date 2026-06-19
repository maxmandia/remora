import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { generationSubmission } from "../../generation/schema/table.ts";
import {
  generationAttachmentMedia,
  generationSubmissionAttachmentMedia,
} from "./table.ts";

export const generationAttachmentMediaRelations = relations(
  generationAttachmentMedia,
  ({ many, one }) => ({
    user: one(user, {
      fields: [generationAttachmentMedia.userId],
      references: [user.id],
    }),
    submissions: many(generationSubmissionAttachmentMedia),
  }),
);

export const generationSubmissionAttachmentMediaRelations = relations(
  generationSubmissionAttachmentMedia,
  ({ one }) => ({
    submission: one(generationSubmission, {
      fields: [generationSubmissionAttachmentMedia.submissionId],
      references: [generationSubmission.id],
    }),
    attachmentMedia: one(generationAttachmentMedia, {
      fields: [generationSubmissionAttachmentMedia.attachmentMediaId],
      references: [generationAttachmentMedia.id],
    }),
  }),
);

import { relations } from "drizzle-orm";

import { user } from "../../auth/schema/table.ts";
import { creditLedgerEntry } from "../../credits/schema/table.ts";
import { generationJobCostEstimate } from "../../model_rates/schema/table.ts";
import {
  generationModel,
  generationModelSpec,
  generationProvider,
} from "../../model/schema/table.ts";
import { project } from "../../project/schema/table.ts";
import { generationSubmissionAttachmentMedia } from "../../generation-attachment-media/schema/table.ts";
import {
  generationJob,
  generationResult,
  generationResultAsset,
  generationResultPreview,
  generationSubmission,
  generationThread,
} from "./table.ts";

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

export const generationSubmissionRelations = relations(
  generationSubmission,
  ({ many, one }) => ({
    thread: one(generationThread, {
      fields: [generationSubmission.threadId, generationSubmission.userId],
      references: [generationThread.id, generationThread.userId],
    }),
    user: one(user, {
      fields: [generationSubmission.userId],
      references: [user.id],
    }),
    model: one(generationModel, {
      fields: [generationSubmission.modelId],
      references: [generationModel.id],
    }),
    modelSpec: one(generationModelSpec, {
      fields: [generationSubmission.modelSpecId],
      references: [generationModelSpec.id],
    }),
    jobs: many(generationJob),
    attachmentMedia: many(generationSubmissionAttachmentMedia),
  }),
);

export const generationJobRelations = relations(
  generationJob,
  ({ many, one }) => ({
    submission: one(generationSubmission, {
      fields: [generationJob.submissionId],
      references: [generationSubmission.id],
    }),
    provider: one(generationProvider, {
      fields: [generationJob.providerId],
      references: [generationProvider.id],
    }),
    result: one(generationResult, {
      fields: [generationJob.id],
      references: [generationResult.jobId],
    }),
    costEstimate: one(generationJobCostEstimate, {
      fields: [generationJob.id],
      references: [generationJobCostEstimate.jobId],
    }),
    creditLedgerEntries: many(creditLedgerEntry),
  }),
);

export const generationResultRelations = relations(
  generationResult,
  ({ many, one }) => ({
    job: one(generationJob, {
      fields: [generationResult.jobId],
      references: [generationJob.id],
    }),
    provider: one(generationProvider, {
      fields: [generationResult.providerId],
      references: [generationProvider.id],
    }),
    assets: many(generationResultAsset),
    preview: one(generationResultPreview),
  }),
);

export const generationResultAssetRelations = relations(
  generationResultAsset,
  ({ one }) => ({
    result: one(generationResult, {
      fields: [generationResultAsset.resultId],
      references: [generationResult.id],
    }),
  }),
);

export const generationResultPreviewRelations = relations(
  generationResultPreview,
  ({ one }) => ({
    result: one(generationResult, {
      fields: [generationResultPreview.resultId],
      references: [generationResult.id],
    }),
  }),
);

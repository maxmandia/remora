import { relations } from "drizzle-orm";

import { generationJob } from "../../generation/schema/table.ts";
import {
  generationModel,
  generationProvider,
} from "../../model/schema/table.ts";
import {
  generationModelRateLimit,
  generationRateLimitBucket,
  generationRateLimitConcurrencyLease,
  generationRateLimitWindowEntry,
} from "./table.ts";

export const generationRateLimitBucketRelations = relations(
  generationRateLimitBucket,
  ({ many, one }) => ({
    provider: one(generationProvider, {
      fields: [generationRateLimitBucket.providerId],
      references: [generationProvider.id],
    }),
    modelRateLimits: many(generationModelRateLimit),
    windowEntries: many(generationRateLimitWindowEntry),
    concurrencyLeases: many(generationRateLimitConcurrencyLease),
  }),
);

export const generationModelRateLimitRelations = relations(
  generationModelRateLimit,
  ({ one }) => ({
    model: one(generationModel, {
      fields: [generationModelRateLimit.modelId],
      references: [generationModel.id],
    }),
    bucket: one(generationRateLimitBucket, {
      fields: [generationModelRateLimit.bucketId],
      references: [generationRateLimitBucket.id],
    }),
  }),
);

export const generationRateLimitWindowEntryRelations = relations(
  generationRateLimitWindowEntry,
  ({ one }) => ({
    bucket: one(generationRateLimitBucket, {
      fields: [generationRateLimitWindowEntry.bucketId],
      references: [generationRateLimitBucket.id],
    }),
    job: one(generationJob, {
      fields: [generationRateLimitWindowEntry.jobId],
      references: [generationJob.id],
    }),
  }),
);

export const generationRateLimitConcurrencyLeaseRelations = relations(
  generationRateLimitConcurrencyLease,
  ({ one }) => ({
    bucket: one(generationRateLimitBucket, {
      fields: [generationRateLimitConcurrencyLease.bucketId],
      references: [generationRateLimitBucket.id],
    }),
    job: one(generationJob, {
      fields: [generationRateLimitConcurrencyLease.jobId],
      references: [generationJob.id],
    }),
  }),
);

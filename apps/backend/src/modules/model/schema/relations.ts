import { relations } from "drizzle-orm";

import {
  generationModelRateLimit,
  generationRateLimitBucket,
} from "../../model_rate_limits/schema/table.ts";
import { generationModelRate } from "../../model_rates/schema/table.ts";
import {
  generationModel,
  generationModelSpec,
  generationProvider,
} from "./table.ts";

export const generationProviderRelations = relations(
  generationProvider,
  ({ many }) => ({
    models: many(generationModel),
    rateLimitBuckets: many(generationRateLimitBucket),
  }),
);

export const generationModelRelations = relations(
  generationModel,
  ({ one, many }) => ({
    provider: one(generationProvider, {
      fields: [generationModel.providerId],
      references: [generationProvider.id],
    }),
    specs: many(generationModelSpec),
  }),
);

export const generationModelSpecRelations = relations(
  generationModelSpec,
  ({ one, many }) => ({
    model: one(generationModel, {
      fields: [generationModelSpec.modelId],
      references: [generationModel.id],
    }),
    rates: many(generationModelRate),
    rateLimits: many(generationModelRateLimit),
  }),
);

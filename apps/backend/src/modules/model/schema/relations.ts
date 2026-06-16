import { relations } from "drizzle-orm";

import {
  generationModel,
  generationModelSpec,
  generationProvider,
} from "./table.ts";

export const generationProviderRelations = relations(
  generationProvider,
  ({ many }) => ({
    models: many(generationModel),
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
  ({ one }) => ({
    model: one(generationModel, {
      fields: [generationModelSpec.modelId],
      references: [generationModel.id],
    }),
  }),
);

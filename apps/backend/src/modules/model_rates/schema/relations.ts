import { relations } from "drizzle-orm";

import { generationModel } from "../../model/schema/table.ts";
import { generationModelRate } from "./table.ts";

export const generationModelRateRelations = relations(
  generationModelRate,
  ({ one }) => ({
    model: one(generationModel, {
      fields: [generationModelRate.modelId],
      references: [generationModel.id],
    }),
  }),
);

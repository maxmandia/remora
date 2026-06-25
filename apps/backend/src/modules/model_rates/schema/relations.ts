import { relations } from "drizzle-orm";

import { generationJob } from "../../generation/schema/table.ts";
import { generationModel } from "../../model/schema/table.ts";
import { generationJobCost, generationModelRate } from "./table.ts";

export const generationModelRateRelations = relations(
  generationModelRate,
  ({ one }) => ({
    model: one(generationModel, {
      fields: [generationModelRate.modelId],
      references: [generationModel.id],
    }),
  }),
);

export const generationJobCostRelations = relations(
  generationJobCost,
  ({ one }) => ({
    job: one(generationJob, {
      fields: [generationJobCost.jobId],
      references: [generationJob.id],
    }),
  }),
);

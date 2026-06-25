import { relations } from "drizzle-orm";

import { generationJob } from "../../generation/schema/table.ts";
import { generationModel } from "../../model/schema/table.ts";
import { generationJobCostEstimate, generationModelRate } from "./table.ts";

export const generationModelRateRelations = relations(
  generationModelRate,
  ({ one }) => ({
    model: one(generationModel, {
      fields: [generationModelRate.modelId],
      references: [generationModel.id],
    }),
  }),
);

export const generationJobCostEstimateRelations = relations(
  generationJobCostEstimate,
  ({ one }) => ({
    job: one(generationJob, {
      fields: [generationJobCostEstimate.jobId],
      references: [generationJob.id],
    }),
  }),
);

import { relations } from "drizzle-orm";

import { generationJob } from "../../generation/schema/table.ts";
import { generationModelSpec } from "../../model/schema/table.ts";
import { generationJobCost, generationModelRate } from "./table.ts";

export const generationModelRateRelations = relations(
  generationModelRate,
  ({ one }) => ({
    modelSpec: one(generationModelSpec, {
      fields: [generationModelRate.modelSpecId],
      references: [generationModelSpec.id],
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

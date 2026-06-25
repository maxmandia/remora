import { asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type { CreateGenerationJobCostEstimateInput } from "./model_rates.types.ts";

export class ModelRatesRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listModelRates(
    modelId: string,
  ): Promise<(typeof schema.generationModelRate.$inferSelect)[]> {
    return this.executor
      .select()
      .from(schema.generationModelRate)
      .where(eq(schema.generationModelRate.modelId, modelId))
      .orderBy(asc(schema.generationModelRate.id));
  }

  async createGenerationJobCostEstimate(
    input: CreateGenerationJobCostEstimateInput,
  ): Promise<typeof schema.generationJobCostEstimate.$inferSelect> {
    const [estimate] = await this.executor
      .insert(schema.generationJobCostEstimate)
      .values({
        id: randomUUID(),
        jobId: input.jobId,
        estimatedCostUsdMicros: input.estimatedCostUsdMicros,
        currencyCode: input.currencyCode,
        pricingSnapshot: input.pricingSnapshot,
      })
      .returning();

    if (!estimate) {
      throw new Error(
        `Generation job cost estimate was not created for job ${input.jobId}`,
      );
    }

    return estimate;
  }
}

export const modelRatesRepository = new ModelRatesRepository();

import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type { CreateGenerationJobCostInput } from "./model_rates.types.ts";

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

  async getCurrentGenerationPricingPolicy(): Promise<
    typeof schema.generationPricingPolicy.$inferSelect | null
  > {
    const [policy] = await this.executor
      .select()
      .from(schema.generationPricingPolicy)
      .orderBy(
        desc(schema.generationPricingPolicy.createdAt),
        desc(schema.generationPricingPolicy.id),
      )
      .limit(1);

    return policy ?? null;
  }

  async createGenerationJobCostWithEstimate(
    input: CreateGenerationJobCostInput,
  ): Promise<typeof schema.generationJobCost.$inferSelect> {
    const [cost] = await this.executor
      .insert(schema.generationJobCost)
      .values({
        id: randomUUID(),
        jobId: input.jobId,
        estimatedCostUsdMicros: input.estimatedCostUsdMicros,
        currencyCode: input.currencyCode,
        estimatedCostSnapshot: input.estimatedCostSnapshot,
      })
      .returning();

    if (!cost) {
      throw new Error(
        `Generation job cost was not created for job ${input.jobId}`,
      );
    }

    return cost;
  }
}

export const modelRatesRepository = new ModelRatesRepository();

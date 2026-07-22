import { asc, desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import { parseGenerationModelRateConditions } from "../model/model.utils.ts";
import type {
  CreateGenerationJobCostInput,
  GenerationJobFinalCostBasis,
  GenerationJobProviderCostSnapshot,
  PublishedModelPricingRecord,
} from "./model_rates.types.ts";

export class ModelRatesRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listPublishedModelRates(): Promise<PublishedModelPricingRecord[]> {
    const models = await this.executor.query.generationModel.findMany({
      where: (model, { eq }) => eq(model.status, "published"),
      columns: {
        id: true,
        providerId: true,
        displayName: true,
        type: true,
      },
      with: {
        provider: {
          columns: { name: true },
        },
        specs: {
          where: (spec, { eq }) => eq(spec.status, "published"),
          columns: {
            id: true,
            version: true,
          },
          with: {
            rates: {
              columns: {
                id: true,
                component: true,
                quantityUnit: true,
                unitQuantity: true,
                unitPriceUsdMicros: true,
                conditions: true,
              },
              orderBy: (rate, { asc }) => [asc(rate.id)],
            },
          },
          orderBy: (spec, { desc }) => [desc(spec.version)],
          limit: 1,
        },
      },
      orderBy: (model, { asc }) => [asc(model.displayName)],
    });

    return models.flatMap((model) => {
      const spec = model.specs[0];

      if (!spec) {
        return [];
      }

      return [
        {
          id: model.id,
          providerId: model.providerId,
          providerName: model.provider.name,
          displayName: model.displayName,
          modelType: model.type,
          modelSpecId: spec.id,
          modelSpecVersion: spec.version,
          rates: spec.rates.map((rate) => ({
            ...rate,
            conditions: parseGenerationModelRateConditions(rate.conditions),
          })),
        },
      ];
    });
  }

  async listModelRates(
    modelSpecId: string,
  ): Promise<(typeof schema.generationModelRate.$inferSelect)[]> {
    const rows = await this.executor
      .select()
      .from(schema.generationModelRate)
      .where(eq(schema.generationModelRate.modelSpecId, modelSpecId))
      .orderBy(asc(schema.generationModelRate.id));

    return rows.map((row) => ({
      ...row,
      conditions: parseGenerationModelRateConditions(row.conditions),
    }));
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

  async getGenerationJobCostByJobId(
    jobId: string,
  ): Promise<typeof schema.generationJobCost.$inferSelect | null> {
    const [cost] = await this.executor
      .select()
      .from(schema.generationJobCost)
      .where(eq(schema.generationJobCost.jobId, jobId))
      .limit(1);

    return cost ?? null;
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

  async finalizeGenerationJobCost(input: {
    jobId: string;
    finalCostUsdMicros: number;
    finalCostBasis: GenerationJobFinalCostBasis;
  }): Promise<typeof schema.generationJobCost.$inferSelect> {
    const [cost] = await this.executor
      .update(schema.generationJobCost)
      .set({
        finalCostUsdMicros: input.finalCostUsdMicros,
        finalCostBasis: input.finalCostBasis,
        finalizedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobCost.jobId, input.jobId))
      .returning();

    if (!cost) {
      throw new Error(
        `Generation job cost was not finalized for job ${input.jobId}`,
      );
    }

    return cost;
  }

  async setGenerationJobProviderCost(input: {
    jobId: string;
    providerCostUsdMicros: number;
    providerCostSnapshot: GenerationJobProviderCostSnapshot;
  }): Promise<typeof schema.generationJobCost.$inferSelect> {
    const [cost] = await this.executor
      .update(schema.generationJobCost)
      .set({
        providerCostUsdMicros: input.providerCostUsdMicros,
        providerCostSnapshot: input.providerCostSnapshot,
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJobCost.jobId, input.jobId))
      .returning();

    if (!cost) {
      throw new Error(
        `Generation job provider cost was not set for job ${input.jobId}`,
      );
    }

    return cost;
  }
}

export const modelRatesRepository = new ModelRatesRepository();

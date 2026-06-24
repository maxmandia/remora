import { asc, eq } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";

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
}

export const modelRatesRepository = new ModelRatesRepository();

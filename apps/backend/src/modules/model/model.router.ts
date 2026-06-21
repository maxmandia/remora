import { and, eq } from "drizzle-orm";

import { db, schema } from "../../db/client.ts";
import { router } from "../../trpc/init.ts";
import { protectedProcedure } from "../../trpc/procedures.ts";

import type {
  GenerationProviderId,
  PublishedGenerationModelSummary,
} from "./model.types.ts";
import { parsePersistedGenerationModelSpec } from "./model.utils.ts";

export const modelRouter = router({
  listPublished: protectedProcedure.query(async () => {
    const rows = await db
      .select({
        id: schema.generationModel.id,
        providerId: schema.generationModel.providerId,
        providerName: schema.generationProvider.name,
        displayName: schema.generationModel.displayName,
        type: schema.generationModel.type,
        latestSpecId: schema.generationModelSpec.id,
        latestSpecVersion: schema.generationModelSpec.version,
        spec: schema.generationModelSpec.spec,
      })
      .from(schema.generationModel)
      .innerJoin(
        schema.generationProvider,
        eq(schema.generationProvider.id, schema.generationModel.providerId),
      )
      .innerJoin(
        schema.generationModelSpec,
        eq(schema.generationModelSpec.modelId, schema.generationModel.id),
      )
      .where(
        and(
          eq(schema.generationModel.status, "published"),
          eq(schema.generationModelSpec.status, "published"),
        ),
      );

    const latestModels = new Map<string, PublishedGenerationModelSummary>();

    for (const row of rows) {
      const existing = latestModels.get(row.id);

      if (existing && existing.latestSpecVersion >= row.latestSpecVersion) {
        continue;
      }

      latestModels.set(row.id, {
        id: row.id,
        providerId: row.providerId as GenerationProviderId,
        providerName: row.providerName,
        displayName: row.displayName,
        type: row.type,
        latestSpecId: row.latestSpecId,
        latestSpecVersion: row.latestSpecVersion,
        spec: parsePersistedGenerationModelSpec(row.spec),
      });
    }

    return Array.from(latestModels.values()).sort((left, right) =>
      left.displayName.localeCompare(right.displayName),
    );
  }),
});

import { db, type DatabaseExecutor } from "../../db/client.ts";
import type {
  GenerationProviderId,
  GenerationModelRateDefinition,
  GenerationModelRateLimitDefinition,
  ModelCatalogState,
  PublishedGenerationModelSummary,
} from "./model.types.ts";
import {
  parseGenerationModelRateConditions,
  parseGenerationModelRateLimitConditions,
  parsePersistedGenerationModelSpec,
} from "./model.utils.ts";

export class ModelRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async getModelSpec(modelSpecId: string) {
    return (
      (await this.executor.query.generationModelSpec.findFirst({
        where: (spec, { eq }) => eq(spec.id, modelSpecId),
      })) ?? null
    );
  }

  async listPublished(): Promise<PublishedGenerationModelSummary[]> {
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
            spec: true,
          },
          orderBy: (spec, { desc }) => [desc(spec.version)],
          limit: 1,
        },
      },
      orderBy: (model, { asc }) => [asc(model.displayName)],
    });

    return models.flatMap((model) => {
      const latestSpec = model.specs[0];

      if (!latestSpec) {
        return [];
      }

      return [
        {
          id: model.id,
          providerId: model.providerId as GenerationProviderId,
          providerName: model.provider.name,
          displayName: model.displayName,
          type: model.type,
          latestSpecId: latestSpec.id,
          latestSpecVersion: latestSpec.version,
          spec: parsePersistedGenerationModelSpec(latestSpec.spec),
        } satisfies PublishedGenerationModelSummary,
      ];
    });
  }

  async loadCatalogState({
    modelId,
    providerId,
  }: {
    modelId: string;
    providerId: string;
  }): Promise<ModelCatalogState> {
    const [provider, model] = await Promise.all([
      this.executor.query.generationProvider.findFirst({
        where: (candidate, { eq }) => eq(candidate.id, providerId),
        columns: { id: true },
      }),
      this.executor.query.generationModel.findFirst({
        where: (candidate, { eq }) => eq(candidate.id, modelId),
        columns: {
          id: true,
          providerId: true,
          displayName: true,
          type: true,
          status: true,
        },
        with: {
          specs: {
            columns: {
              id: true,
              modelId: true,
              version: true,
              schemaVersion: true,
              status: true,
              adapter: true,
              rateLimitMode: true,
              spec: true,
              publishedAt: true,
            },
            with: {
              rates: true,
              rateLimits: {
                with: { bucket: true },
              },
            },
            orderBy: (spec, { asc }) => [asc(spec.version)],
          },
        },
      }),
    ]);

    return {
      providerExists: Boolean(provider),
      model: model
        ? {
            id: model.id,
            providerId: model.providerId,
            displayName: model.displayName,
            type: model.type,
            status: model.status,
          }
        : null,
      specs:
        model?.specs.map((spec) => ({
          id: spec.id,
          modelId: spec.modelId,
          version: spec.version,
          schemaVersion: spec.schemaVersion,
          status: spec.status,
          adapter: spec.adapter,
          rateLimitMode: spec.rateLimitMode,
          spec: parsePersistedGenerationModelSpec(spec.spec),
          publishedAt: spec.publishedAt,
          rates: spec.rates
            .map(
              (rate): GenerationModelRateDefinition => ({
                id: rate.id,
                component: rate.component,
                quantitySource: rate.quantitySource,
                finalQuantitySource: rate.finalQuantitySource,
                quantityUnit: rate.quantityUnit,
                unitQuantity: rate.unitQuantity,
                unitPriceUsdMicros: rate.unitPriceUsdMicros,
                conditions: parseGenerationModelRateConditions(rate.conditions),
              }),
            )
            .sort((left, right) => left.id.localeCompare(right.id)),
          rateLimits: spec.rateLimits
            .map(
              (rateLimit): GenerationModelRateLimitDefinition => ({
                id: rateLimit.id,
                conditions: parseGenerationModelRateLimitConditions(
                  rateLimit.conditions,
                ),
                bucket: {
                  id: rateLimit.bucket.id,
                  kind: rateLimit.bucket.kind,
                  maxValue: rateLimit.bucket.maxValue,
                  windowSeconds: rateLimit.bucket.windowSeconds,
                  windowAlignment: rateLimit.bucket.windowAlignment,
                },
              }),
            )
            .sort((left, right) => left.id.localeCompare(right.id)),
        })) ?? [],
    };
  }
}

export const modelRepository = new ModelRepository();

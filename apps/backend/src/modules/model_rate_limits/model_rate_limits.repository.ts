import { and, eq, isNull } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import type { GenerationModelRateLimitRecord } from "./model_rate_limits.types.ts";
import {
  createGenerationRateLimitConcurrencyLeaseId,
  createGenerationRateLimitWindowEntryId,
} from "./model_rate_limits.utils.ts";

export class ModelRateLimitsRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listModelRateLimits(
    modelId: string,
  ): Promise<GenerationModelRateLimitRecord[]> {
    const rows = await this.executor.query.generationModelRateLimit.findMany({
      where: (rateLimit, { eq }) => eq(rateLimit.modelId, modelId),
      with: {
        bucket: true,
      },
      orderBy: (rateLimit, { asc }) => [asc(rateLimit.id)],
    });

    return rows.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      bucketId: row.bucketId,
      conditions: row.conditions,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bucket: row.bucket,
    }));
  }

  async upsertRateLimitWindowEntries({
    bucketIds,
    jobId,
    occurredAt,
  }: {
    bucketIds: string[];
    jobId: string;
    occurredAt: Date;
  }): Promise<void> {
    if (bucketIds.length === 0) {
      return;
    }

    await this.executor
      .insert(schema.generationRateLimitWindowEntry)
      .values(
        bucketIds.map((bucketId) => ({
          id: createGenerationRateLimitWindowEntryId({ bucketId, jobId }),
          bucketId,
          jobId,
          occurredAt,
        })),
      )
      .onConflictDoUpdate({
        target: schema.generationRateLimitWindowEntry.id,
        set: {
          occurredAt,
        },
      });
  }

  async upsertRateLimitConcurrencyLeases({
    bucketIds,
    jobId,
    acquiredAt,
    expiresAt,
  }: {
    bucketIds: string[];
    jobId: string;
    acquiredAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    if (bucketIds.length === 0) {
      return;
    }

    await this.executor
      .insert(schema.generationRateLimitConcurrencyLease)
      .values(
        bucketIds.map((bucketId) => ({
          id: createGenerationRateLimitConcurrencyLeaseId({ bucketId, jobId }),
          bucketId,
          jobId,
          acquiredAt,
          expiresAt,
          releasedAt: null,
        })),
      )
      .onConflictDoUpdate({
        target: schema.generationRateLimitConcurrencyLease.id,
        set: {
          acquiredAt,
          expiresAt,
          releasedAt: null,
          updatedAt: acquiredAt,
        },
      });
  }

  async releaseJobConcurrencyLeases({
    jobId,
    releasedAt,
  }: {
    jobId: string;
    releasedAt: Date;
  }): Promise<void> {
    await this.executor
      .update(schema.generationRateLimitConcurrencyLease)
      .set({
        releasedAt,
        updatedAt: releasedAt,
      })
      .where(
        and(
          eq(schema.generationRateLimitConcurrencyLease.jobId, jobId),
          isNull(schema.generationRateLimitConcurrencyLease.releasedAt),
        ),
      );
  }
}

export const modelRateLimitsRepository = new ModelRateLimitsRepository();

import { and, asc, eq, gt, gte, inArray, isNull, lt, ne } from "drizzle-orm";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import { parseGenerationModelRateLimitConditions } from "../model/model.utils.ts";
import type {
  GenerationModelRateLimitRecord,
  GenerationRateLimitConcurrencyLeaseRecord,
  GenerationRateLimitWindowEntryRecord,
} from "./model_rate_limits.types.ts";
import {
  createGenerationRateLimitConcurrencyLeaseId,
  createGenerationRateLimitWindowEntryId,
} from "./model_rate_limits.utils.ts";

export class ModelRateLimitsRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listModelRateLimits(
    modelSpecId: string,
  ): Promise<GenerationModelRateLimitRecord[]> {
    const rows = await this.executor.query.generationModelRateLimit.findMany({
      where: (rateLimit, { eq }) => eq(rateLimit.modelSpecId, modelSpecId),
      with: {
        bucket: true,
      },
      orderBy: (rateLimit, { asc }) => [asc(rateLimit.id)],
    });

    return rows.map((row) => ({
      id: row.id,
      modelSpecId: row.modelSpecId,
      bucketId: row.bucketId,
      conditions: parseGenerationModelRateLimitConditions(row.conditions),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      bucket: row.bucket,
    }));
  }

  async lockRateLimitBuckets(bucketIds: string[]): Promise<void> {
    if (bucketIds.length === 0) {
      return;
    }

    await this.executor
      .select({ id: schema.generationRateLimitBucket.id })
      .from(schema.generationRateLimitBucket)
      .where(inArray(schema.generationRateLimitBucket.id, bucketIds))
      .orderBy(asc(schema.generationRateLimitBucket.id))
      .for("update");
  }

  async listRateLimitWindowEntries({
    bucketId,
    occurredAtStart,
    includeOccurredAtStart,
    occurredAtEnd,
    excludedEntryId,
  }: {
    bucketId: string;
    occurredAtStart: Date;
    includeOccurredAtStart: boolean;
    occurredAtEnd?: Date;
    excludedEntryId: string;
  }): Promise<GenerationRateLimitWindowEntryRecord[]> {
    const rangeStartPredicate = includeOccurredAtStart
      ? gte(schema.generationRateLimitWindowEntry.occurredAt, occurredAtStart)
      : gt(schema.generationRateLimitWindowEntry.occurredAt, occurredAtStart);

    const rows = await this.executor
      .select()
      .from(schema.generationRateLimitWindowEntry)
      .where(
        and(
          eq(schema.generationRateLimitWindowEntry.bucketId, bucketId),
          rangeStartPredicate,
          occurredAtEnd
            ? lt(
                schema.generationRateLimitWindowEntry.occurredAt,
                occurredAtEnd,
              )
            : undefined,
          ne(schema.generationRateLimitWindowEntry.id, excludedEntryId),
        ),
      )
      .orderBy(asc(schema.generationRateLimitWindowEntry.occurredAt));

    return rows;
  }

  async listActiveRateLimitConcurrencyLeases({
    bucketId,
    activeAt,
    excludedLeaseId,
  }: {
    bucketId: string;
    activeAt: Date;
    excludedLeaseId: string;
  }): Promise<GenerationRateLimitConcurrencyLeaseRecord[]> {
    const rows = await this.executor
      .select()
      .from(schema.generationRateLimitConcurrencyLease)
      .where(
        and(
          eq(schema.generationRateLimitConcurrencyLease.bucketId, bucketId),
          isNull(schema.generationRateLimitConcurrencyLease.releasedAt),
          gt(schema.generationRateLimitConcurrencyLease.expiresAt, activeAt),
          ne(schema.generationRateLimitConcurrencyLease.id, excludedLeaseId),
        ),
      )
      .orderBy(asc(schema.generationRateLimitConcurrencyLease.expiresAt));

    return rows;
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

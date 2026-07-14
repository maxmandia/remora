import { assertNever } from "@remora/utils";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import type {
  GenerationModelRateLimitRecord,
  GenerationRateLimitBucketRecord,
  GenerationRateLimitJobFacts,
  GenerationRateLimitReservationResult,
} from "./model_rate_limits.types.ts";
import { GenerationModelRateLimitConfigurationError } from "./model_rate_limits.types.ts";
import {
  createGenerationRateLimitConcurrencyLeaseId,
  createGenerationRateLimitWindowEntryId,
  matchesGenerationModelRateLimitConditions,
} from "./model_rate_limits.utils.ts";

const providerSubmissionLeaseMs = 24 * 60 * 60 * 1000;
const concurrencyRetryPollMs = 10 * 1000;

type DelayedRateLimitBucket = {
  bucketId: string;
  retryAt: Date;
};

type RateLimitBucketCapacityEvaluation = {
  bucketId: string;
  retryAt: Date | null;
};

export class ModelRateLimitsService {
  private readonly transactionManager: TransactionManager;

  constructor(options: { transactionManager: TransactionManager }) {
    this.transactionManager = options.transactionManager;
  }

  async reserveProviderSubmissionCapacity({
    jobId,
    modelSpecId,
    providerId,
    facts,
  }: {
    jobId: string;
    modelSpecId: string;
    providerId: string;
    facts: GenerationRateLimitJobFacts;
  }): Promise<GenerationRateLimitReservationResult> {
    const reservedAt = new Date();
    const expiresAt = new Date(
      reservedAt.getTime() + providerSubmissionLeaseMs,
    );

    return this.transactionManager.transaction(async (tx) => {
      const modelSpec = await tx.model.getModelSpec(modelSpecId);
      const mode = modelSpec?.rateLimitMode;

      if (mode === "unlimited") {
        return { status: "reserved", reservedAt };
      }

      if (mode !== "enforced") {
        throw new GenerationModelRateLimitConfigurationError(
          `Generation model spec ${modelSpecId} does not have an enforceable rate-limit configuration.`,
        );
      }

      const rateLimits =
        await tx.modelRateLimits.listModelRateLimits(modelSpecId);
      const matchingRateLimits = this.selectMatchingRateLimits({
        facts,
        providerId,
        rateLimits,
      });

      if (matchingRateLimits.length === 0) {
        throw new GenerationModelRateLimitConfigurationError(
          `Generation model spec ${modelSpecId} has no matching rate-limit rules.`,
        );
      }

      // NB: We prevent lock contention by standardizing bucket order so we don't create deadlocks between two
      // concurrent transactions, in addition to removing duplicates if any exist (we don't need to lock the same bucket twice).
      const matchingBucketIds = this.getBucketIdsToLock(matchingRateLimits);
      await tx.modelRateLimits.lockRateLimitBuckets(matchingBucketIds);

      const capacityReservation = await this.evaluateProviderSubmissionCapacity(
        {
          jobId,
          matchingRateLimits,
          reservedAt,
          transaction: tx,
        },
      );

      if (capacityReservation.delayedBuckets.length > 0) {
        const retryAt = this.getLatestRetryAt(
          capacityReservation.delayedBuckets,
        );

        return {
          status: "delayed",
          retryAt,
          delayMs: Math.max(1, retryAt.getTime() - reservedAt.getTime()),
          bucketIds: this.getSortedUniqueIds(
            capacityReservation.delayedBuckets.map((bucket) => bucket.bucketId),
          ),
        };
      }

      await tx.modelRateLimits.upsertRateLimitWindowEntries({
        jobId,
        occurredAt: reservedAt,
        bucketIds: capacityReservation.windowEntryBucketIds,
      });
      await tx.modelRateLimits.upsertRateLimitConcurrencyLeases({
        jobId,
        acquiredAt: reservedAt,
        expiresAt,
        bucketIds: capacityReservation.concurrencyLeaseBucketIds,
      });

      return {
        status: "reserved",
        reservedAt,
      };
    });
  }

  async releaseJobConcurrencyLeases({
    jobId,
  }: {
    jobId: string;
  }): Promise<void> {
    const releasedAt = new Date();

    await this.transactionManager.transaction((tx) =>
      tx.modelRateLimits.releaseJobConcurrencyLeases({
        jobId,
        releasedAt,
      }),
    );
  }

  private async evaluateProviderSubmissionCapacity({
    jobId,
    matchingRateLimits,
    reservedAt,
    transaction,
  }: {
    jobId: string;
    matchingRateLimits: GenerationModelRateLimitRecord[];
    reservedAt: Date;
    transaction: TransactionManager;
  }): Promise<{
    delayedBuckets: DelayedRateLimitBucket[];
    windowEntryBucketIds: string[];
    concurrencyLeaseBucketIds: string[];
  }> {
    const delayedBuckets: DelayedRateLimitBucket[] = [];
    const windowEntryBucketIds: string[] = [];
    const concurrencyLeaseBucketIds: string[] = [];

    for (const rateLimit of matchingRateLimits) {
      switch (rateLimit.bucket.kind) {
        case "request_window": {
          const evaluation = await this.evaluateRequestWindowCapacity({
            jobId,
            rateLimit,
            reservedAt,
            transaction,
          });

          windowEntryBucketIds.push(evaluation.bucketId);

          if (evaluation.retryAt) {
            delayedBuckets.push({
              bucketId: evaluation.bucketId,
              retryAt: evaluation.retryAt,
            });
          }

          break;
        }
        case "concurrent_task": {
          const evaluation = await this.evaluateConcurrencyCapacity({
            jobId,
            rateLimit,
            reservedAt,
            transaction,
          });

          concurrencyLeaseBucketIds.push(evaluation.bucketId);

          if (evaluation.retryAt) {
            delayedBuckets.push({
              bucketId: evaluation.bucketId,
              retryAt: evaluation.retryAt,
            });
          }

          break;
        }
        default:
          assertNever(rateLimit.bucket.kind);
      }
    }

    return {
      delayedBuckets,
      windowEntryBucketIds,
      concurrencyLeaseBucketIds,
    };
  }

  private async evaluateRequestWindowCapacity({
    jobId,
    rateLimit,
    reservedAt,
    transaction,
  }: {
    jobId: string;
    rateLimit: GenerationModelRateLimitRecord;
    reservedAt: Date;
    transaction: TransactionManager;
  }): Promise<RateLimitBucketCapacityEvaluation> {
    return {
      bucketId: rateLimit.bucket.id,
      retryAt: await this.getRequestWindowRetryAt({
        jobId,
        rateLimit,
        reservedAt,
        transaction,
      }),
    };
  }

  private async evaluateConcurrencyCapacity({
    jobId,
    rateLimit,
    reservedAt,
    transaction,
  }: {
    jobId: string;
    rateLimit: GenerationModelRateLimitRecord;
    reservedAt: Date;
    transaction: TransactionManager;
  }): Promise<RateLimitBucketCapacityEvaluation> {
    return {
      bucketId: rateLimit.bucket.id,
      retryAt: await this.getConcurrencyRetryAt({
        jobId,
        rateLimit,
        reservedAt,
        transaction,
      }),
    };
  }

  private selectMatchingRateLimits({
    facts,
    providerId,
    rateLimits,
  }: {
    facts: GenerationRateLimitJobFacts;
    providerId: string;
    rateLimits: GenerationModelRateLimitRecord[];
  }) {
    return rateLimits.filter(
      (rateLimit) =>
        rateLimit.bucket.providerId === providerId &&
        matchesGenerationModelRateLimitConditions({
          conditions: rateLimit.conditions,
          facts,
        }),
    );
  }

  private async getRequestWindowRetryAt({
    jobId,
    rateLimit,
    reservedAt,
    transaction,
  }: {
    jobId: string;
    rateLimit: GenerationModelRateLimitRecord;
    reservedAt: Date;
    transaction: TransactionManager;
  }): Promise<Date | null> {
    const bucket = rateLimit.bucket;
    const window = this.getRequestWindow(bucket, reservedAt);
    const entries =
      await transaction.modelRateLimits.listRateLimitWindowEntries({
        bucketId: bucket.id,
        occurredAtStart: window.startedAt,
        includeOccurredAtStart: window.includeStart,
        ...(window.endedAt ? { occurredAtEnd: window.endedAt } : {}),
        excludedEntryId: createGenerationRateLimitWindowEntryId({
          bucketId: bucket.id,
          jobId,
        }),
      });

    if (entries.length < bucket.maxValue) {
      return null;
    }

    if (bucket.windowAlignment === "calendar_day") {
      if (!window.endedAt) {
        throw new GenerationModelRateLimitConfigurationError(
          `Generation rate limit bucket ${bucket.id} has invalid calendar-day accounting state.`,
        );
      }

      return window.endedAt;
    }

    const blockingEntry = entries[entries.length - bucket.maxValue];

    if (!blockingEntry || !bucket.windowSeconds) {
      throw new GenerationModelRateLimitConfigurationError(
        `Generation rate limit bucket ${bucket.id} has invalid request-window accounting state.`,
      );
    }

    return new Date(
      blockingEntry.occurredAt.getTime() + bucket.windowSeconds * 1000,
    );
  }

  private async getConcurrencyRetryAt({
    jobId,
    rateLimit,
    reservedAt,
    transaction,
  }: {
    jobId: string;
    rateLimit: GenerationModelRateLimitRecord;
    reservedAt: Date;
    transaction: TransactionManager;
  }): Promise<Date | null> {
    const bucket = rateLimit.bucket;
    const leases =
      await transaction.modelRateLimits.listActiveRateLimitConcurrencyLeases({
        bucketId: bucket.id,
        activeAt: reservedAt,
        excludedLeaseId: createGenerationRateLimitConcurrencyLeaseId({
          bucketId: bucket.id,
          jobId,
        }),
      });

    if (leases.length < bucket.maxValue) {
      return null;
    }

    const pollRetryAt = new Date(reservedAt.getTime() + concurrencyRetryPollMs);
    const earliestExpiresAt = leases[0]?.expiresAt;

    if (!earliestExpiresAt || earliestExpiresAt > pollRetryAt) {
      return pollRetryAt;
    }

    return earliestExpiresAt;
  }

  private getRequestWindow(
    bucket: GenerationRateLimitBucketRecord,
    now: Date,
  ):
    | { startedAt: Date; endedAt: Date; includeStart: true }
    | { startedAt: Date; endedAt: undefined; includeStart: false } {
    if (!bucket.windowSeconds || !bucket.windowAlignment) {
      throw new GenerationModelRateLimitConfigurationError(
        `Generation rate limit bucket ${bucket.id} is missing request-window configuration.`,
      );
    }

    if (bucket.windowAlignment === "calendar_day") {
      const startedAt = new Date(now);

      startedAt.setUTCHours(0, 0, 0, 0);

      const endedAt = new Date(startedAt);

      endedAt.setUTCDate(endedAt.getUTCDate() + 1);

      return {
        startedAt,
        endedAt,
        includeStart: true,
      };
    }

    return {
      startedAt: new Date(now.getTime() - bucket.windowSeconds * 1000),
      endedAt: undefined,
      includeStart: false,
    };
  }

  private getLatestRetryAt(delayedBuckets: Array<{ retryAt: Date }>): Date {
    return delayedBuckets.reduce(
      (latest, current) =>
        current.retryAt > latest ? current.retryAt : latest,
      delayedBuckets[0]!.retryAt,
    );
  }

  private getBucketIdsToLock(
    rateLimits: GenerationModelRateLimitRecord[],
  ): string[] {
    return this.getSortedUniqueIds(
      rateLimits.map((rateLimit) => rateLimit.bucket.id),
    );
  }

  private getSortedUniqueIds(ids: string[]): string[] {
    return [...new Set(ids)].sort((left, right) => left.localeCompare(right));
  }
}

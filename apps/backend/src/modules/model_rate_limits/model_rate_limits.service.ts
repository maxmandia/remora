import type { TransactionManager } from "../../db/transaction-manager.ts";
import type {
  GenerationModelRateLimitRecord,
  GenerationRateLimitJobFacts,
} from "./model_rate_limits.types.ts";
import { matchesGenerationModelRateLimitConditions } from "./model_rate_limits.utils.ts";

const providerSubmissionLeaseMs = 24 * 60 * 60 * 1000;

export class ModelRateLimitsService {
  private readonly transactionManager: TransactionManager;

  constructor(options: { transactionManager: TransactionManager }) {
    this.transactionManager = options.transactionManager;
  }

  async recordProviderSubmissionStarted({
    jobId,
    modelId,
    providerId,
    facts,
  }: {
    jobId: string;
    modelId: string;
    providerId: string;
    facts: GenerationRateLimitJobFacts;
  }): Promise<void> {
    const acquiredAt = new Date();
    const expiresAt = new Date(acquiredAt.getTime() + providerSubmissionLeaseMs);

    await this.transactionManager.transaction(async (tx) => {
      const rateLimits = await tx.modelRateLimits.listModelRateLimits(modelId);
      const matchingRateLimits = this.selectMatchingRateLimits({
        facts,
        providerId,
        rateLimits,
      });

      await tx.modelRateLimits.upsertRateLimitWindowEntries({
        jobId,
        occurredAt: acquiredAt,
        bucketIds: matchingRateLimits
          .filter((rateLimit) => rateLimit.bucket.kind === "request_window")
          .map((rateLimit) => rateLimit.bucket.id),
      });
      await tx.modelRateLimits.upsertRateLimitConcurrencyLeases({
        jobId,
        acquiredAt,
        expiresAt,
        bucketIds: matchingRateLimits
          .filter((rateLimit) => rateLimit.bucket.kind === "concurrent_task")
          .map((rateLimit) => rateLimit.bucket.id),
      });
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
}

import { AuthRepository } from "../modules/auth/auth.repository.ts";
import { BillingRepository } from "../modules/billing/billing.repository.ts";
import { CreditsRepository } from "../modules/credits/credits.repository.ts";
import { GenerationAttachmentMediaRepository } from "../modules/generation-attachment-media/generation-attachment-media.repository.ts";
import { GenerationRepository } from "../modules/generation/generation.repository.ts";
import { ModelRatesRepository } from "../modules/model_rates/model_rates.repository.ts";
import { ProjectRepository } from "../modules/project/project.repository.ts";
import type { DatabaseExecutor } from "./client.ts";
import { db } from "./client.ts";

export class TransactionManager {
  readonly auth: AuthRepository;
  readonly billing: BillingRepository;
  readonly credits: CreditsRepository;
  readonly generation: GenerationRepository;
  readonly generationAttachmentMedia: GenerationAttachmentMediaRepository;
  readonly modelRates: ModelRatesRepository;
  readonly project: ProjectRepository;

  constructor(
    private readonly executor: DatabaseExecutor = db,
    private readonly isTransactionActive = false,
    private readonly afterCommitQueue: AfterCommitQueue | null = null,
  ) {
    this.auth = new AuthRepository(this.executor);
    this.billing = new BillingRepository(this.executor);
    this.credits = new CreditsRepository(this.executor);
    this.generationAttachmentMedia = new GenerationAttachmentMediaRepository(
      this.executor,
    );
    this.generation = new GenerationRepository(
      this.executor,
      this.generationAttachmentMedia,
    );
    this.modelRates = new ModelRatesRepository(this.executor);
    this.project = new ProjectRepository(this.executor);
  }

  async transaction<T>(
    callback: (transaction: TransactionManager) => Promise<T>,
  ): Promise<T> {
    if (this.isTransactionActive) {
      return callback(this);
    }

    const afterCommitQueue = new AfterCommitQueue();
    const result = await db.transaction(async (tx) =>
      callback(new TransactionManager(tx, true, afterCommitQueue)),
    );

    await afterCommitQueue.run();

    return result;
  }

  afterCommit(
    callback: AfterCommitCallback,
    options: { key?: string } = {},
  ): void {
    if (!this.isTransactionActive || !this.afterCommitQueue) {
      throw new Error(
        "afterCommit can only be registered inside a transaction",
      );
    }

    this.afterCommitQueue.add(callback, options);
  }
}

type AfterCommitCallback = () => Promise<void> | void;

class AfterCommitQueue {
  private readonly callbacks: AfterCommitCallback[] = [];
  private readonly keys = new Set<string>();

  add(callback: AfterCommitCallback, options: { key?: string } = {}) {
    if (options.key) {
      if (this.keys.has(options.key)) {
        return;
      }

      this.keys.add(options.key);
    }

    this.callbacks.push(callback);
  }

  async run() {
    for (const callback of this.callbacks) {
      try {
        await callback();
      } catch {
        // After-commit hooks are best-effort; the database commit already won.
      }
    }
  }
}

export const transactionManager = new TransactionManager();

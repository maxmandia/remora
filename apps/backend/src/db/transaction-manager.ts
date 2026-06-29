import { AuthRepository } from "../modules/auth/auth.repository.ts";
import { BillingRepository } from "../modules/billing/billing.repository.ts";
import { CreditAutoTopUpSettingsRepository } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.repository.ts";
import { CreditsRepository } from "../modules/credits/credits.repository.ts";
import { GenerationAttachmentMediaRepository } from "../modules/generation-attachment-media/generation-attachment-media.repository.ts";
import { GenerationRepository } from "../modules/generation/generation.repository.ts";
import { ModelRatesRepository } from "../modules/model_rates/model_rates.repository.ts";
import { ProjectRepository } from "../modules/project/project.repository.ts";
import type { DatabaseExecutor } from "./client.ts";
import { db } from "./client.ts";

import type { AuthService } from "../modules/auth/auth.service.ts";
import type { BillingService } from "../modules/billing/billing.service.ts";
import type { CreditAutoTopUpSettingsService } from "../modules/credit_auto_top_up_settings/credit_auto_top_up_settings.service.ts";
import type { CreditsService } from "../modules/credits/credits.service.ts";
import type { GenerationAttachmentMediaService } from "../modules/generation-attachment-media/generation-attachment-media.service.ts";
import type { GenerationService } from "../modules/generation/generation.service.ts";
import type { GenerationCostFinalizationService } from "../modules/model_rates/generation_cost_finalization.service.ts";
import type { ModelRatesService } from "../modules/model_rates/model_rates.service.ts";

export type TransactionServiceScope = {
  auth: AuthService;
  billing: BillingService;
  creditAutoTopUpSettings: CreditAutoTopUpSettingsService;
  credits: CreditsService;
  generation: GenerationService;
  generationAttachmentMedia: GenerationAttachmentMediaService;
  generationCostFinalization: GenerationCostFinalizationService;
  modelRates: ModelRatesService;
};

export type TransactionServiceScopeFactory = (
  transaction: TransactionManager,
) => TransactionServiceScope;

type TransactionManagerOptions = {
  executor?: DatabaseExecutor;
  isTransactionActive?: boolean;
  afterCommitQueue?: AfterCommitQueue | null;
  createServiceScope?: TransactionServiceScopeFactory | null;
};

export class TransactionManager {
  readonly auth: AuthRepository;
  readonly billing: BillingRepository;
  readonly creditAutoTopUpSettings: CreditAutoTopUpSettingsRepository;
  readonly credits: CreditsRepository;
  readonly generation: GenerationRepository;
  readonly generationAttachmentMedia: GenerationAttachmentMediaRepository;
  readonly modelRates: ModelRatesRepository;
  readonly project: ProjectRepository;
  private serviceScope: TransactionServiceScope | null = null;

  constructor({
    executor = db,
    isTransactionActive = false,
    afterCommitQueue = null,
    createServiceScope = null,
  }: TransactionManagerOptions = {}) {
    this.executor = executor;
    this.isTransactionActive = isTransactionActive;
    this.afterCommitQueue = afterCommitQueue;
    this.createServiceScope = createServiceScope;
    this.auth = new AuthRepository(this.executor);
    this.billing = new BillingRepository(this.executor);
    this.creditAutoTopUpSettings = new CreditAutoTopUpSettingsRepository(
      this.executor,
    );
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

  private readonly executor: DatabaseExecutor;
  private readonly isTransactionActive: boolean;
  private readonly afterCommitQueue: AfterCommitQueue | null;
  private readonly createServiceScope: TransactionServiceScopeFactory | null;

  get services(): TransactionServiceScope {
    if (!this.createServiceScope) {
      throw new Error("Transaction service scope was not configured");
    }

    this.serviceScope ??= this.createServiceScope(this);

    return this.serviceScope;
  }

  async transaction<T>(
    callback: (transaction: TransactionManager) => Promise<T>,
  ): Promise<T> {
    if (this.isTransactionActive) {
      return callback(this);
    }

    const afterCommitQueue = new AfterCommitQueue();
    const result = await db.transaction(async (tx) =>
      callback(
        new TransactionManager({
          executor: tx,
          isTransactionActive: true,
          afterCommitQueue,
          createServiceScope: this.createServiceScope,
        }),
      ),
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

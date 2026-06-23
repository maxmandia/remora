import { AuthRepository } from "../modules/auth/auth.repository.ts";
import { BillingRepository } from "../modules/billing/billing.repository.ts";
import { CreditsRepository } from "../modules/credits/credits.repository.ts";
import { GenerationAttachmentMediaRepository } from "../modules/generation-attachment-media/generation-attachment-media.repository.ts";
import { GenerationRepository } from "../modules/generation/generation.repository.ts";
import { ProjectRepository } from "../modules/project/project.repository.ts";
import { db } from "./client.ts";
import type { DatabaseExecutor } from "./client.ts";

export class TransactionManager {
  readonly auth: AuthRepository;
  readonly billing: BillingRepository;
  readonly credits: CreditsRepository;
  readonly generation: GenerationRepository;
  readonly generationAttachmentMedia: GenerationAttachmentMediaRepository;
  readonly project: ProjectRepository;

  constructor(
    private readonly executor: DatabaseExecutor = db,
    private readonly isTransactionActive = false,
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
    this.project = new ProjectRepository(this.executor);
  }

  async transaction<T>(
    callback: (transaction: TransactionManager) => Promise<T>,
  ): Promise<T> {
    if (this.isTransactionActive) {
      return callback(this);
    }

    return db.transaction(async (tx) =>
      callback(new TransactionManager(tx, true)),
    );
  }
}

export const transactionManager = new TransactionManager();

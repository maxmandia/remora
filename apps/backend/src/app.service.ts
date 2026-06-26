import { TransactionManager } from "./db/transaction-manager.ts";
import { authRepository } from "./modules/auth/auth.repository.ts";
import { AuthService } from "./modules/auth/auth.service.ts";
import { billingRepository } from "./modules/billing/billing.repository.ts";
import { BillingService } from "./modules/billing/billing.service.ts";
import { creditsRepository } from "./modules/credits/credits.repository.ts";
import { CreditsService } from "./modules/credits/credits.service.ts";
import { generationAttachmentMediaRepository } from "./modules/generation-attachment-media/generation-attachment-media.repository.ts";
import { GenerationAttachmentMediaService } from "./modules/generation-attachment-media/generation-attachment-media.service.ts";
import { FfprobeMediaMetadataProbe } from "./modules/generation-attachment-media/generation-media-probe.service.ts";
import { generationRepository } from "./modules/generation/generation.repository.ts";
import { GenerationService } from "./modules/generation/generation.service.ts";
import { GenerationCostFinalizationService } from "./modules/model_rates/generation_cost_finalization.service.ts";
import { modelRatesRepository } from "./modules/model_rates/model_rates.repository.ts";
import { ModelRatesService } from "./modules/model_rates/model_rates.service.ts";
import { realtimeRepository } from "./modules/realtime/realtime.repository.ts";
import { objectStorageService } from "./modules/storage/object-storage.service.ts";

import type {
  TransactionManager as TransactionManagerInstance,
  TransactionServiceScope,
} from "./db/transaction-manager.ts";

const mediaMetadataProbe = new FfprobeMediaMetadataProbe();

export function createTransactionServiceScope(
  tx: TransactionManagerInstance,
): TransactionServiceScope {
  const billing = new BillingService(tx.billing, {
    creditsRepository: tx.credits,
  });
  const credits = new CreditsService(tx.billing, {
    creditsRepository: tx.credits,
    realtimeRepository,
    transactionManager: tx,
  });
  const generationAttachmentMedia = new GenerationAttachmentMediaService(
    tx.generationAttachmentMedia,
    objectStorageService,
    mediaMetadataProbe,
  );
  const generationCostFinalization = new GenerationCostFinalizationService(
    tx.modelRates,
  );
  const modelRates = new ModelRatesService(tx.modelRates);
  const auth = new AuthService(billing, tx.auth);
  const generation = new GenerationService(tx.generation, {
    attachmentMediaService: generationAttachmentMedia,
    modelRatesService: modelRates,
    storage: objectStorageService,
    transactionManager: tx,
  });

  return {
    auth,
    billing,
    credits,
    generation,
    generationAttachmentMedia,
    generationCostFinalization,
    modelRates,
  };
}

export const transactionManager = new TransactionManager({
  createServiceScope: createTransactionServiceScope,
});

export const billingService = new BillingService(billingRepository, {
  creditsRepository,
});
export const creditsService = new CreditsService(billingRepository, {
  creditsRepository,
  realtimeRepository,
  transactionManager,
});
export const generationAttachmentMediaService =
  new GenerationAttachmentMediaService(
    generationAttachmentMediaRepository,
    objectStorageService,
    mediaMetadataProbe,
  );
export const generationCostFinalizationService =
  new GenerationCostFinalizationService(modelRatesRepository);
export const modelRatesService = new ModelRatesService(modelRatesRepository);
export const authService = new AuthService(billingService, authRepository);
export const generationService = new GenerationService(generationRepository, {
  attachmentMediaService: generationAttachmentMediaService,
  modelRatesService,
  storage: objectStorageService,
  transactionManager,
});

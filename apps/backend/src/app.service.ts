import { TransactionManager } from "./db/transaction-manager.ts";
import { analyticsService } from "./modules/analytics/analytics.service.ts";
import { authRepository } from "./modules/auth/auth.repository.ts";
import { AuthService } from "./modules/auth/auth.service.ts";
import { billingRepository } from "./modules/billing/billing.repository.ts";
import { BillingService } from "./modules/billing/billing.service.ts";
import { creditAutoTopUpSettingsRepository } from "./modules/credit_auto_top_up_settings/credit_auto_top_up_settings.repository.ts";
import { CreditAutoTopUpSettingsService } from "./modules/credit_auto_top_up_settings/credit_auto_top_up_settings.service.ts";
import { creditsRepository } from "./modules/credits/credits.repository.ts";
import { CreditsService } from "./modules/credits/credits.service.ts";
import { generationAttachmentMediaRepository } from "./modules/generation-attachment-media/generation-attachment-media.repository.ts";
import { GenerationAttachmentMediaService } from "./modules/generation-attachment-media/generation-attachment-media.service.ts";
import { FfprobeMediaMetadataProbe } from "./modules/generation-attachment-media/generation-media-probe.service.ts";
import { generationRepository } from "./modules/generation/generation.repository.ts";
import { GenerationService } from "./modules/generation/generation.service.ts";
import { bytePlusService } from "./modules/generation/providers/byteplus/byteplus.service.ts";
import { googleService } from "./modules/generation/providers/google/google.service.ts";
import { klingService } from "./modules/generation/providers/kling/kling.service.ts";
import { ModelRateLimitsService } from "./modules/model_rate_limits/model_rate_limits.service.ts";
import { GenerationCostFinalizationService } from "./modules/model_rates/generation_cost_finalization.service.ts";
import { modelRatesRepository } from "./modules/model_rates/model_rates.repository.ts";
import { ModelRatesService } from "./modules/model_rates/model_rates.service.ts";
import { notificationService } from "./modules/notification/notification.service.ts";
import { projectRepository } from "./modules/project/project.repository.ts";
import { ProjectService } from "./modules/project/project.service.ts";
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
    creditAutoTopUpSettingsRepository: tx.creditAutoTopUpSettings,
    creditsRepository: tx.credits,
  });
  const credits = new CreditsService(tx.billing, {
    analyticsService,
    creditsRepository: tx.credits,
    realtimeRepository,
    transactionManager: tx,
  });
  const creditAutoTopUpSettings = new CreditAutoTopUpSettingsService(
    tx.creditAutoTopUpSettings,
    {
      billingRepository: tx.billing,
      creditsRepository: tx.credits,
      grantCreditAutoTopUpPurchase: (input) =>
        credits.grantCreditAutoTopUpPurchase(input),
      transactionManager: tx,
    },
  );
  const generationAttachmentMedia = new GenerationAttachmentMediaService(
    tx.generationAttachmentMedia,
    objectStorageService,
    mediaMetadataProbe,
  );
  const generationCostFinalization = new GenerationCostFinalizationService({
    transactionManager: tx,
  });
  const modelRates = new ModelRatesService(tx.modelRates, {
    transactionManager: tx,
  });
  const modelRateLimits = new ModelRateLimitsService({
    transactionManager: tx,
  });
  const auth = new AuthService(billing, {
    analytics: analyticsService,
    notifications: notificationService,
    repository: tx.auth,
  });
  const generation = new GenerationService(tx.generation, {
    analyticsService,
    attachmentMediaService: generationAttachmentMedia,
    bytePlusService,
    googleService,
    klingService,
    modelRatesService: modelRates,
    storage: objectStorageService,
    transactionManager: tx,
  });

  return {
    auth,
    billing,
    creditAutoTopUpSettings,
    credits,
    generation,
    generationAttachmentMedia,
    generationCostFinalization,
    modelRateLimits,
    modelRates,
  };
}

export const transactionManager = new TransactionManager({
  createServiceScope: createTransactionServiceScope,
});

export const billingService = new BillingService(billingRepository, {
  creditAutoTopUpSettingsRepository,
  creditsRepository,
});
export const creditsService = new CreditsService(billingRepository, {
  analyticsService,
  creditsRepository,
  realtimeRepository,
  transactionManager,
});
export const creditAutoTopUpSettingsService =
  new CreditAutoTopUpSettingsService(creditAutoTopUpSettingsRepository, {
    billingRepository,
    creditsRepository,
    grantCreditAutoTopUpPurchase: (input) =>
      creditsService.grantCreditAutoTopUpPurchase(input),
    transactionManager,
  });
export const generationAttachmentMediaService =
  new GenerationAttachmentMediaService(
    generationAttachmentMediaRepository,
    objectStorageService,
    mediaMetadataProbe,
  );
export const generationCostFinalizationService =
  new GenerationCostFinalizationService({
    transactionManager,
  });
export const modelRateLimitsService = new ModelRateLimitsService({
  transactionManager,
});
export const modelRatesService = new ModelRatesService(modelRatesRepository, {
  transactionManager,
});
export const projectService = new ProjectService(
  projectRepository,
  analyticsService,
);
export const authService = new AuthService(billingService, {
  analytics: analyticsService,
  notifications: notificationService,
  repository: authRepository,
});
export const generationService = new GenerationService(generationRepository, {
  analyticsService,
  attachmentMediaService: generationAttachmentMediaService,
  bytePlusService,
  googleService,
  klingService,
  modelRatesService,
  storage: objectStorageService,
  transactionManager,
});

import { ApplicationFailure } from "@temporalio/common";
import { Context } from "@temporalio/activity";
import { Readable } from "node:stream";

import { ManualCreditPurchaseVerificationError } from "../modules/credits/credits.types.ts";
import { logGenerationLifecycleEvent } from "../modules/generation/generation.observability.ts";
import { GoogleProviderError } from "../modules/generation/providers/google/google.types.ts";
import { BflProviderError } from "../modules/generation/providers/bfl/bfl.types.ts";
import { toGoogleProviderFailureDetails } from "../modules/generation/providers/google/google.observability.ts";
import { toOpenAIProviderFailureDetails } from "../modules/generation/providers/openai/openai.observability.ts";
import { OpenAIProviderError } from "../modules/generation/providers/openai/openai.types.ts";
import { TripoProviderError } from "../modules/generation/providers/tripo/tripo.types.ts";
import { toErrorLogFields } from "../modules/observability/observability.service.ts";
import { logObservabilityEvent } from "../modules/observability/observability.service.ts";
import type {
  AccrueGenerationProviderCostActivityInput,
  ConfigureManualCreditPurchaseAutoReloadActivityInput,
  ConfigureManualCreditPurchaseAutoReloadActivityResult,
  CreateAndStoreImageActivityInput,
  CreateAndStoreImageActivityResult,
  CreateGenerationResultPreviewActivityInput,
  CreateGenerationResultPreviewActivityResult,
  CreateModel3dTaskActivityInput,
  CreateModel3dTaskActivityResult,
  CreateVideoTaskActivityInput,
  CreateVideoTaskActivityResult,
  DeliverCreditPurchaseAnalyticsActivityInput,
  DeliverGoogleAdsPurchaseConversionActivityInput,
  DeliverGoogleAdsPurchaseConversionActivityResult,
  FinalizeUnsuccessfulGenerationJobActivityInput,
  GenerateGenerationThreadNameActivityInput,
  GenerateGenerationThreadNameActivityResult,
  GrantManualCreditPurchaseActivityInput,
  GrantManualCreditPurchaseActivityResult,
  MarkGenerationJobActivityResult,
  MarkGenerationJobCreatingProviderTaskActivityInput,
  MarkGenerationJobFinalCostCalculationFailedActivityInput,
  MarkGenerationJobProviderTaskCreatedActivityInput,
  MarkGenerationJobSucceededActivityInput,
  MarkGenerationJobWaitingForProviderCallbackActivityInput,
  MarkGenerationJobWaitingForProviderResultActivityInput,
  PollVideoTaskActivityInput,
  PollVideoTaskActivityResult,
  PollModel3dTaskActivityInput,
  PollModel3dTaskActivityResult,
  PrepareGenerationAttachmentMediaActivityInput,
  PrepareGenerationAttachmentMediaActivityResult,
  ProcessCreditAutoTopUpActivityInput,
  ProcessCreditAutoTopUpActivityResult,
  PrepareGoogleAdsPurchaseConversionActivityInput,
  PrepareGoogleAdsPurchaseConversionActivityResult,
  PruneGoogleAdsAttributionsActivityResult,
  PublishGenerationJobFailedRealtimeEventActivityInput,
  PublishGenerationJobSucceededRealtimeEventActivityInput,
  PublishGenerationThreadNameUpdatedRealtimeEventActivityInput,
  ReserveProviderSubmissionCapacityActivityInput,
  ReserveProviderSubmissionCapacityActivityResult,
  RefreshGoogleAdsPurchaseConversionStatusActivityInput,
  RefreshGoogleAdsPurchaseConversionStatusActivityResult,
  SaveGenerationMediaActivityInput,
  SaveGenerationMediaActivityResult,
  SaveGenerationModel3dActivityInput,
  SaveGenerationModel3dActivityResult,
  SettleGenerationJobCostActivityInput,
  TimeOutGoogleAdsPurchaseConversionActivityInput,
  UpdateGenerationThreadNameActivityInput,
  UpdateGenerationThreadNameActivityResult,
  UpsertGenerationResultActivityInput,
  VerifyManualCreditCheckoutSessionActivityInput,
  VerifyManualCreditCheckoutSessionActivityResult,
} from "./types.ts";

export async function generateGenerationThreadNameActivity(
  input: GenerateGenerationThreadNameActivityInput,
): Promise<GenerateGenerationThreadNameActivityResult> {
  const { generationThreadService } =
    await import("../modules/generation-thread/generation-thread.service.ts");

  return {
    name: await generationThreadService.generateName(input),
  };
}

export async function updateGenerationThreadNameActivity(
  input: UpdateGenerationThreadNameActivityInput,
): Promise<UpdateGenerationThreadNameActivityResult> {
  const [
    { generationThreadRepository },
    { logGenerationThreadLifecycleEvent },
  ] = await Promise.all([
    import("../modules/generation-thread/generation-thread.repository.ts"),
    import("../modules/generation-thread/generation-thread.observability.ts"),
  ]);
  const updated = await generationThreadRepository.updateNameIfUnchanged(input);

  logGenerationThreadLifecycleEvent(
    updated
      ? "generation_thread.name_updated"
      : "generation_thread.name_update_skipped",
    {
      threadId: input.threadId,
      userId: input.userId,
    },
  );

  return { updated };
}

export async function publishGenerationThreadNameUpdatedRealtimeEventActivity(
  input: PublishGenerationThreadNameUpdatedRealtimeEventActivityInput,
): Promise<void> {
  const [
    { logGenerationThreadLifecycleEvent },
    { realtimeRepository },
    { createGenerationThreadNameUpdatedRealtimeInternalEvent },
  ] = await Promise.all([
    import("../modules/generation-thread/generation-thread.observability.ts"),
    import("../modules/realtime/realtime.repository.ts"),
    import("../modules/realtime/realtime.utils.ts"),
  ]);

  await realtimeRepository.publishInternalEvent(
    createGenerationThreadNameUpdatedRealtimeInternalEvent({
      threadId: input.threadId,
      userId: input.userId,
      occurredAt: new Date().toISOString(),
    }),
  );
  logGenerationThreadLifecycleEvent(
    "generation_thread.name_realtime_published",
    {
      threadId: input.threadId,
      userId: input.userId,
    },
  );
}

export async function verifyManualCreditCheckoutSessionActivity(
  input: VerifyManualCreditCheckoutSessionActivityInput,
): Promise<VerifyManualCreditCheckoutSessionActivityResult> {
  const { creditsService } = await import("../app.service.ts");

  try {
    return await creditsService.verifyManualCreditCheckoutSession({
      ...input,
      eventOccurredAt: new Date(input.eventOccurredAt),
    });
  } catch (error) {
    if (error instanceof ManualCreditPurchaseVerificationError) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        "MANUAL_CREDIT_PURCHASE_VERIFICATION_FAILED",
      );
    }

    throw error;
  }
}

export async function grantManualCreditPurchaseActivity(
  input: GrantManualCreditPurchaseActivityInput,
): Promise<GrantManualCreditPurchaseActivityResult> {
  const { creditsService } = await import("../app.service.ts");

  return creditsService.grantManualCreditPurchase(input);
}

export async function configureManualCreditPurchaseAutoReloadActivity(
  input: ConfigureManualCreditPurchaseAutoReloadActivityInput,
): Promise<ConfigureManualCreditPurchaseAutoReloadActivityResult> {
  const { creditAutoTopUpSettingsService } = await import("../app.service.ts");

  return creditAutoTopUpSettingsService.configureManualCreditPurchaseAutoReload(
    input,
  );
}

export async function processCreditAutoTopUpActivity(
  input: ProcessCreditAutoTopUpActivityInput,
): Promise<ProcessCreditAutoTopUpActivityResult> {
  const { creditAutoTopUpSettingsService } = await import("../app.service.ts");

  return creditAutoTopUpSettingsService.processCreditAutoTopUp(input);
}

export async function deliverCreditPurchaseAnalyticsActivity(
  input: DeliverCreditPurchaseAnalyticsActivityInput,
): Promise<void> {
  const { analyticsService } = await import("../app.service.ts");

  try {
    await analyticsService.trackCreditPurchaseCompletedAndWait(
      {
        ...input.event,
        occurredAt: new Date(input.event.occurredAt),
      },
      input.analyticsContext,
    );
  } catch (error) {
    const attempt = Context.current().info.attempt;
    logObservabilityEvent(
      "mixpanel.credit_purchase.delivery_failed",
      {
        attempt,
        ledgerEntryId: input.event.ledgerEntryId,
        userId: input.event.userId,
      },
      { level: attempt >= 10 ? "error" : "warn" },
    );
    throw error;
  }
}

export async function prepareGoogleAdsPurchaseConversionActivity(
  input: PrepareGoogleAdsPurchaseConversionActivityInput,
): Promise<PrepareGoogleAdsPurchaseConversionActivityResult> {
  const { googleAdsService } = await import("../app.service.ts");
  const conversion = await googleAdsService.preparePurchaseConversion({
    ...input,
    eventOccurredAt: new Date(input.eventOccurredAt),
  });

  return { status: conversion.status };
}

export async function deliverGoogleAdsPurchaseConversionActivity(
  input: DeliverGoogleAdsPurchaseConversionActivityInput,
): Promise<DeliverGoogleAdsPurchaseConversionActivityResult> {
  const { googleAdsService } = await import("../app.service.ts");

  try {
    return await googleAdsService.deliverPurchaseConversion(
      input.transactionId,
    );
  } catch (error) {
    if (Context.current().info.attempt >= 10) {
      await googleAdsService.failPurchaseConversionDelivery(
        input.transactionId,
        error,
      );
      return { status: "failed" };
    }

    throw error;
  }
}

export async function refreshGoogleAdsPurchaseConversionStatusActivity(
  input: RefreshGoogleAdsPurchaseConversionStatusActivityInput,
): Promise<RefreshGoogleAdsPurchaseConversionStatusActivityResult> {
  const { googleAdsService } = await import("../app.service.ts");

  return googleAdsService.refreshPurchaseConversionStatus(
    input.transactionId,
    input.googleRequestId,
  );
}

export async function timeOutGoogleAdsPurchaseConversionActivity(
  input: TimeOutGoogleAdsPurchaseConversionActivityInput,
): Promise<void> {
  const { googleAdsService } = await import("../app.service.ts");

  await googleAdsService.timeOutPurchaseConversion(input.transactionId);
}

export async function pruneGoogleAdsAttributionsActivity(): Promise<PruneGoogleAdsAttributionsActivityResult> {
  const { googleAdsService } = await import("../app.service.ts");

  return googleAdsService.pruneExpiredAttributions();
}

export async function createVideoTaskActivity(
  input: CreateVideoTaskActivityInput,
): Promise<CreateVideoTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  return generationService.createVideoTask(input);
}

export async function pollVideoTaskActivity(
  input: PollVideoTaskActivityInput,
): Promise<PollVideoTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  try {
    return await generationService.pollVideoTask(input);
  } catch (error) {
    if (error instanceof BflProviderError && !error.retryable) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        error.code ?? undefined,
        {
          statusCode: error.statusCode,
          providerMessage: error.providerMessage,
        },
      );
    }

    throw error;
  }
}

export async function createModel3dTaskActivity(
  input: CreateModel3dTaskActivityInput,
): Promise<CreateModel3dTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  try {
    return await generationService.createModel3dTask(input);
  } catch (error) {
    throwTripoActivityFailure(error);
  }
}

export async function pollModel3dTaskActivity(
  input: PollModel3dTaskActivityInput,
): Promise<PollModel3dTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  try {
    return await generationService.pollModel3dTask(input);
  } catch (error) {
    throwTripoActivityFailure(error);
  }
}

export async function createAndStoreImageActivity(
  input: CreateAndStoreImageActivityInput,
): Promise<CreateAndStoreImageActivityResult> {
  const [
    { generationService },
    {
      createGenerationResultAssetObjectKey,
      toStoredGenerationResultAssetReference,
    },
    { objectStorageService },
  ] = await Promise.all([
    import("../app.service.ts"),
    import("../modules/generation/generation.utils.ts"),
    import("../modules/storage/object-storage.service.ts"),
  ]);
  let generated: Awaited<ReturnType<typeof generationService.createImageTask>>;

  try {
    generated = await generationService.createImageTask(input);
  } catch (error) {
    if (error instanceof GoogleProviderError) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        error.code,
        toGoogleProviderFailureDetails(error),
      );
    }

    if (error instanceof OpenAIProviderError && !error.retryable) {
      throw ApplicationFailure.nonRetryable(
        error.message,
        error.code,
        toOpenAIProviderFailureDetails(error),
      );
    }

    throw error;
  }
  const callback = {
    kind: "result" as const,
    result: {
      provider: generated.provider,
      providerTaskId: generated.providerTaskId,
      providerModelId: generated.providerModelId,
      status: "succeeded" as const,
      videoUrl: null,
      draftCacheUrl: null,
      usage: generated.usage
        ? {
            completionTokens: null,
            totalTokens: generated.usage.totalTokens,
            inputTokens: generated.usage.inputTokens,
            inputTextTokens: generated.usage.inputTextTokens,
            inputImageTokens: generated.usage.inputImageTokens,
            outputTextTokens: generated.usage.outputTextTokens,
            outputImageTokens: generated.usage.outputImageTokens,
            thoughtTokens: generated.usage.thoughtTokens,
          }
        : null,
      createdAt: null,
      updatedAt: null,
      providerError: null,
    },
    rawPayload: generated.rawPayload,
    receivedAt: generated.receivedAt,
  };
  const objectKey = createGenerationResultAssetObjectKey({
    jobId: input.jobId,
    kind: "image",
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const storedObject = await objectStorageService.uploadObject({
        objectKey,
        body: Readable.from(generated.image.data),
        contentLength: generated.image.contentLength,
        contentType: generated.image.contentType,
        sourceUrl: null,
      });
      const storedAsset = toStoredGenerationResultAssetReference({
        kind: "image",
        sourceProviderUrl: null,
        storedObject,
      });

      logGenerationLifecycleEvent("generation.media.stored", {
        jobId: input.jobId,
        providerId: generated.provider,
        providerTaskId: generated.providerTaskId,
        providerModelId: generated.providerModelId,
        assetKind: storedAsset.kind,
        contentType: storedAsset.contentType,
        contentLength: storedAsset.contentLength,
        uploadAttempt: attempt,
      });

      return {
        callback,
        storedAsset,
        storageError: null,
      };
    } catch (error) {
      if (attempt < 3) {
        await new Promise((resolve) =>
          setTimeout(resolve, 250 * 2 ** (attempt - 1)),
        );
        continue;
      }

      logGenerationLifecycleEvent("generation.media_storage_failed", {
        jobId: input.jobId,
        providerId: generated.provider,
        providerTaskId: generated.providerTaskId,
        providerModelId: generated.providerModelId,
        uploadAttempt: attempt,
        ...toErrorLogFields(error),
      });
    }
  }

  return {
    callback,
    storedAsset: null,
    storageError: {
      source: "internal",
      code: "GENERATION_MEDIA_STORAGE_FAILED",
      message: "Generated media could not be copied into durable storage",
    },
  };
}

export async function reserveProviderSubmissionCapacityActivity(
  input: ReserveProviderSubmissionCapacityActivityInput,
): Promise<ReserveProviderSubmissionCapacityActivityResult> {
  const { modelRateLimitsService } = await import("../app.service.ts");

  return modelRateLimitsService.reserveProviderSubmissionCapacity(input);
}

export async function prepareGenerationAttachmentMediaActivity(
  input: PrepareGenerationAttachmentMediaActivityInput,
): Promise<PrepareGenerationAttachmentMediaActivityResult> {
  const { generationAttachmentMediaService } =
    await import("../app.service.ts");

  return generationAttachmentMediaService.prepareSignedAttachmentMediaForSubmission(
    input,
  );
}

export async function markGenerationJobCreatingProviderTaskActivity(
  input: MarkGenerationJobCreatingProviderTaskActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobCreatingProviderTask(input);
}

export async function markGenerationJobProviderTaskCreatedActivity(
  input: MarkGenerationJobProviderTaskCreatedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobProviderTaskCreated(input);
}

export async function markGenerationJobWaitingForProviderCallbackActivity(
  input: MarkGenerationJobWaitingForProviderCallbackActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobWaitingForProviderCallback(
    input,
  );
}

export async function markGenerationJobWaitingForProviderResultActivity(
  input: MarkGenerationJobWaitingForProviderResultActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobWaitingForProviderResult(input);
}

export async function upsertGenerationResultActivity(
  input: UpsertGenerationResultActivityInput,
) {
  const { transactionManager } = await import("../app.service.ts");

  const generationResult = await transactionManager.transaction((tx) =>
    tx.generation.upsertGenerationResult({
      jobId: input.jobId,
      result: input.callback.result,
      rawPayload: input.callback.rawPayload,
      receivedAt: new Date(input.callback.receivedAt),
      storedAssets: input.storedAssets,
      storedDraftCache: input.storedDraftCache,
      storedPreview: input.storedPreview,
    }),
  );

  logGenerationLifecycleEvent("generation.result.persisted", {
    jobId: input.jobId,
    providerId: input.callback.result.provider,
    providerTaskId: input.callback.result.providerTaskId,
    providerModelId: input.callback.result.providerModelId,
    status: input.callback.result.status,
    storedAssetCount: input.storedAssets?.length ?? 0,
    hasDraftCache: Boolean(input.storedDraftCache),
    hasPreview: Boolean(input.storedPreview),
  });

  return generationResult;
}

export async function settleGenerationJobCostActivity(
  input: SettleGenerationJobCostActivityInput,
): Promise<void> {
  const { modelRatesService } = await import("../app.service.ts");
  const startedAt = Date.now();

  try {
    await modelRatesService.settleGenerationJobCost(input);

    // Google provider cost prefers token usage. When any required token field is
    // missing we still accrue via a resolution fallback and mark incompleteUsage;
    // emit this so incomplete accounting is visible in lifecycle logs.
    if (
      input.callback.result.provider === "google" &&
      hasIncompleteGoogleProviderUsage(input.callback.result.usage)
    ) {
      logGenerationLifecycleEvent("generation.provider_cost_incomplete", {
        jobId: input.jobId,
        providerId: input.callback.result.provider,
        providerTaskId: input.callback.result.providerTaskId,
        providerModelId: input.callback.result.providerModelId,
      });
    }

    logGenerationLifecycleEvent("generation.cost.settled", {
      jobId: input.jobId,
      providerId: input.callback.result.provider,
      providerTaskId: input.callback.result.providerTaskId,
      providerModelId: input.callback.result.providerModelId,
      status: input.callback.result.status,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logGenerationLifecycleEvent("generation.cost_settlement_failed", {
      jobId: input.jobId,
      providerId: input.callback.result.provider,
      providerTaskId: input.callback.result.providerTaskId,
      providerModelId: input.callback.result.providerModelId,
      status: input.callback.result.status,
      durationMs: Date.now() - startedAt,
      ...toErrorLogFields(error),
    });

    throw error;
  }
}

// Records provider spend without settling customer credits. Used when the
// provider succeeded but Remora failed to persist the media, so the job fails
// and the customer's reservation is released uncharged.
export async function accrueGenerationProviderCostActivity(
  input: AccrueGenerationProviderCostActivityInput,
): Promise<void> {
  const { generationCostFinalizationService } =
    await import("../app.service.ts");

  const providerCost =
    await generationCostFinalizationService.accrueGenerationJobProviderCost(
      input,
    );

  // Google provider cost prefers token usage. When any required token field is
  // missing we still accrue via a resolution fallback and mark incompleteUsage;
  // emit this so incomplete accounting is visible in lifecycle logs.
  if (
    providerCost.providerCostSnapshot.provider === "google" &&
    providerCost.providerCostSnapshot.incompleteUsage
  ) {
    logGenerationLifecycleEvent("generation.provider_cost_incomplete", {
      jobId: input.jobId,
      providerId: input.callback.result.provider,
      providerTaskId: input.callback.result.providerTaskId,
      providerModelId: input.callback.result.providerModelId,
      outputResolution: providerCost.providerCostSnapshot.outputResolution,
      providerCostUsdMicros: providerCost.providerCostUsdMicros,
    });
  }
}

export async function createGenerationResultPreviewActivity(
  input: CreateGenerationResultPreviewActivityInput,
): Promise<CreateGenerationResultPreviewActivityResult> {
  const { GenerationPreviewError, generationPreviewService } =
    await import("../modules/generation/generation-preview.service.ts");
  const startedAt = Date.now();

  try {
    const preview =
      await generationPreviewService.createGenerationResultPreview(input);

    logGenerationLifecycleEvent("generation.preview.created", {
      jobId: input.jobId,
      contentType: preview.contentType,
      contentLength: preview.contentLength,
      durationMs: Date.now() - startedAt,
      frameTimeMs: preview.frameTimeMs,
    });

    return preview;
  } catch (error) {
    logGenerationLifecycleEvent("generation.preview_failed", {
      jobId: input.jobId,
      durationMs: Date.now() - startedAt,
      ...toErrorLogFields(error),
    });

    if (
      error instanceof GenerationPreviewError &&
      error.code === "FFMPEG_BINARY_MISSING"
    ) {
      throw ApplicationFailure.nonRetryable(error.message, error.code);
    }

    throw error;
  }
}

export async function saveGenerationMediaActivity(
  input: SaveGenerationMediaActivityInput,
): Promise<SaveGenerationMediaActivityResult> {
  if (!input.videoUrl) {
    throw new Error("Succeeded provider callback did not include a video URL");
  }

  const [
    {
      createGenerationDraftCacheObjectKey,
      createGenerationResultAssetObjectKey,
      toStoredGenerationDraftCacheReference,
      toStoredGenerationResultAssetReference,
    },
    { objectStorageService },
  ] = await Promise.all([
    import("../modules/generation/generation.utils.ts"),
    import("../modules/storage/object-storage.service.ts"),
  ]);

  const storedVideoObject = await objectStorageService.importRemoteObject({
    sourceUrl: input.videoUrl,
    objectKey: createGenerationResultAssetObjectKey({
      jobId: input.jobId,
      kind: "video",
    }),
  });
  const video = toStoredGenerationResultAssetReference({
    kind: "video",
    sourceProviderUrl: input.videoUrl,
    storedObject: storedVideoObject,
  });
  logGenerationLifecycleEvent("generation.media.stored", {
    jobId: input.jobId,
    assetKind: video.kind,
    contentType: video.contentType,
    contentLength: video.contentLength,
  });

  let storedDraftCache = null;
  if (input.draftCacheUrl) {
    const storedDraftCacheObject =
      await objectStorageService.importRemoteObject({
        sourceUrl: input.draftCacheUrl,
        objectKey: createGenerationDraftCacheObjectKey({ jobId: input.jobId }),
      });
    storedDraftCache = toStoredGenerationDraftCacheReference({
      sourceProviderUrl: input.draftCacheUrl,
      storedObject: storedDraftCacheObject,
    });
    logGenerationLifecycleEvent("generation.draft_cache.stored", {
      jobId: input.jobId,
      contentType: storedDraftCache.contentType,
      contentLength: storedDraftCache.contentLength,
    });
  }

  return {
    storedAssets: [video],
    storedDraftCache,
  };
}

export async function saveGenerationModel3dActivity(
  input: SaveGenerationModel3dActivityInput,
): Promise<SaveGenerationModel3dActivityResult> {
  if (!input.modelUrl) {
    throw new Error("Succeeded Tripo task did not include a model URL");
  }

  const [generationUtils, { objectStorageService }] = await Promise.all([
    import("../modules/generation/generation.utils.ts"),
    import("../modules/storage/object-storage.service.ts"),
  ]);
  const storedModelObject = await objectStorageService.importRemoteObject({
    sourceUrl: input.modelUrl,
    objectKey: generationUtils.createGenerationResultAssetObjectKey({
      jobId: input.jobId,
      kind: "model3d",
    }),
  });
  const model = generationUtils.toStoredGenerationResultAssetReference({
    kind: "model3d",
    sourceProviderUrl: input.modelUrl,
    storedObject: storedModelObject,
  });
  const storedAssets = [model];

  logGenerationLifecycleEvent("generation.media.stored", {
    jobId: input.jobId,
    assetKind: model.kind,
    contentType: model.contentType,
    contentLength: model.contentLength,
  });

  if (input.renderedImageUrl) {
    try {
      const storedPreviewObject = await objectStorageService.importRemoteObject(
        {
          sourceUrl: input.renderedImageUrl,
          objectKey: generationUtils.createGenerationResultAssetObjectKey({
            jobId: input.jobId,
            kind: "image",
          }),
        },
      );
      const preview = generationUtils.toStoredGenerationResultAssetReference({
        kind: "image",
        sourceProviderUrl: input.renderedImageUrl,
        storedObject: storedPreviewObject,
      });
      storedAssets.push(preview);
      logGenerationLifecycleEvent("generation.media.stored", {
        jobId: input.jobId,
        assetKind: preview.kind,
        contentType: preview.contentType,
        contentLength: preview.contentLength,
      });
    } catch (error) {
      logGenerationLifecycleEvent("generation.preview_failed", {
        jobId: input.jobId,
        ...toErrorLogFields(error),
      });
    }
  }

  return { storedAssets };
}

function throwTripoActivityFailure(error: unknown): never {
  if (error instanceof TripoProviderError) {
    throw ApplicationFailure.create({
      message: error.message,
      type: error.code ?? "TRIPO_PROVIDER_ERROR",
      nonRetryable: !error.retryable,
      details: [
        {
          statusCode: error.statusCode,
          providerMessage: error.providerMessage,
          requestId: error.requestId,
        },
      ],
      ...(error.retryAfterMs !== null
        ? { nextRetryDelay: error.retryAfterMs }
        : {}),
    });
  }

  throw error;
}

export async function markGenerationJobSucceededActivity(
  input: MarkGenerationJobSucceededActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationService } = await import("../app.service.ts");

  const job = await generationService.markGenerationJobSucceeded(input);

  logGenerationLifecycleEvent("generation.job.succeeded", {
    submissionId: job.submissionId,
    jobId: job.id,
    providerId: job.providerId,
    providerTaskId: job.providerTaskId,
    providerModelId: job.providerModelId,
    temporalWorkflowId: job.temporalWorkflowId,
    temporalRunId: job.temporalRunId,
    status: job.status,
  });

  return job;
}

export async function publishGenerationJobSucceededRealtimeEventActivity(
  input: PublishGenerationJobSucceededRealtimeEventActivityInput,
): Promise<void> {
  const [{ generationRepository }, { realtimeRepository }, realtimeUtils] =
    await Promise.all([
      import("../modules/generation/generation.repository.ts"),
      import("../modules/realtime/realtime.repository.ts"),
      import("../modules/realtime/realtime.utils.ts"),
    ]);
  const job = await generationRepository.getGenerationJobById(input.jobId);

  if (!job) {
    throw new Error(`Generation job was not found: ${input.jobId}`);
  }

  if (job.status !== "succeeded") {
    throw new Error(
      `Generation job was not succeeded for realtime publish: ${input.jobId}`,
    );
  }

  await realtimeRepository.publishInternalEvent(
    realtimeUtils.createGenerationJobSucceededRealtimeInternalEvent({
      jobId: job.id,
      threadId: job.threadId,
      userId: job.userId,
      occurredAt: new Date().toISOString(),
    }),
  );
}

export async function publishGenerationJobFailedRealtimeEventActivity(
  input: PublishGenerationJobFailedRealtimeEventActivityInput,
): Promise<void> {
  const [{ generationRepository }, { realtimeRepository }, realtimeUtils] =
    await Promise.all([
      import("../modules/generation/generation.repository.ts"),
      import("../modules/realtime/realtime.repository.ts"),
      import("../modules/realtime/realtime.utils.ts"),
    ]);
  const job = await generationRepository.getGenerationJobById(input.jobId);

  if (!job) {
    throw new Error(`Generation job was not found: ${input.jobId}`);
  }

  if (job.status !== "failed") {
    throw new Error(
      `Generation job was not failed for realtime publish: ${input.jobId}`,
    );
  }

  await realtimeRepository.publishInternalEvent(
    realtimeUtils.createGenerationJobFailedRealtimeInternalEvent({
      jobId: job.id,
      threadId: job.threadId,
      userId: job.userId,
      occurredAt: new Date().toISOString(),
    }),
  );
}

export async function finalizeUnsuccessfulGenerationJobActivity(
  input: FinalizeUnsuccessfulGenerationJobActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationService } = await import("../app.service.ts");

  return generationService.finalizeUnsuccessfulGenerationJob(input);
}

function hasIncompleteGoogleProviderUsage(
  usage: Extract<
    SettleGenerationJobCostActivityInput["callback"],
    { kind: "result" }
  >["result"]["usage"],
) {
  return [
    usage?.inputTokens,
    usage?.outputTextTokens,
    usage?.outputImageTokens,
    usage?.thoughtTokens,
  ].some(
    (value) =>
      typeof value !== "number" || !Number.isSafeInteger(value) || value < 0,
  );
}

export async function markGenerationJobFinalCostCalculationFailedActivity(
  input: MarkGenerationJobFinalCostCalculationFailedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationService } = await import("../app.service.ts");

  const job =
    await generationService.markGenerationJobFinalCostCalculationFailed(input);

  logGenerationLifecycleEvent("generation.job.terminal", {
    submissionId: job.submissionId,
    jobId: job.id,
    providerId: job.providerId,
    providerTaskId: job.providerTaskId,
    providerModelId: job.providerModelId,
    temporalWorkflowId: job.temporalWorkflowId,
    temporalRunId: job.temporalRunId,
    status: job.status,
    errorSource: job.terminalError?.source,
    errorCode: job.terminalError?.code,
    errorMessage: job.terminalError?.message,
  });

  return job;
}

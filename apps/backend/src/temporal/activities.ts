import { ApplicationFailure } from "@temporalio/common";

import { ManualCreditPurchaseVerificationError } from "../modules/credits/credits.types.ts";
import { logGenerationLifecycleEvent } from "../modules/generation/generation.observability.ts";
import {
  toErrorLogFields,
} from "../modules/observability/observability.service.ts";
import type {
  ConfigureManualCreditPurchaseAutoReloadActivityInput,
  ConfigureManualCreditPurchaseAutoReloadActivityResult,
  GrantManualCreditPurchaseActivityInput,
  GrantManualCreditPurchaseActivityResult,
  ProcessCreditAutoTopUpActivityInput,
  ProcessCreditAutoTopUpActivityResult,
  CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskActivityResult,
  CreateGenerationResultPreviewActivityInput,
  CreateGenerationResultPreviewActivityResult,
  FinalizeUnsuccessfulGenerationJobActivityInput,
  SaveGenerationMediaActivityInput,
  SaveGenerationMediaActivityResult,
  MarkGenerationJobActivityResult,
  MarkGenerationJobCreatingProviderTaskActivityInput,
  MarkGenerationJobFinalCostCalculationFailedActivityInput,
  MarkGenerationJobProviderTaskCreatedActivityInput,
  MarkGenerationJobSucceededActivityInput,
  MarkGenerationJobWaitingForProviderCallbackActivityInput,
  PublishGenerationJobSucceededRealtimeEventActivityInput,
  PrepareAttachmentMediaForProviderRequestActivityInput,
  PrepareAttachmentMediaForProviderRequestActivityResult,
  RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskActivityResult,
  SettleGenerationJobCostActivityInput,
  UpsertGenerationResultActivityInput,
  VerifyManualCreditCheckoutSessionActivityInput,
  VerifyManualCreditCheckoutSessionActivityResult,
} from "./types.ts";

export async function verifyManualCreditCheckoutSessionActivity(
  input: VerifyManualCreditCheckoutSessionActivityInput,
): Promise<VerifyManualCreditCheckoutSessionActivityResult> {
  const { creditsService } = await import("../app.service.ts");

  try {
    return await creditsService.verifyManualCreditCheckoutSession(input);
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

export async function createSeedanceVideoTaskActivity(
  input: CreateSeedanceVideoTaskActivityInput,
): Promise<CreateSeedanceVideoTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  return generationService.createSeedanceVideoTask(input);
}

export async function prepareAttachmentMediaForProviderRequestActivity(
  input: PrepareAttachmentMediaForProviderRequestActivityInput,
): Promise<PrepareAttachmentMediaForProviderRequestActivityResult> {
  const [{ generationAttachmentMediaService }, { toSeedanceAttachmentMedia }] =
    await Promise.all([
      import("../app.service.ts"),
      import("../modules/generation/providers/byteplus/seedance.payload.ts"),
    ]);

  const signedAttachmentMedia =
    await generationAttachmentMediaService.prepareSignedAttachmentMediaForSubmission(
      input,
    );

  return toSeedanceAttachmentMedia(signedAttachmentMedia);
}

export async function retrieveSeedanceVideoTaskActivity(
  input: RetrieveSeedanceVideoTaskActivityInput,
): Promise<RetrieveSeedanceVideoTaskActivityResult> {
  const { generationService } = await import("../app.service.ts");

  return generationService.retrieveSeedanceVideoTask(input);
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

export async function createGenerationResultPreviewActivity(
  input: CreateGenerationResultPreviewActivityInput,
): Promise<CreateGenerationResultPreviewActivityResult> {
  const { generationPreviewService } =
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
      createGenerationResultAssetObjectKey,
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

  return [video];
}

export async function markGenerationJobSucceededActivity(
  input: MarkGenerationJobSucceededActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  const job = await generationRepository.markGenerationJobSucceeded(input);

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

export async function finalizeUnsuccessfulGenerationJobActivity(
  input: FinalizeUnsuccessfulGenerationJobActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationService } = await import("../app.service.ts");

  return generationService.finalizeUnsuccessfulGenerationJob(input);
}

export async function markGenerationJobFinalCostCalculationFailedActivity(
  input: MarkGenerationJobFinalCostCalculationFailedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  const job =
    await generationRepository.markGenerationJobFinalCostCalculationFailed(
      input,
    );

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

import { ApplicationFailure } from "@temporalio/common";

import { ManualCreditPurchaseVerificationError } from "../modules/credits/credits.types.ts";
import type {
  GrantManualCreditPurchaseActivityInput,
  GrantManualCreditPurchaseActivityResult,
  CreateSeedanceVideoTaskActivityInput,
  CreateSeedanceVideoTaskActivityResult,
  CreateGenerationResultPreviewActivityInput,
  CreateGenerationResultPreviewActivityResult,
  SaveGenerationMediaActivityInput,
  SaveGenerationMediaActivityResult,
  MarkGenerationJobActivityResult,
  MarkGenerationJobCancelledActivityInput,
  MarkGenerationJobCreatingProviderTaskActivityInput,
  MarkGenerationJobExpiredActivityInput,
  MarkGenerationJobFailedActivityInput,
  MarkGenerationJobProviderTaskCreatedActivityInput,
  MarkGenerationJobSucceededActivityInput,
  MarkGenerationJobWaitingForProviderCallbackActivityInput,
  PublishGenerationJobSucceededRealtimeEventActivityInput,
  PrepareAttachmentMediaForProviderRequestActivityInput,
  PrepareAttachmentMediaForProviderRequestActivityResult,
  RetrieveSeedanceVideoTaskActivityInput,
  RetrieveSeedanceVideoTaskActivityResult,
  UpsertGenerationResultActivityInput,
  VerifyManualCreditCheckoutSessionActivityInput,
  VerifyManualCreditCheckoutSessionActivityResult,
} from "./types.ts";

export async function verifyManualCreditCheckoutSessionActivity(
  input: VerifyManualCreditCheckoutSessionActivityInput,
): Promise<VerifyManualCreditCheckoutSessionActivityResult> {
  const { creditsService } =
    await import("../modules/credits/credits.service.ts");

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
  const { creditsService } =
    await import("../modules/credits/credits.service.ts");

  return creditsService.grantManualCreditPurchase(input);
}

export async function createSeedanceVideoTaskActivity(
  input: CreateSeedanceVideoTaskActivityInput,
): Promise<CreateSeedanceVideoTaskActivityResult> {
  const { generationService } =
    await import("../modules/generation/generation.service.ts");

  return generationService.createSeedanceVideoTask(input);
}

export async function prepareAttachmentMediaForProviderRequestActivity(
  input: PrepareAttachmentMediaForProviderRequestActivityInput,
): Promise<PrepareAttachmentMediaForProviderRequestActivityResult> {
  const [{ generationAttachmentMediaService }, { toSeedanceAttachmentMedia }] =
    await Promise.all([
      import("../modules/generation-attachment-media/generation-attachment-media.service.ts"),
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
  const { generationService } =
    await import("../modules/generation/generation.service.ts");

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
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.upsertGenerationResult({
    jobId: input.jobId,
    result: input.callback.result,
    rawPayload: input.callback.rawPayload,
    receivedAt: new Date(input.callback.receivedAt),
    storedAssets: input.storedAssets,
    storedPreview: input.storedPreview,
  });
}

export async function createGenerationResultPreviewActivity(
  input: CreateGenerationResultPreviewActivityInput,
): Promise<CreateGenerationResultPreviewActivityResult> {
  const { generationPreviewService } =
    await import("../modules/generation/generation-preview.service.ts");

  return generationPreviewService.createGenerationResultPreview(input);
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

  return [video];
}

export async function markGenerationJobSucceededActivity(
  input: MarkGenerationJobSucceededActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobSucceeded(input);
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

export async function markGenerationJobCancelledActivity(
  input: MarkGenerationJobCancelledActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobCancelled(input);
}

export async function markGenerationJobExpiredActivity(
  input: MarkGenerationJobExpiredActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobExpired(input);
}

export async function markGenerationJobFailedActivity(
  input: MarkGenerationJobFailedActivityInput,
): Promise<MarkGenerationJobActivityResult> {
  const { generationRepository } =
    await import("../modules/generation/generation.repository.ts");

  return generationRepository.markGenerationJobFailed(input);
}

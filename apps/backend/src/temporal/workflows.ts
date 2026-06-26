import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  workflowInfo,
} from "@temporalio/workflow";

import {
  seedanceVideoGenerationProviderCallbackSignal,
  type CreateManualCreditPurchaseWorkflowInput,
  type CreateManualCreditPurchaseWorkflowResult,
  type CreateSeedanceVideoGenerationWorkflowInput,
  type CreateSeedanceVideoGenerationWorkflowResult,
  type SeedanceVideoGenerationProviderCallback,
  type StoredGenerationResultAssetReference,
  type StoredGenerationResultPreviewReference,
} from "./types.ts";

import type {
  SeedanceProviderStatus,
  SeedanceVideoGenerationProviderResultCallback,
} from "../modules/generation/generation.types.ts";
import type * as activities from "./activities.ts";

const {
  verifyManualCreditCheckoutSessionActivity,
  markGenerationJobCreatingProviderTaskActivity,
  markGenerationJobWaitingForProviderCallbackActivity,
  markGenerationJobFailedActivity,
  markGenerationJobSucceededActivity,
  markGenerationJobCancelledActivity,
  markGenerationJobExpiredActivity,
  markGenerationJobFinalCostCalculationFailedActivity,
  upsertGenerationResultActivity,
  settleGenerationJobCostActivity,
  publishGenerationJobSucceededRealtimeEventActivity,
  prepareAttachmentMediaForProviderRequestActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 5,
  },
});

const { grantManualCreditPurchaseActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 5,
  },
});

const { saveGenerationMediaActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: {
    maximumAttempts: 3,
  },
});

const { createGenerationResultPreviewActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "2 minutes",
  retry: {
    maximumAttempts: 3,
  },
});

const { createSeedanceVideoTaskActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 1,
  },
});

const providerCallbackSignal = defineSignal<
  [SeedanceVideoGenerationProviderCallback]
>(seedanceVideoGenerationProviderCallbackSignal);

export async function createManualCreditPurchaseWorkflow(
  input: CreateManualCreditPurchaseWorkflowInput,
): Promise<CreateManualCreditPurchaseWorkflowResult> {
  const verifiedPurchase = await verifyManualCreditCheckoutSessionActivity({
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripeEventId: input.stripeEventId,
  });

  return grantManualCreditPurchaseActivity(verifiedPurchase);
}

export async function createSeedanceVideoGenerationWorkflow(
  input: CreateSeedanceVideoGenerationWorkflowInput,
): Promise<CreateSeedanceVideoGenerationWorkflowResult> {
  const info = workflowInfo();
  let providerCallback: SeedanceVideoGenerationProviderCallback | undefined;

  setHandler(providerCallbackSignal, (callback) => {
    providerCallback = callback;
  });

  await markGenerationJobCreatingProviderTaskActivity({
    jobId: input.jobId,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  let providerTask;

  try {
    const attachmentMedia = input.hasAttachmentMedia
      ? await prepareAttachmentMediaForProviderRequestActivity({
          submissionId: input.submissionId,
        })
      : { images: [], videos: [], audios: [] };

    providerTask = await createSeedanceVideoTaskActivity({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      prompt: input.prompt,
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
      images: attachmentMedia.images,
      videos: attachmentMedia.videos,
      audios: attachmentMedia.audios,
      callbackUrl: input.callbackUrl,
    });
  } catch (error) {
    await markGenerationJobFailedActivity({
      jobId: input.jobId,
      terminalError: serializeProviderError(error),
    });

    throw error;
  }

  await markGenerationJobWaitingForProviderCallbackActivity({
    jobId: input.jobId,
    providerId: providerTask.provider,
    providerTaskId: providerTask.providerTaskId,
    providerModelId: providerTask.providerModelId,
  });

  const receivedFinalCallback = await condition(
    () =>
      Boolean(
        providerCallback &&
        (providerCallback.kind === "malformed" ||
          isTerminalProviderStatus(providerCallback.result.status)),
      ),
    "24 hours",
  );

  if (!receivedFinalCallback || !providerCallback) {
    await markGenerationJobExpiredActivity({
      jobId: input.jobId,
      terminalError: {
        source: "internal",
        code: "PROVIDER_CALLBACK_TIMEOUT",
        message: "Provider callback was not received within 24 hours",
      },
    });

    return {
      jobId: input.jobId,
      status: "expired",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.kind === "malformed") {
    await markGenerationJobFailedActivity({
      jobId: input.jobId,
      terminalError: providerCallback.terminalError,
    });

    return {
      jobId: input.jobId,
      status: "failed",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.result.status === "succeeded") {
    let storedAssets: StoredGenerationResultAssetReference[];
    let storedPreview: StoredGenerationResultPreviewReference | null = null;

    try {
      storedAssets = await saveGenerationMediaActivity({
        jobId: input.jobId,
        videoUrl: providerCallback.result.videoUrl,
      });
    } catch {
      await markGenerationJobFailedActivity({
        jobId: input.jobId,
        terminalError: {
          source: "internal",
          code: "GENERATION_MEDIA_STORAGE_FAILED",
          message: "Generated media could not be copied into durable storage",
        },
      });

      return {
        jobId: input.jobId,
        status: "failed",
        providerTaskId: providerTask.providerTaskId,
      };
    }

    const storedVideo = storedAssets.find((asset) => asset.kind === "video");

    if (storedVideo) {
      try {
        storedPreview = await createGenerationResultPreviewActivity({
          jobId: input.jobId,
          video: storedVideo,
        });
      } catch {
        storedPreview = null;
      }
    }

    await upsertGenerationResultActivity({
      jobId: input.jobId,
      callback: providerCallback,
      storedAssets,
      storedPreview,
    });

    try {
      await settleGenerationJobCostActivity({
        jobId: input.jobId,
        callback: providerCallback,
      });
    } catch (error) {
      await markGenerationJobFinalCostCalculationFailedActivity({
        jobId: input.jobId,
        terminalError: serializeFinalCostCalculationError(error),
      });

      throw error;
    }

    await markGenerationJobSucceededActivity({ jobId: input.jobId });

    try {
      await publishGenerationJobSucceededRealtimeEventActivity({
        jobId: input.jobId,
      });
    } catch {
      // Realtime events are best-effort. The database is already authoritative.
    }

    return {
      jobId: input.jobId,
      status: "succeeded",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  await upsertGenerationResultActivity({
    jobId: input.jobId,
    callback: providerCallback,
  });

  if (providerCallback.result.status === "cancelled") {
    await markGenerationJobCancelledActivity({
      jobId: input.jobId,
      terminalError: serializeProviderResultError(
        providerCallback.result.status,
        providerCallback,
      ),
    });

    return {
      jobId: input.jobId,
      status: "cancelled",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.result.status === "expired") {
    await markGenerationJobExpiredActivity({
      jobId: input.jobId,
      terminalError: serializeProviderResultError(
        providerCallback.result.status,
        providerCallback,
      ),
    });

    return {
      jobId: input.jobId,
      status: "expired",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  await markGenerationJobFailedActivity({
    jobId: input.jobId,
    terminalError: serializeProviderResultError(
      providerCallback.result.status,
      providerCallback,
    ),
  });

  return {
    jobId: input.jobId,
    status: "failed",
    providerTaskId: providerTask.providerTaskId,
  };
}

function isTerminalProviderStatus(status: SeedanceProviderStatus) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function serializeProviderResultError(
  status: SeedanceProviderStatus,
  callback: SeedanceVideoGenerationProviderResultCallback,
) {
  return {
    source: "provider" as const,
    code: callback.result.providerError?.code ?? status.toUpperCase(),
    message:
      callback.result.providerError?.message ?? `Provider task ${status}`,
  };
}

function serializeProviderError(error: unknown) {
  const providerError = findErrorDetails(error);

  return {
    source: "provider" as const,
    code: providerError.code,
    message: providerError.message,
  };
}

function serializeFinalCostCalculationError(error: unknown) {
  const details = findErrorDetails(error);

  return {
    source: "internal" as const,
    code: "FINAL_COST_CALCULATION_FAILED",
    message: details.message ?? "Final generation cost could not be calculated",
  };
}

function findErrorDetails(error: unknown): {
  code: string | null;
  message: string | null;
} {
  const visited = new Set<unknown>();
  let current = error;

  while (current && !visited.has(current)) {
    visited.add(current);

    const code =
      readStringProperty(current, "code") ??
      readStringProperty(current, "type");
    const providerMessage = readStringProperty(current, "providerMessage");
    const message = providerMessage ?? readStringProperty(current, "message");

    if (code || providerMessage) {
      return {
        code,
        message,
      };
    }

    current = readUnknownProperty(current, "cause");
  }

  if (error instanceof Error) {
    return {
      code: error.name,
      message: error.message,
    };
  }

  return {
    code: null,
    message: typeof error === "string" ? error : "Unknown provider task error",
  };
}

function readStringProperty(value: unknown, key: string) {
  const property = readUnknownProperty(value, key);

  return typeof property === "string" ? property : null;
}

function readUnknownProperty(value: unknown, key: string) {
  if (!value || typeof value !== "object" || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

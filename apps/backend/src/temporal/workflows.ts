import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from "@temporalio/workflow";

import {
  type CreateCreditAutoTopUpWorkflowInput,
  type CreateCreditAutoTopUpWorkflowResult,
  type CreateGenerationThreadNameWorkflowInput,
  type CreateGenerationThreadNameWorkflowResult,
  videoGenerationProviderCallbackSignal,
  type CreateManualCreditPurchaseWorkflowInput,
  type CreateManualCreditPurchaseWorkflowResult,
  type CreateVideoGenerationWorkflowInput,
  type CreateVideoGenerationWorkflowResult,
  type GenerationProviderCallback,
  type StoredGenerationResultAssetReference,
  type StoredGenerationResultPreviewReference,
} from "./types.ts";

import type { GenerationProviderTaskStatus } from "../modules/generation/generation.types.ts";
import type * as activities from "./activities.ts";

type GenerationProviderResultCallback = Extract<
  GenerationProviderCallback,
  { kind: "result" }
>;

const {
  verifyManualCreditCheckoutSessionActivity,
  markGenerationJobCreatingProviderTaskActivity,
  markGenerationJobWaitingForProviderCallbackActivity,
  markGenerationJobSucceededActivity,
  finalizeUnsuccessfulGenerationJobActivity,
  markGenerationJobFinalCostCalculationFailedActivity,
  upsertGenerationResultActivity,
  settleGenerationJobCostActivity,
  publishGenerationJobSucceededRealtimeEventActivity,
  prepareGenerationAttachmentMediaActivity,
  reserveProviderSubmissionCapacityActivity,
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

const {
  configureManualCreditPurchaseAutoReloadActivity,
  processCreditAutoTopUpActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
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

const { createVideoTaskActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    maximumAttempts: 1,
  },
});

const { generateGenerationThreadNameActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "15 seconds",
  retry: {
    maximumAttempts: 3,
  },
});

const {
  updateGenerationThreadNameActivity,
  publishGenerationThreadNameUpdatedRealtimeEventActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: {
    maximumAttempts: 5,
  },
});

const providerCallbackSignal = defineSignal<[GenerationProviderCallback]>(
  videoGenerationProviderCallbackSignal,
);

export async function createManualCreditPurchaseWorkflow(
  input: CreateManualCreditPurchaseWorkflowInput,
): Promise<CreateManualCreditPurchaseWorkflowResult> {
  const verifiedPurchase = await verifyManualCreditCheckoutSessionActivity({
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripeEventId: input.stripeEventId,
  });

  const grant = await grantManualCreditPurchaseActivity(verifiedPurchase);

  await configureManualCreditPurchaseAutoReloadActivity(verifiedPurchase);

  return grant;
}

export async function createCreditAutoTopUpWorkflow(
  input: CreateCreditAutoTopUpWorkflowInput,
): Promise<CreateCreditAutoTopUpWorkflowResult> {
  return processCreditAutoTopUpActivity(input);
}

export async function createGenerationThreadNameWorkflow(
  input: CreateGenerationThreadNameWorkflowInput,
): Promise<CreateGenerationThreadNameWorkflowResult> {
  const generated = await generateGenerationThreadNameActivity({
    threadId: input.threadId,
    prompt: input.prompt,
  });
  const { updated } = await updateGenerationThreadNameActivity({
    threadId: input.threadId,
    userId: input.userId,
    expectedName: input.provisionalName,
    name: generated.name,
  });

  if (updated) {
    await publishGenerationThreadNameUpdatedRealtimeEventActivity({
      threadId: input.threadId,
      userId: input.userId,
    });
  }

  return {
    threadId: input.threadId,
    updated,
  };
}

// TODO: I think some providers might charge us on failed generations, and right now, we assume this isn't the case
export async function createVideoGenerationWorkflow(
  input: CreateVideoGenerationWorkflowInput,
): Promise<CreateVideoGenerationWorkflowResult> {
  const info = workflowInfo();
  let providerCallback: GenerationProviderCallback | undefined;

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
      ? await prepareGenerationAttachmentMediaActivity({
          submissionId: input.submissionId,
        })
      : [];

    const providerTaskInput = {
      jobId: input.jobId,
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      submittedInput: input.submittedInput,
      attachmentMedia,
      callbackUrl: input.callbackUrl,
    };

    while (true) {
      const reservation = await reserveProviderSubmissionCapacityActivity({
        jobId: input.jobId,
        modelSpecId: input.modelSpecId,
        providerId: input.providerId,
        facts: {
          outputResolution: input.submittedInput.resolution,
        },
      });

      if (reservation.status === "reserved") {
        break;
      }

      await sleep(reservation.delayMs);
    }

    providerTask = await createVideoTaskActivity(providerTaskInput);
  } catch (error) {
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: input.jobId,
      status: "failed",
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
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: input.jobId,
      status: "expired",
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
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: input.jobId,
      status: "failed",
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
      await finalizeUnsuccessfulGenerationJobActivity({
        jobId: input.jobId,
        status: "failed",
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
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: input.jobId,
      status: "cancelled",
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
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: input.jobId,
      status: "expired",
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

  await finalizeUnsuccessfulGenerationJobActivity({
    jobId: input.jobId,
    status: "failed",
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

function isTerminalProviderStatus(status: GenerationProviderTaskStatus) {
  return (
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function serializeProviderResultError(
  status: GenerationProviderTaskStatus,
  callback: GenerationProviderResultCallback,
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

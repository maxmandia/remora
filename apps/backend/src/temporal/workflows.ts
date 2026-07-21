import {
  condition,
  defineSignal,
  proxyActivities,
  setHandler,
  sleep,
  workflowInfo,
} from "@temporalio/workflow";

import {
  generationProviderCallbackSignal,
  type CreateCreditAutoTopUpWorkflowInput,
  type CreateCreditAutoTopUpWorkflowResult,
  type CreateGenerationThreadNameWorkflowInput,
  type CreateGenerationThreadNameWorkflowResult,
  type CreateGenerationWorkflowInput,
  type CreateGenerationWorkflowResult,
  type CreateManualCreditPurchaseWorkflowInput,
  type CreateManualCreditPurchaseWorkflowResult,
  type GenerationProviderCallback,
  type StoredGenerationResultAssetReference,
  type StoredGenerationResultPreviewReference,
} from "./types.ts";

import {
  isTerminalProviderCallback,
  serializeFinalCostCalculationError,
  serializeProviderError,
  serializeProviderResultError,
  usesCallbackProviderExecution,
} from "./utils.ts";

import type { GenerationJobTerminalError } from "../modules/generation/generation.types.ts";
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
  publishGenerationJobFailedRealtimeEventActivity,
  markGenerationJobProviderTaskCreatedActivity,
  prepareGenerationAttachmentMediaActivity,
  reserveProviderSubmissionCapacityActivity,
  accrueGenerationProviderCostActivity,
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

const { createAndStoreImageActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
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
  generationProviderCallbackSignal,
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

type ProviderExecutionResult =
  | {
      mode: "inline";
      generated: Awaited<ReturnType<typeof createAndStoreImageActivity>>;
    }
  | {
      mode: "callback";
      providerTask: Awaited<ReturnType<typeof createVideoTaskActivity>>;
    };

// TODO: I think some providers might charge us on failed generations, and right now, we assume this isn't the case
export async function createGenerationWorkflow(
  input: CreateGenerationWorkflowInput,
): Promise<CreateGenerationWorkflowResult> {
  const info = workflowInfo();
  let providerCallback: GenerationProviderCallback | undefined;

  if (usesCallbackProviderExecution(input)) {
    setHandler(providerCallbackSignal, (callback) => {
      if (providerCallback && isTerminalProviderCallback(providerCallback)) {
        return;
      }

      providerCallback = callback;
    });
  }

  await markGenerationJobCreatingProviderTaskActivity({
    jobId: input.jobId,
    workflowId: info.workflowId,
    runId: info.runId,
  });

  let execution: ProviderExecutionResult;

  try {
    const attachmentMedia = input.hasAttachmentMedia
      ? await prepareGenerationAttachmentMediaActivity({
          submissionId: input.submissionId,
        })
      : [];

    await reserveProviderCapacity(input);

    if (!usesCallbackProviderExecution(input)) {
      execution = {
        mode: "inline",
        generated: await createAndStoreImageActivity({
          jobId: input.jobId,
          modelId: input.modelId,
          modelSpecId: input.modelSpecId,
          submittedInput: input.submittedInput,
          attachmentMedia,
        }),
      };
    } else {
      execution = {
        mode: "callback",
        providerTask: await createVideoTaskActivity({
          jobId: input.jobId,
          modelId: input.modelId,
          modelSpecId: input.modelSpecId,
          submittedInput: input.submittedInput,
          attachmentMedia,
          callbackUrl: input.providerExecution.callbackUrl,
        }),
      };
    }
  } catch (error) {
    await finalizeFailedGenerationJob({
      jobId: input.jobId,
      terminalError: serializeProviderError(error),
    });

    throw error;
  }

  if (execution.mode === "inline") {
    return finishInlineGeneration(input.jobId, execution.generated);
  }

  return finishCallbackGeneration(
    input.jobId,
    execution.providerTask,
    () => providerCallback,
  );
}

async function reserveProviderCapacity(input: CreateGenerationWorkflowInput) {
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
      return;
    }

    await sleep(reservation.delayMs);
  }
}

async function finishInlineGeneration(
  jobId: string,
  generated: Awaited<ReturnType<typeof createAndStoreImageActivity>>,
): Promise<CreateGenerationWorkflowResult> {
  const callback = generated.callback;

  await markGenerationJobProviderTaskCreatedActivity({
    jobId,
    providerId: callback.result.provider,
    providerTaskId: callback.result.providerTaskId,
    providerModelId: callback.result.providerModelId,
  });

  if (!generated.storedAsset) {
    return failGenerationMediaStorage({
      jobId,
      callback,
      providerTaskId: callback.result.providerTaskId,
      terminalError: generated.storageError,
    });
  }

  return completeSucceededGeneration({
    jobId,
    callback,
    providerTaskId: callback.result.providerTaskId,
    storedAssets: [generated.storedAsset],
  });
}

async function finishCallbackGeneration(
  jobId: string,
  providerTask: Awaited<ReturnType<typeof createVideoTaskActivity>>,
  getProviderCallback: () => GenerationProviderCallback | undefined,
): Promise<CreateGenerationWorkflowResult> {
  await markGenerationJobWaitingForProviderCallbackActivity({
    jobId,
    providerId: providerTask.provider,
    providerTaskId: providerTask.providerTaskId,
    providerModelId: providerTask.providerModelId,
  });

  const receivedFinalCallback = await condition(() => {
    const callback = getProviderCallback();

    return Boolean(callback && isTerminalProviderCallback(callback));
  }, "24 hours");
  const providerCallback = getProviderCallback();

  if (!receivedFinalCallback || !providerCallback) {
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId,
      status: "expired",
      terminalError: {
        source: "internal",
        code: "PROVIDER_CALLBACK_TIMEOUT",
        message: "Provider callback was not received within 24 hours",
      },
    });

    return {
      jobId,
      status: "expired",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.kind === "malformed") {
    await finalizeFailedGenerationJob({
      jobId,
      terminalError: providerCallback.terminalError,
    });

    return {
      jobId,
      status: "failed",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.result.status === "succeeded") {
    let storedAssets: StoredGenerationResultAssetReference[];
    let storedPreview: StoredGenerationResultPreviewReference | null = null;

    try {
      storedAssets = await saveGenerationMediaActivity({
        jobId,
        videoUrl: providerCallback.result.videoUrl,
      });
    } catch {
      return failGenerationMediaStorage({
        jobId,
        callback: providerCallback,
        providerTaskId: providerTask.providerTaskId,
        terminalError: null,
      });
    }

    const storedVideo = storedAssets.find((asset) => asset.kind === "video");

    if (storedVideo) {
      try {
        storedPreview = await createGenerationResultPreviewActivity({
          jobId,
          video: storedVideo,
        });
      } catch {
        storedPreview = null;
      }
    }

    return completeSucceededGeneration({
      jobId,
      callback: providerCallback,
      providerTaskId: providerTask.providerTaskId,
      storedAssets,
      storedPreview,
    });
  }

  await persistGenerationResult({
    jobId,
    callback: providerCallback,
  });

  if (providerCallback.result.status === "cancelled") {
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId,
      status: "cancelled",
      terminalError: serializeProviderResultError(
        providerCallback.result.status,
        providerCallback,
      ),
    });

    return {
      jobId,
      status: "cancelled",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  if (providerCallback.result.status === "expired") {
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId,
      status: "expired",
      terminalError: serializeProviderResultError(
        providerCallback.result.status,
        providerCallback,
      ),
    });

    return {
      jobId,
      status: "expired",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  await finalizeFailedGenerationJob({
    jobId,
    terminalError: serializeProviderResultError(
      providerCallback.result.status,
      providerCallback,
    ),
  });

  return {
    jobId,
    status: "failed",
    providerTaskId: providerTask.providerTaskId,
  };
}

async function completeSucceededGeneration({
  jobId,
  callback,
  providerTaskId,
  storedAssets,
  storedPreview,
}: {
  jobId: string;
  callback: GenerationProviderResultCallback;
  providerTaskId: string;
  storedAssets: StoredGenerationResultAssetReference[];
  storedPreview?: StoredGenerationResultPreviewReference | null;
}): Promise<CreateGenerationWorkflowResult> {
  await persistGenerationResult({
    jobId,
    callback,
    storedAssets,
    ...(storedPreview !== undefined ? { storedPreview } : {}),
  });

  try {
    await settleGenerationJobCostActivity({
      jobId,
      callback,
    });
  } catch (error) {
    await markGenerationJobFinalCostCalculationFailedActivity({
      jobId,
      terminalError: serializeFinalCostCalculationError(error),
    });

    throw error;
  }

  await markGenerationJobSucceededActivity({ jobId });

  try {
    await publishGenerationJobSucceededRealtimeEventActivity({ jobId });
  } catch {
    // Realtime events are best-effort. The database is already authoritative.
  }

  return {
    jobId,
    status: "succeeded",
    providerTaskId,
  };
}

async function failGenerationMediaStorage({
  jobId,
  callback,
  providerTaskId,
  terminalError,
}: {
  jobId: string;
  callback: GenerationProviderResultCallback;
  providerTaskId: string;
  terminalError: GenerationJobTerminalError | null;
}): Promise<CreateGenerationWorkflowResult> {
  const storageError = terminalError ?? {
    source: "internal" as const,
    code: "GENERATION_MEDIA_STORAGE_FAILED",
    message: "Generated media could not be copied into durable storage",
  };

  await persistGenerationResult({ jobId, callback });

  try {
    await accrueGenerationProviderCostActivity({ jobId, callback });
  } catch (error) {
    await finalizeFailedGenerationJob({
      jobId,
      terminalError: storageError,
    });

    throw error;
  }

  await finalizeFailedGenerationJob({
    jobId,
    terminalError: storageError,
  });

  return {
    jobId,
    status: "failed",
    providerTaskId,
  };
}

async function persistGenerationResult(
  input: Parameters<typeof upsertGenerationResultActivity>[0],
) {
  try {
    await upsertGenerationResultActivity(input);
  } catch (error) {
    await finalizeFailedGenerationJob({
      jobId: input.jobId,
      terminalError: {
        source: "internal",
        code: "GENERATION_RESULT_PERSISTENCE_FAILED",
        message: "Generation result metadata could not be persisted",
      },
    });

    throw error;
  }
}

async function finalizeFailedGenerationJob({
  jobId,
  terminalError,
}: {
  jobId: string;
  terminalError: GenerationJobTerminalError;
}) {
  await finalizeUnsuccessfulGenerationJobActivity({
    jobId,
    status: "failed",
    terminalError,
  });

  try {
    await publishGenerationJobFailedRealtimeEventActivity({ jobId });
  } catch {
    // Realtime events are best-effort. The database is already authoritative.
  }
}

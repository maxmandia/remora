import {
  condition,
  defineSignal,
  ParentClosePolicy,
  proxyActivities,
  setHandler,
  sleep,
  startChild,
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
  type DeliverCreditPurchaseAnalyticsWorkflowInput,
  type DeliverGoogleAdsPurchaseConversionWorkflowInput,
  type GenerationProviderCallback,
  type StoredGenerationDraftCacheReference,
  type StoredGenerationResultAssetReference,
  type StoredGenerationResultPreviewReference,
} from "./types.ts";

import {
  isTerminalProviderCallback,
  serializeFinalCostCalculationError,
  serializeProviderError,
  serializeProviderResultError,
  usesCallbackProviderExecution,
  usesInlineProviderExecution,
  usesPollingProviderExecution,
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
  markGenerationJobWaitingForProviderResultActivity,
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

const { pollVideoTaskActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "2 seconds",
    maximumAttempts: 5,
    maximumInterval: "30 seconds",
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

const { deliverCreditPurchaseAnalyticsActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "15 seconds",
  retry: {
    initialInterval: "2 seconds",
    maximumAttempts: 10,
    maximumInterval: "5 minutes",
  },
});

const {
  prepareGoogleAdsPurchaseConversionActivity,
  deliverGoogleAdsPurchaseConversionActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "5 seconds",
    maximumAttempts: 10,
    maximumInterval: "15 minutes",
  },
});

const {
  refreshGoogleAdsPurchaseConversionStatusActivity,
  timeOutGoogleAdsPurchaseConversionActivity,
  pruneGoogleAdsAttributionsActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: {
    initialInterval: "5 seconds",
    maximumAttempts: 5,
    maximumInterval: "5 minutes",
  },
});

const providerCallbackSignal = defineSignal<[GenerationProviderCallback]>(
  generationProviderCallbackSignal,
);

export async function createManualCreditPurchaseWorkflow(
  input: CreateManualCreditPurchaseWorkflowInput,
): Promise<CreateManualCreditPurchaseWorkflowResult> {
  const verifiedPurchase = await verifyManualCreditCheckoutSessionActivity({
    eventOccurredAt: input.eventOccurredAt,
    stripeCheckoutSessionId: input.stripeCheckoutSessionId,
    stripeEventId: input.stripeEventId,
  });

  const grant = await grantManualCreditPurchaseActivity(verifiedPurchase);

  await configureManualCreditPurchaseAutoReloadActivity(verifiedPurchase);

  if (!verifiedPurchase.analyticsContext.suppressed) {
    const childStarts: Promise<unknown>[] = [
      startChild(deliverCreditPurchaseAnalyticsWorkflow, {
        workflowId: `analytics:credit-purchase:${grant.ledgerEntryId}`,
        parentClosePolicy: ParentClosePolicy.ABANDON,
        args: [
          {
            analyticsContext: verifiedPurchase.analyticsContext,
            event: {
              type: "credit_purchase_completed",
              userId: verifiedPurchase.userId,
              occurredAt: input.eventOccurredAt,
              ledgerEntryId: grant.ledgerEntryId,
              purchaseKind: "manual",
              creditAmountUsdMicros: verifiedPurchase.creditAmountUsdMicros,
              autoTopUpSelected: verifiedPurchase.autoReload.enabled,
            },
          },
        ],
      }),
    ];

    if (verifiedPurchase.stripePaymentIntentId) {
      childStarts.push(
        startChild(deliverGoogleAdsPurchaseConversionWorkflow, {
          workflowId: `google-ads:purchase:${verifiedPurchase.stripePaymentIntentId}`,
          parentClosePolicy: ParentClosePolicy.ABANDON,
          args: [
            {
              analyticsContext: verifiedPurchase.analyticsContext,
              attributionId: verifiedPurchase.googleAdsAttributionId,
              creditLedgerEntryId: grant.ledgerEntryId,
              eventOccurredAt: input.eventOccurredAt,
              stripeCheckoutSessionId: verifiedPurchase.stripeCheckoutSessionId,
              transactionId: verifiedPurchase.stripePaymentIntentId,
              userId: verifiedPurchase.userId,
            },
          ],
        }),
      );
    }

    await Promise.all(childStarts);
  }

  return grant;
}

export async function createCreditAutoTopUpWorkflow(
  input: CreateCreditAutoTopUpWorkflowInput,
): Promise<CreateCreditAutoTopUpWorkflowResult> {
  const result = await processCreditAutoTopUpActivity(input);

  if (
    result.status === "succeeded" &&
    input.analyticsContext &&
    !input.analyticsContext.suppressed
  ) {
    await startChild(deliverCreditPurchaseAnalyticsWorkflow, {
      workflowId: `analytics:credit-purchase:${result.grant.ledgerEntryId}`,
      parentClosePolicy: ParentClosePolicy.ABANDON,
      args: [
        {
          analyticsContext: input.analyticsContext,
          event: {
            type: "credit_purchase_completed",
            userId: input.userId,
            occurredAt: result.eventOccurredAt,
            ledgerEntryId: result.grant.ledgerEntryId,
            purchaseKind: "auto_top_up",
            creditAmountUsdMicros: result.creditAmountUsdMicros,
            topUpFloorUsdMicros: result.topUpFloorUsdMicros,
          },
        },
      ],
    });
  }

  return result;
}

export async function deliverCreditPurchaseAnalyticsWorkflow(
  input: DeliverCreditPurchaseAnalyticsWorkflowInput,
): Promise<void> {
  await deliverCreditPurchaseAnalyticsActivity(input);
}

export async function deliverGoogleAdsPurchaseConversionWorkflow(
  input: DeliverGoogleAdsPurchaseConversionWorkflowInput,
): Promise<"skipped" | "succeeded" | "failed" | "timed_out"> {
  const prepared = await prepareGoogleAdsPurchaseConversionActivity(input);

  if (
    prepared.status === "skipped" ||
    prepared.status === "succeeded" ||
    prepared.status === "failed" ||
    prepared.status === "timed_out"
  ) {
    return prepared.status;
  }

  const delivered = await deliverGoogleAdsPurchaseConversionActivity({
    transactionId: input.transactionId,
  });

  if (delivered.status !== "accepted") {
    return delivered.status;
  }

  const diagnosticsTimeoutMs = 24 * 60 * 60 * 1_000;
  const maximumPollIntervalMs = 4 * 60 * 60 * 1_000;
  let elapsedMs = 0;
  let pollIntervalMs = 30 * 60 * 1_000;

  while (elapsedMs < diagnosticsTimeoutMs) {
    const delayMs = Math.min(pollIntervalMs, diagnosticsTimeoutMs - elapsedMs);
    await sleep(delayMs);
    elapsedMs += delayMs;

    let status: "processing" | "succeeded" | "failed" = "processing";

    try {
      status = await refreshGoogleAdsPurchaseConversionStatusActivity({
        googleRequestId: delivered.googleRequestId,
        transactionId: input.transactionId,
      });
    } catch {
      // Diagnostics availability is independent of ingestion. Keep polling
      // until the 24-hour terminal deadline.
    }

    if (status === "succeeded" || status === "failed") {
      return status;
    }

    pollIntervalMs = Math.min(pollIntervalMs * 2, maximumPollIntervalMs);
  }

  await timeOutGoogleAdsPurchaseConversionActivity({
    transactionId: input.transactionId,
  });
  return "timed_out";
}

export async function pruneGoogleAdsAttributionsWorkflow(): Promise<{
  deletedCount: number;
}> {
  return pruneGoogleAdsAttributionsActivity();
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
    }
  | {
      mode: "polling";
      providerTask: Awaited<ReturnType<typeof createVideoTaskActivity>>;
      workflowInput: Extract<
        CreateGenerationWorkflowInput,
        { providerExecution: { mode: "polling" } }
      >;
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
    await reserveProviderCapacity(input);

    const attachmentMedia = input.hasAttachmentMedia
      ? await prepareGenerationAttachmentMediaActivity({
          submissionId: input.submissionId,
        })
      : [];

    if (usesInlineProviderExecution(input)) {
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
    } else if (usesCallbackProviderExecution(input)) {
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
    } else if (usesPollingProviderExecution(input)) {
      execution = {
        mode: "polling",
        workflowInput: input,
        providerTask: await createVideoTaskActivity({
          jobId: input.jobId,
          modelId: input.modelId,
          modelSpecId: input.modelSpecId,
          submittedInput: input.submittedInput,
          attachmentMedia,
          callbackUrl: null,
          ...(input.draftEnhancementSourceJobId
            ? {
                draftEnhancementSourceJobId: input.draftEnhancementSourceJobId,
              }
            : {}),
        }),
      };
    } else {
      throw new Error("Unsupported generation provider execution mode");
    }
  } catch (error) {
    await finalizeFailedGenerationJob({
      analyticsContext: input.analyticsContext,
      jobId: input.jobId,
      terminalError: serializeProviderError(error),
    });

    throw error;
  }

  if (execution.mode === "inline") {
    return finishInlineGeneration(
      input.jobId,
      execution.generated,
      input.analyticsContext,
    );
  }

  if (execution.mode === "polling") {
    return finishPollingGeneration(
      execution.workflowInput,
      execution.providerTask,
      input.analyticsContext,
    );
  }

  return finishCallbackGeneration(
    input.jobId,
    execution.providerTask,
    () => providerCallback,
    input.analyticsContext,
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
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"],
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
      analyticsContext,
      jobId,
      callback,
      providerTaskId: callback.result.providerTaskId,
      terminalError: generated.storageError,
    });
  }

  return completeSucceededGeneration({
    analyticsContext,
    jobId,
    callback,
    providerTaskId: callback.result.providerTaskId,
    storedAssets: [generated.storedAsset],
    storedDraftCache: null,
  });
}

async function finishCallbackGeneration(
  jobId: string,
  providerTask: Awaited<ReturnType<typeof createVideoTaskActivity>>,
  getProviderCallback: () => GenerationProviderCallback | undefined,
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"],
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
      ...toAnalyticsActivityFields(analyticsContext),
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

  return finishTerminalVideoGeneration({
    analyticsContext,
    jobId,
    providerCallback,
    providerTaskId: providerTask.providerTaskId,
  });
}

async function finishPollingGeneration(
  input: Extract<
    CreateGenerationWorkflowInput,
    { providerExecution: { mode: "polling" } }
  >,
  providerTask: Awaited<ReturnType<typeof createVideoTaskActivity>>,
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"],
): Promise<CreateGenerationWorkflowResult> {
  if (!providerTask.pollingUrl) {
    await finalizeFailedGenerationJob({
      analyticsContext,
      jobId: input.jobId,
      terminalError: {
        source: "provider",
        code: "MISSING_PROVIDER_POLLING_URL",
        message: "Provider did not return a polling URL",
      },
    });

    return {
      jobId: input.jobId,
      status: "failed",
      providerTaskId: providerTask.providerTaskId,
    };
  }

  await markGenerationJobWaitingForProviderResultActivity({
    jobId: input.jobId,
    providerId: providerTask.provider,
    providerTaskId: providerTask.providerTaskId,
    providerModelId: providerTask.providerModelId,
  });

  const timeoutMs = 24 * 60 * 60 * 1_000;
  const pollIntervalMs = 2_000;
  let elapsedMs = 0;

  while (elapsedMs < timeoutMs) {
    await sleep(pollIntervalMs);
    elapsedMs += pollIntervalMs;

    const providerCallback = await pollVideoTaskActivity({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      providerTaskId: providerTask.providerTaskId,
      pollingUrl: providerTask.pollingUrl,
      expectsDraftCache: input.submittedInput.draft,
    });

    if (!isTerminalProviderCallback(providerCallback)) {
      continue;
    }

    return finishTerminalVideoGeneration({
      analyticsContext,
      jobId: input.jobId,
      providerCallback,
      providerTaskId: providerTask.providerTaskId,
    });
  }

  await finalizeUnsuccessfulGenerationJobActivity({
    ...toAnalyticsActivityFields(analyticsContext),
    jobId: input.jobId,
    status: "expired",
    terminalError: {
      source: "internal",
      code: "PROVIDER_POLLING_TIMEOUT",
      message: "Provider did not return a terminal result within 24 hours",
    },
  });

  return {
    jobId: input.jobId,
    status: "expired",
    providerTaskId: providerTask.providerTaskId,
  };
}

async function finishTerminalVideoGeneration({
  analyticsContext,
  jobId,
  providerCallback,
  providerTaskId,
}: {
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"];
  jobId: string;
  providerCallback: GenerationProviderCallback;
  providerTaskId: string;
}): Promise<CreateGenerationWorkflowResult> {
  if (providerCallback.kind === "malformed") {
    await finalizeFailedGenerationJob({
      analyticsContext,
      jobId,
      terminalError: providerCallback.terminalError,
    });

    return {
      jobId,
      status: "failed",
      providerTaskId,
    };
  }

  if (providerCallback.result.status === "succeeded") {
    let storedAssets: StoredGenerationResultAssetReference[];
    let storedDraftCache: StoredGenerationDraftCacheReference | null;
    let storedPreview: StoredGenerationResultPreviewReference | null = null;

    try {
      const storedMedia = await saveGenerationMediaActivity({
        jobId,
        videoUrl: providerCallback.result.videoUrl,
        draftCacheUrl: providerCallback.result.draftCacheUrl,
      });
      if (Array.isArray(storedMedia)) {
        storedAssets = storedMedia;
        storedDraftCache = null;
      } else {
        storedAssets = storedMedia.storedAssets;
        storedDraftCache = storedMedia.storedDraftCache;
      }
    } catch {
      return failGenerationMediaStorage({
        analyticsContext,
        jobId,
        callback: providerCallback,
        providerTaskId,
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
      analyticsContext,
      jobId,
      callback: providerCallback,
      providerTaskId,
      storedAssets,
      storedDraftCache,
      storedPreview,
    });
  }

  await persistGenerationResult({
    analyticsContext,
    jobId,
    callback: providerCallback,
  });

  if (providerCallback.result.status === "cancelled") {
    await finalizeUnsuccessfulGenerationJobActivity({
      ...toAnalyticsActivityFields(analyticsContext),
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
      providerTaskId,
    };
  }

  if (providerCallback.result.status === "expired") {
    await finalizeUnsuccessfulGenerationJobActivity({
      ...toAnalyticsActivityFields(analyticsContext),
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
      providerTaskId,
    };
  }

  await finalizeFailedGenerationJob({
    analyticsContext,
    jobId,
    terminalError: serializeProviderResultError(
      providerCallback.result.status,
      providerCallback,
    ),
  });

  return {
    jobId,
    status: "failed",
    providerTaskId,
  };
}

async function completeSucceededGeneration({
  analyticsContext,
  jobId,
  callback,
  providerTaskId,
  storedAssets,
  storedDraftCache,
  storedPreview,
}: {
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"];
  jobId: string;
  callback: GenerationProviderResultCallback;
  providerTaskId: string;
  storedAssets: StoredGenerationResultAssetReference[];
  storedDraftCache: StoredGenerationDraftCacheReference | null;
  storedPreview?: StoredGenerationResultPreviewReference | null;
}): Promise<CreateGenerationWorkflowResult> {
  await persistGenerationResult({
    analyticsContext,
    jobId,
    callback,
    storedAssets,
    storedDraftCache,
    ...(storedPreview !== undefined ? { storedPreview } : {}),
  });

  try {
    await settleGenerationJobCostActivity({
      ...toAnalyticsActivityFields(analyticsContext),
      jobId,
      callback,
    });
  } catch (error) {
    await markGenerationJobFinalCostCalculationFailedActivity({
      ...toAnalyticsActivityFields(analyticsContext),
      jobId,
      terminalError: serializeFinalCostCalculationError(error),
    });

    throw error;
  }

  await markGenerationJobSucceededActivity({
    ...toAnalyticsActivityFields(analyticsContext),
    jobId,
  });

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
  analyticsContext,
  jobId,
  callback,
  providerTaskId,
  terminalError,
}: {
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"];
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

  await persistGenerationResult({ analyticsContext, jobId, callback });

  try {
    await accrueGenerationProviderCostActivity({ jobId, callback });
  } catch (error) {
    await finalizeFailedGenerationJob({
      analyticsContext,
      jobId,
      terminalError: storageError,
    });

    throw error;
  }

  await finalizeFailedGenerationJob({
    analyticsContext,
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
  input: Parameters<typeof upsertGenerationResultActivity>[0] & {
    analyticsContext: CreateGenerationWorkflowInput["analyticsContext"];
  },
) {
  const { analyticsContext, ...activityInput } = input;

  try {
    await upsertGenerationResultActivity(activityInput);
  } catch (error) {
    await finalizeFailedGenerationJob({
      analyticsContext,
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
  analyticsContext,
  jobId,
  terminalError,
}: {
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"];
  jobId: string;
  terminalError: GenerationJobTerminalError;
}) {
  await finalizeUnsuccessfulGenerationJobActivity({
    ...toAnalyticsActivityFields(analyticsContext),
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

function toAnalyticsActivityFields(
  analyticsContext: CreateGenerationWorkflowInput["analyticsContext"],
) {
  return analyticsContext ? { analyticsContext } : {};
}

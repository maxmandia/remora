import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { ApplicationFailure } from "@temporalio/common";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

import * as actualActivities from "./activities.ts";
import {
  configureManualCreditPurchaseAutoReloadActivityType,
  createCreditAutoTopUpWorkflowType,
  createGenerationResultPreviewActivityType,
  createGenerationThreadNameWorkflowType,
  createManualCreditPurchaseWorkflowType,
  createSeedanceVideoTaskActivityType,
  finalizeUnsuccessfulGenerationJobActivityType,
  grantManualCreditPurchaseActivityType,
  generateGenerationThreadNameActivityType,
  reserveSeedanceVideoTaskRateLimitActivityType,
  saveGenerationMediaActivityType,
  settleGenerationJobCostActivityType,
  markGenerationJobCreatingProviderTaskActivityType,
  markGenerationJobSucceededActivityType,
  markGenerationJobWaitingForProviderCallbackActivityType,
  publishGenerationJobSucceededRealtimeEventActivityType,
  processCreditAutoTopUpActivityType,
  publishGenerationThreadNameUpdatedRealtimeEventActivityType,
  seedanceVideoGenerationProviderCallbackSignal,
  upsertGenerationResultActivityType,
  updateGenerationThreadNameActivityType,
  verifyManualCreditCheckoutSessionActivityType,
} from "./types.ts";
import {
  createCreditAutoTopUpWorkflow,
  createGenerationThreadNameWorkflow,
  createManualCreditPurchaseWorkflow,
  createSeedanceVideoGenerationWorkflow,
} from "./workflows.ts";
import type {
  RetrieveSeedanceVideoTaskResult,
  SeedanceProviderStatus,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";

const require = createRequire(import.meta.url);
// Keep CI independent from temporal.download's mutable "default" resolver.
const timeSkippingServerVersion = "v1.36.1";

function createTimeSkippingTestEnvironment() {
  return TestWorkflowEnvironment.createTimeSkipping({
    server: {
      executable: {
        type: "cached-download",
        version: timeSkippingServerVersion,
      },
    },
  });
}

const activities = {
  ...actualActivities,
  reserveSeedanceVideoTaskRateLimitActivity: async () => ({
    status: "reserved" as const,
    reservedAt: new Date("2026-07-07T12:00:00.000Z"),
  }),
};

describe("generation thread name workflow", () => {
  it("generates, conditionally updates, and publishes the new name in order", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `generation-thread-name-${randomUUID()}`;
    const activityLog: string[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          generateGenerationThreadNameActivity: async () => {
            activityLog.push(generateGenerationThreadNameActivityType);
            return { name: "Quiet Ocean Studio" };
          },
          updateGenerationThreadNameActivity: async () => {
            activityLog.push(updateGenerationThreadNameActivityType);
            return { updated: true };
          },
          publishGenerationThreadNameUpdatedRealtimeEventActivity: async () => {
            activityLog.push(
              publishGenerationThreadNameUpdatedRealtimeEventActivityType,
            );
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createGenerationThreadNameWorkflow, {
          workflowId: `${createGenerationThreadNameWorkflowType}-${randomUUID()}`,
          taskQueue,
          args: [
            {
              threadId: "thread_1",
              userId: "user_1",
              prompt: "A quiet ocean studio",
              provisionalName: "A quiet ocean studio",
            },
          ],
        }),
      );

      expect(result).toEqual({ threadId: "thread_1", updated: true });
      expect(activityLog).toEqual([
        generateGenerationThreadNameActivityType,
        updateGenerationThreadNameActivityType,
        publishGenerationThreadNameUpdatedRealtimeEventActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("does not publish when the provisional name has already changed", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `generation-thread-name-skip-${randomUUID()}`;
    let publishCalls = 0;

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          generateGenerationThreadNameActivity: async () => ({
            name: "Quiet Ocean Studio",
          }),
          updateGenerationThreadNameActivity: async () => ({
            updated: false,
          }),
          publishGenerationThreadNameUpdatedRealtimeEventActivity: async () => {
            publishCalls += 1;
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createGenerationThreadNameWorkflow, {
          workflowId: `${createGenerationThreadNameWorkflowType}-${randomUUID()}`,
          taskQueue,
          args: [
            {
              threadId: "thread_1",
              userId: "user_1",
              prompt: "A quiet ocean studio",
              provisionalName: "A quiet ocean studio",
            },
          ],
        }),
      );

      expect(result).toEqual({ threadId: "thread_1", updated: false });
      expect(publishCalls).toBe(0);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);
});

describe("credit purchase workflows", () => {
  it("grants manual credits before configuring auto-reload", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `credit-purchase-${randomUUID()}`;
    const activityLog: string[] = [];
    const configureInputs: unknown[] = [];
    const verifiedPurchase = {
      userId: "user_1",
      amountCents: 2500,
      creditAmountUsdMicros: 25_000_000,
      stripeCheckoutSessionId: "cs_123",
      stripePaymentIntentId: "pi_123",
      stripeEventId: "evt_123",
      autoReload: {
        enabled: true,
        topUpFloorUsdMicros: 5_000_000,
        topUpAmountUsdMicros: 25_000_000,
        stripePaymentMethodId: "pm_123",
      },
    };
    const grant = {
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_1",
      alreadyGranted: false,
    };

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          verifyManualCreditCheckoutSessionActivity: async () => {
            activityLog.push(verifyManualCreditCheckoutSessionActivityType);

            return verifiedPurchase;
          },
          grantManualCreditPurchaseActivity: async () => {
            activityLog.push(grantManualCreditPurchaseActivityType);

            return grant;
          },
          configureManualCreditPurchaseAutoReloadActivity: async (
            input: unknown,
          ) => {
            activityLog.push(
              configureManualCreditPurchaseAutoReloadActivityType,
            );
            configureInputs.push(input);

            return { enabled: true };
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createManualCreditPurchaseWorkflow, {
          workflowId: `${createManualCreditPurchaseWorkflowType}-${randomUUID()}`,
          taskQueue,
          args: [
            {
              stripeCheckoutSessionId: "cs_123",
              stripeEventId: "evt_123",
              receivedAt: "2026-06-29T00:00:00.000Z",
            },
          ],
        }),
      );

      expect(result).toEqual(grant);
      expect(activityLog).toEqual([
        verifyManualCreditCheckoutSessionActivityType,
        grantManualCreditPurchaseActivityType,
        configureManualCreditPurchaseAutoReloadActivityType,
      ]);
      expect(configureInputs).toEqual([verifiedPurchase]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("processes credit auto-top-up requests", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `credit-auto-top-up-${randomUUID()}`;
    const activityLog: string[] = [];
    const processInputs: unknown[] = [];
    const workflowInput = {
      userId: "user_1",
      triggerLedgerEntryId: "ledger_spend_1",
    };
    const workflowResult = {
      status: "succeeded" as const,
      grant: {
        userId: "user_1",
        availableCreditAmountUsdMicros: 20_000_000,
        reservedCreditAmountUsdMicros: 0,
        ledgerEntryId: "ledger_top_up_1",
        alreadyGranted: false,
      },
    };

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          processCreditAutoTopUpActivity: async (input: unknown) => {
            activityLog.push(processCreditAutoTopUpActivityType);
            processInputs.push(input);

            return workflowResult;
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createCreditAutoTopUpWorkflow, {
          workflowId: `${createCreditAutoTopUpWorkflowType}-${randomUUID()}`,
          taskQueue,
          args: [workflowInput],
        }),
      );

      expect(result).toEqual(workflowResult);
      expect(activityLog).toEqual([processCreditAutoTopUpActivityType]);
      expect(processInputs).toEqual([workflowInput]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);
});

describe("Seedance video generation workflow", () => {
  it("waits for a succeeded provider callback and stores the generation result", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-create-${randomUUID()}`;
    const activityLog: string[] = [];
    const importInputs: unknown[] = [];
    const previewInputs: unknown[] = [];
    const providerTaskInputs: unknown[] = [];
    const upsertInputs: unknown[] = [];
    const settlementInputs: unknown[] = [];
    const storedVideoAsset = createStoredAsset();
    const storedPreview = createStoredPreview();

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async (input: unknown) => {
            activityLog.push(createSeedanceVideoTaskActivityType);
            providerTaskInputs.push(input);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-fast-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({
              status: "waiting_for_provider_callback",
              providerTaskId: "cgt-123",
            });
          },
          saveGenerationMediaActivity: async (input: unknown) => {
            activityLog.push(saveGenerationMediaActivityType);
            importInputs.push(input);

            return [storedVideoAsset];
          },
          createGenerationResultPreviewActivity: async (input: unknown) => {
            activityLog.push(createGenerationResultPreviewActivityType);
            previewInputs.push(input);

            return storedPreview;
          },
          upsertGenerationResultActivity: async (input: unknown) => {
            activityLog.push(upsertGenerationResultActivityType);
            upsertInputs.push(input);

            return {};
          },
          settleGenerationJobCostActivity: async (input: unknown) => {
            activityLog.push(settleGenerationJobCostActivityType);
            settlementInputs.push(input);
          },
          markGenerationJobSucceededActivity: async () => {
            activityLog.push(markGenerationJobSucceededActivityType);

            return createJob({ status: "succeeded" });
          },
          publishGenerationJobSucceededRealtimeEventActivity: async () => {
            activityLog.push(
              publishGenerationJobSucceededRealtimeEventActivityType,
            );
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [
                createWorkflowInput({
                  modelId: "seedance-2.0-fast-video",
                  modelSpecId: "seedance-2.0-fast-video-v1",
                }),
              ],
            },
          );
          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({
              status: "succeeded",
              providerModelId: "dreamina-seedance-2-0-fast-260128",
            }),
          );

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "succeeded",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        createGenerationResultPreviewActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
      expect(providerTaskInputs).toEqual([
        expect.objectContaining({
          jobId: "job_1",
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
        }),
      ]);
      expect(importInputs).toEqual([
        {
          jobId: "job_1",
          videoUrl: "https://assets.example/video.mp4",
        },
      ]);
      expect(previewInputs).toEqual([
        {
          jobId: "job_1",
          video: storedVideoAsset,
        },
      ]);
      expect(upsertInputs).toEqual([
        {
          jobId: "job_1",
          callback: createProviderCallback({
            providerModelId: "dreamina-seedance-2-0-fast-260128",
          }),
          storedAssets: [storedVideoAsset],
          storedPreview,
        },
      ]);
      expect(settlementInputs).toEqual([
        {
          jobId: "job_1",
          callback: createProviderCallback({
            providerModelId: "dreamina-seedance-2-0-fast-260128",
          }),
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("waits for rate-limit capacity before creating the provider task", async () => {
    const testEnv = await createTimeSkippingTestEnvironment();
    const taskQueue = `seedance-rate-limit-${randomUUID()}`;
    const activityLog: string[] = [];
    let reservationAttempts = 0;

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          reserveSeedanceVideoTaskRateLimitActivity: async () => {
            activityLog.push(reserveSeedanceVideoTaskRateLimitActivityType);
            reservationAttempts += 1;

            if (reservationAttempts === 1) {
              return {
                status: "delayed" as const,
                retryAt: new Date("2026-07-07T12:01:00.000Z"),
                delayMs: 60_000,
                bucketIds: ["bucket_1"],
              };
            }

            return {
              status: "reserved" as const,
              reservedAt: new Date("2026-07-07T12:01:00.000Z"),
            };
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({ status: "waiting_for_provider_callback" });
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType);

            return {};
          },
          finalizeUnsuccessfulGenerationJobActivity: async () => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);

            return createJob({ status: "failed" });
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );

          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({ status: "failed" }),
          );

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "failed",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        reserveSeedanceVideoTaskRateLimitActivityType,
        reserveSeedanceVideoTaskRateLimitActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        upsertGenerationResultActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("keeps a succeeded workflow succeeded when realtime publish fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-realtime-failure-${randomUUID()}`;
    const activityLog: string[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({
              status: "waiting_for_provider_callback",
              providerTaskId: "cgt-123",
            });
          },
          saveGenerationMediaActivity: async () => {
            activityLog.push(saveGenerationMediaActivityType);

            return [createStoredAsset()];
          },
          createGenerationResultPreviewActivity: async () => {
            activityLog.push(createGenerationResultPreviewActivityType);

            return createStoredPreview();
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType);

            return {};
          },
          settleGenerationJobCostActivity: async () => {
            activityLog.push(settleGenerationJobCostActivityType);
          },
          markGenerationJobSucceededActivity: async () => {
            activityLog.push(markGenerationJobSucceededActivityType);

            return createJob({ status: "succeeded" });
          },
          publishGenerationJobSucceededRealtimeEventActivity: async () => {
            activityLog.push(
              publishGenerationJobSucceededRealtimeEventActivityType,
            );

            throw ApplicationFailure.nonRetryable(
              "Realtime publish failed",
              "RealtimePublishError",
            );
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({ status: "succeeded" }),
          );

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "succeeded",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        createGenerationResultPreviewActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("keeps a succeeded workflow succeeded when preview generation fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-preview-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const upsertInputs: unknown[] = [];
    const storedVideoAsset = createStoredAsset();

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({
              status: "waiting_for_provider_callback",
              providerTaskId: "cgt-123",
            });
          },
          saveGenerationMediaActivity: async () => {
            activityLog.push(saveGenerationMediaActivityType);

            return [storedVideoAsset];
          },
          createGenerationResultPreviewActivity: async () => {
            activityLog.push(createGenerationResultPreviewActivityType);

            throw ApplicationFailure.nonRetryable(
              "Preview extraction failed",
              "GenerationPreviewError",
            );
          },
          upsertGenerationResultActivity: async (input: unknown) => {
            activityLog.push(upsertGenerationResultActivityType);
            upsertInputs.push(input);

            return {};
          },
          settleGenerationJobCostActivity: async () => {
            activityLog.push(settleGenerationJobCostActivityType);
          },
          markGenerationJobSucceededActivity: async () => {
            activityLog.push(markGenerationJobSucceededActivityType);

            return createJob({ status: "succeeded" });
          },
          publishGenerationJobSucceededRealtimeEventActivity: async () => {
            activityLog.push(
              publishGenerationJobSucceededRealtimeEventActivityType,
            );
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({ status: "succeeded" }),
          );

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "succeeded",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        createGenerationResultPreviewActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
      expect(upsertInputs).toEqual([
        {
          jobId: "job_1",
          callback: createProviderCallback({ status: "succeeded" }),
          storedAssets: [storedVideoAsset],
          storedPreview: null,
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("marks the job with final cost calculation failure when settlement fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-final-cost-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const finalCostFailureInputs: unknown[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({
              status: "waiting_for_provider_callback",
              providerTaskId: "cgt-123",
            });
          },
          saveGenerationMediaActivity: async () => {
            activityLog.push(saveGenerationMediaActivityType);

            return [createStoredAsset()];
          },
          createGenerationResultPreviewActivity: async () => {
            activityLog.push(createGenerationResultPreviewActivityType);

            return createStoredPreview();
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType);

            return {};
          },
          settleGenerationJobCostActivity: async () => {
            activityLog.push(settleGenerationJobCostActivityType);

            throw ApplicationFailure.nonRetryable(
              "Model rates unavailable",
              "GenerationCostFinalizationError",
            );
          },
          markGenerationJobFinalCostCalculationFailedActivity: async (
            input: unknown,
          ) => {
            activityLog.push(
              "markGenerationJobFinalCostCalculationFailedActivity",
            );
            finalCostFailureInputs.push(input);

            return createJob({
              status: "final_cost_calculation_failure",
              terminalError: {
                source: "internal",
                code: "FINAL_COST_CALCULATION_FAILED",
                message: "Model rates unavailable",
              },
            });
          },
          markGenerationJobSucceededActivity: async () => {
            activityLog.push(markGenerationJobSucceededActivityType);

            return createJob({ status: "succeeded" });
          },
          publishGenerationJobSucceededRealtimeEventActivity: async () => {
            activityLog.push(
              publishGenerationJobSucceededRealtimeEventActivityType,
            );
          },
        },
      });

      await expect(
        worker.runUntil(
          (async () => {
            const handle = await testEnv.client.workflow.start(
              createSeedanceVideoGenerationWorkflow,
              {
                workflowId: `generation-job-${randomUUID()}`,
                taskQueue,
                args: [createWorkflowInput()],
              },
            );
            await handle.signal(
              seedanceVideoGenerationProviderCallbackSignal,
              createProviderCallback({ status: "succeeded" }),
            );

            return handle.result();
          })(),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        createGenerationResultPreviewActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        "markGenerationJobFinalCostCalculationFailedActivity",
      ]);
      expect(finalCostFailureInputs).toEqual([
        {
          jobId: "job_1",
          terminalError: {
            source: "internal",
            code: "FINAL_COST_CALCULATION_FAILED",
            message: "Model rates unavailable",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("marks the job failed with an internal error when succeeded media import fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-storage-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const failedInputs: unknown[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({
              status: "waiting_for_provider_callback",
              providerTaskId: "cgt-123",
            });
          },
          saveGenerationMediaActivity: async () => {
            activityLog.push(saveGenerationMediaActivityType);

            throw ApplicationFailure.nonRetryable(
              "R2 upload failed",
              "ObjectStorageError",
            );
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType);

            return {};
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            failedInputs.push(input);

            return createJob({
              status: "failed",
              terminalError: {
                source: "internal",
                code: "GENERATION_MEDIA_STORAGE_FAILED",
                message:
                  "Generated media could not be copied into durable storage",
              },
            });
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({ status: "succeeded" }),
          );

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "failed",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
          status: "failed",
          terminalError: {
            source: "internal",
            code: "GENERATION_MEDIA_STORAGE_FAILED",
            message: "Generated media could not be copied into durable storage",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it.each([
    {
      providerStatus: "failed",
    },
    {
      providerStatus: "cancelled",
    },
    {
      providerStatus: "expired",
    },
  ] satisfies Array<{
    providerStatus: SeedanceProviderStatus;
  }>)(
    "stores the result and marks the job $providerStatus when a terminal callback arrives",
    async ({ providerStatus }) => {
      const testEnv = await TestWorkflowEnvironment.createLocal();
      const taskQueue = `seedance-callback-${randomUUID()}`;
      const activityLog: string[] = [];
      const terminalInputs: unknown[] = [];

      try {
        const worker = await Worker.create({
          connection: testEnv.nativeConnection,
          namespace: testEnv.namespace,
          taskQueue,
          workflowsPath: require.resolve("./workflows.ts"),
          activities: {
            ...activities,
            markGenerationJobCreatingProviderTaskActivity: async () => {
              activityLog.push(
                markGenerationJobCreatingProviderTaskActivityType,
              );

              return createJob({ status: "creating_provider_task" });
            },
            createSeedanceVideoTaskActivity: async () => {
              activityLog.push(createSeedanceVideoTaskActivityType);

              return {
                provider: "byteplus",
                providerTaskId: "cgt-123",
                providerModelId: "dreamina-seedance-2-0-260128",
              };
            },
            markGenerationJobWaitingForProviderCallbackActivity: async () => {
              activityLog.push(
                markGenerationJobWaitingForProviderCallbackActivityType,
              );

              return createJob({ status: "waiting_for_provider_callback" });
            },
            upsertGenerationResultActivity: async () => {
              activityLog.push(upsertGenerationResultActivityType);

              return {};
            },
            finalizeUnsuccessfulGenerationJobActivity: async (
              input: unknown,
            ) => {
              activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
              terminalInputs.push(input);

              return createJob({ status: providerStatus });
            },
          },
        });

        const result = await worker.runUntil(
          (async () => {
            const handle = await testEnv.client.workflow.start(
              createSeedanceVideoGenerationWorkflow,
              {
                workflowId: `generation-job-${randomUUID()}`,
                taskQueue,
                args: [createWorkflowInput()],
              },
            );
            await handle.signal(
              seedanceVideoGenerationProviderCallbackSignal,
              createProviderCallback({
                status: providerStatus,
                providerError: {
                  code: "ProviderTaskError",
                  message: `Provider task ${providerStatus}`,
                },
              }),
            );

            return handle.result();
          })(),
        );

        expect(result).toEqual({
          jobId: "job_1",
          status: providerStatus,
          providerTaskId: "cgt-123",
        });
        expect(activityLog).toEqual([
          markGenerationJobCreatingProviderTaskActivityType,
          createSeedanceVideoTaskActivityType,
          markGenerationJobWaitingForProviderCallbackActivityType,
          upsertGenerationResultActivityType,
          finalizeUnsuccessfulGenerationJobActivityType,
        ]);
        expect(terminalInputs).toEqual([
          {
            jobId: "job_1",
            status: providerStatus,
            terminalError: {
              source: "provider",
              code: "ProviderTaskError",
              message: `Provider task ${providerStatus}`,
            },
          },
        ]);
      } finally {
        await testEnv.teardown();
      }
    },
    60_000,
  );

  it("marks the job failed when an authenticated malformed callback arrives", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-malformed-${randomUUID()}`;
    const activityLog: string[] = [];
    const failedInputs: unknown[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({ status: "waiting_for_provider_callback" });
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType);

            return {};
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            failedInputs.push(input);

            return createJob({ status: "failed" });
          },
        },
      });

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(seedanceVideoGenerationProviderCallbackSignal, {
            kind: "malformed",
            terminalError: {
              source: "provider",
              code: "MALFORMED_PROVIDER_CALLBACK",
              message: "Provider callback payload could not be parsed",
            },
            rawPayload: {
              unexpected: true,
            },
            receivedAt: "2026-06-05T00:00:00.000Z",
          });

          return handle.result();
        })(),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "failed",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
          status: "failed",
          terminalError: {
            source: "provider",
            code: "MALFORMED_PROVIDER_CALLBACK",
            message: "Provider callback payload could not be parsed",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("marks the job failed when provider task creation fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-create-${randomUUID()}`;
    const activityLog: string[] = [];
    const failedInputs: unknown[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            throw new Error("BytePlus request failed");
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            failedInputs.push(input);

            return createJob({
              status: "failed",
              terminalError: {
                source: "provider",
                code: "Error",
                message: "BytePlus request failed",
              },
            });
          },
        },
      });

      await expect(
        worker.runUntil(
          testEnv.client.workflow.execute(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          ),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
          status: "failed",
          terminalError: {
            source: "provider",
            code: "Error",
            message: "BytePlus request failed",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("does not mark the job failed when storing a created provider task fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-create-${randomUUID()}`;
    const activityLog: string[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            throw ApplicationFailure.nonRetryable(
              "Database update failed",
              "PersistenceFailure",
            );
          },
        },
      });

      await expect(
        worker.runUntil(
          testEnv.client.workflow.execute(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          ),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("marks the job expired when no provider callback arrives within 24 hours", async () => {
    const testEnv = await createTimeSkippingTestEnvironment();
    const taskQueue = `seedance-timeout-${randomUUID()}`;
    const activityLog: string[] = [];
    const expiredInputs: unknown[] = [];

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve("./workflows.ts"),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType);

            return createJob({ status: "creating_provider_task" });
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType);

            return {
              provider: "byteplus",
              providerTaskId: "cgt-123",
              providerModelId: "dreamina-seedance-2-0-260128",
            };
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({ status: "waiting_for_provider_callback" });
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            expiredInputs.push(input);

            return createJob({ status: "expired" });
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createSeedanceVideoGenerationWorkflow, {
          workflowId: `generation-job-${randomUUID()}`,
          taskQueue,
          args: [createWorkflowInput()],
        }),
      );

      expect(result).toEqual({
        jobId: "job_1",
        status: "expired",
        providerTaskId: "cgt-123",
      });
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(expiredInputs).toEqual([
        {
          jobId: "job_1",
          status: "expired",
          terminalError: {
            source: "internal",
            code: "PROVIDER_CALLBACK_TIMEOUT",
            message: "Provider callback was not received within 24 hours",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);
});

function createWorkflowInput(
  overrides: Partial<{
    modelId: string;
    modelSpecId: string;
    hasAttachmentMedia: boolean;
  }> = {},
) {
  return {
    jobId: "job_1",
    submissionId: "submission_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    prompt: "A quiet ocean studio",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    hasAttachmentMedia: false,
    callbackUrl:
      "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=secret",
    ...overrides,
  };
}

function createProviderCallback(
  overrides: Partial<RetrieveSeedanceVideoTaskResult> = {},
) {
  const result = {
    provider: "byteplus" as const,
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    status: "succeeded" as const,
    videoUrl: "https://assets.example/video.mp4",
    usage: null,
    createdAt: 1780770000,
    updatedAt: 1780770060,
    providerError: null,
    ...overrides,
  };

  return {
    kind: "result" as const,
    result,
    rawPayload: {
      id: result.providerTaskId,
      status: result.status,
      content: {
        video_url: result.videoUrl,
      },
    },
    receivedAt: "2026-06-05T00:00:00.000Z",
  };
}

function createStoredAsset(
  overrides: Partial<StoredGenerationResultAssetReference> = {},
): StoredGenerationResultAssetReference {
  return {
    kind: "video",
    bucket: "remora-dev-media",
    objectKey: "jobs/job_1/video.mp4",
    contentType: "video/mp4",
    contentLength: 1024,
    etag: '"video-etag"',
    checksumSha256: "video-checksum",
    sourceProviderUrl: "https://assets.example/video.mp4",
    ...overrides,
  };
}

function createStoredPreview(
  overrides: Partial<StoredGenerationResultPreviewReference> = {},
): StoredGenerationResultPreviewReference {
  return {
    bucket: "remora-dev-media",
    objectKey: "jobs/job_1/preview.jpg",
    contentType: "image/jpeg",
    contentLength: 4321,
    etag: '"preview-etag"',
    checksumSha256: "preview-sha256",
    frameTimeMs: 1000,
    ...overrides,
  };
}

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    status: "queued",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: "callback-token-hash",
    providerId: "byteplus",
    providerTaskId: null,
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

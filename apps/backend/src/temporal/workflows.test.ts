import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { ApplicationFailure } from "@temporalio/common";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

import * as actualActivities from "./activities.ts";
import {
  accrueGenerationProviderCostActivityType,
  configureManualCreditPurchaseAutoReloadActivityType,
  createAndStoreImageActivityType,
  type CreateAndStoreImageActivityResult,
  type CreateGenerationWorkflowInput,
  createCreditAutoTopUpWorkflowType,
  createGenerationResultPreviewActivityType,
  createGenerationThreadNameWorkflowType,
  createManualCreditPurchaseWorkflowType,
  createVideoTaskActivityType,
  finalizeUnsuccessfulGenerationJobActivityType,
  grantManualCreditPurchaseActivityType,
  generateGenerationThreadNameActivityType,
  reserveProviderSubmissionCapacityActivityType,
  saveGenerationMediaActivityType,
  settleGenerationJobCostActivityType,
  markGenerationJobCreatingProviderTaskActivityType,
  markGenerationJobProviderTaskCreatedActivityType,
  markGenerationJobSucceededActivityType,
  markGenerationJobWaitingForProviderCallbackActivityType,
  publishGenerationJobSucceededRealtimeEventActivityType,
  processCreditAutoTopUpActivityType,
  publishGenerationThreadNameUpdatedRealtimeEventActivityType,
  generationProviderCallbackSignal,
  upsertGenerationResultActivityType,
  updateGenerationThreadNameActivityType,
  verifyManualCreditCheckoutSessionActivityType,
} from "./types.ts";
import {
  createCreditAutoTopUpWorkflow,
  createGenerationWorkflow,
  createGenerationThreadNameWorkflow,
  createManualCreditPurchaseWorkflow,
} from "./workflows.ts";
import type {
  GenerationProviderTaskResult,
  GenerationProviderTaskStatus,
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
  reserveProviderSubmissionCapacityActivity: async () => ({
    status: "reserved" as const,
    reservedAt: new Date("2026-07-07T12:00:00.000Z"),
  }),
};

type InlineGenerationWorkflowInput = Extract<
  CreateGenerationWorkflowInput,
  { providerExecution: { mode: "inline" } }
>;

type CallbackGenerationWorkflowInput = Extract<
  CreateGenerationWorkflowInput,
  { providerExecution: { mode: "callback" } }
>;

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

describe("image generation workflow", () => {
  it("waits durably for capacity, prepares attachments, and completes synchronously without callback waiting", async () => {
    const testEnv = await createTimeSkippingTestEnvironment();
    const taskQueue = `image-create-${randomUUID()}`;
    const activityLog: string[] = [];
    const reservationInputs: unknown[] = [];
    const providerInputs: unknown[] = [];
    const upsertInputs: unknown[] = [];
    const settlementInputs: unknown[] = [];
    const attachmentMedia = [
      {
        fieldId: "images",
        role: "reference",
        url: "https://signed.example/reference.png",
        contentType: "image/png",
        contentLength: 2048,
      },
    ];
    const generated = createStoredImageActivityResult();
    let reservationAttempts = 0;
    let providerRequests = 0;

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
          prepareGenerationAttachmentMediaActivity: async (input: unknown) => {
            activityLog.push("prepareGenerationAttachmentMediaActivity");
            expect(input).toEqual({ submissionId: "submission_image_1" });

            return attachmentMedia;
          },
          reserveProviderSubmissionCapacityActivity: async (input: unknown) => {
            activityLog.push(reserveProviderSubmissionCapacityActivityType);
            reservationInputs.push(input);
            reservationAttempts += 1;

            if (reservationAttempts === 1) {
              return {
                status: "delayed" as const,
                retryAt: new Date("2026-07-07T12:01:00.000Z"),
                delayMs: 60_000,
                bucketIds: ["google-rpm", "google-rpd"],
              };
            }

            return {
              status: "reserved" as const,
              reservedAt: new Date("2026-07-07T12:01:00.000Z"),
            };
          },
          createAndStoreImageActivity: async (input: unknown) => {
            activityLog.push(createAndStoreImageActivityType);
            providerInputs.push(input);
            providerRequests += 1;

            return generated;
          },
          markGenerationJobProviderTaskCreatedActivity: async (
            input: unknown,
          ) => {
            activityLog.push(markGenerationJobProviderTaskCreatedActivityType);
            expect(input).toEqual({
              jobId: "job_image_1",
              providerId: "google",
              providerTaskId: "interaction_123",
              providerModelId: "gemini-3.1-flash-image",
            });

            return createJob({
              status: "provider_task_created",
              providerId: "google",
              providerTaskId: "interaction_123",
            });
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
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({ status: "waiting_for_provider_callback" });
          },
        },
      });

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createGenerationWorkflow, {
          workflowId: `generation-image-${randomUUID()}`,
          taskQueue,
          args: [createImageWorkflowInput({ hasAttachmentMedia: true })],
        }),
      );

      expect(result).toEqual({
        jobId: "job_image_1",
        status: "succeeded",
        providerTaskId: "interaction_123",
      });
      expect(providerRequests).toBe(1);
      expect(reservationInputs).toEqual([
        {
          jobId: "job_image_1",
          modelSpecId: "nano-banana-2-v1",
          providerId: "google",
          facts: { outputResolution: "1K" },
        },
        {
          jobId: "job_image_1",
          modelSpecId: "nano-banana-2-v1",
          providerId: "google",
          facts: { outputResolution: "1K" },
        },
      ]);
      expect(providerInputs).toEqual([
        {
          jobId: "job_image_1",
          modelId: "nano-banana-2",
          modelSpecId: "nano-banana-2-v1",
          submittedInput: createImageWorkflowInput().submittedInput,
          attachmentMedia,
        },
      ]);
      expect(upsertInputs).toEqual([
        {
          jobId: "job_image_1",
          callback: generated.callback,
          storedAssets: [generated.storedAsset],
        },
      ]);
      expect(settlementInputs).toEqual([
        {
          jobId: "job_image_1",
          callback: generated.callback,
        },
      ]);
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        "prepareGenerationAttachmentMediaActivity",
        reserveProviderSubmissionCapacityActivityType,
        reserveProviderSubmissionCapacityActivityType,
        createAndStoreImageActivityType,
        markGenerationJobProviderTaskCreatedActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
      expect(activityLog).not.toContain(
        markGenerationJobWaitingForProviderCallbackActivityType,
      );
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("terminalizes and releases the customer reservation when the provider request fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `image-provider-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const failedInputs: unknown[] = [];
    let providerRequests = 0;

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
          createAndStoreImageActivity: async () => {
            activityLog.push(createAndStoreImageActivityType);
            providerRequests += 1;

            throw ApplicationFailure.nonRetryable(
              "Google rejected the image request",
              "GOOGLE_PROVIDER_REQUEST_FAILED",
            );
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            failedInputs.push(input);

            return createJob({ status: "failed" });
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(
              markGenerationJobWaitingForProviderCallbackActivityType,
            );

            return createJob({ status: "waiting_for_provider_callback" });
          },
        },
      });

      await expect(
        worker.runUntil(
          testEnv.client.workflow.execute(createGenerationWorkflow, {
            workflowId: `generation-image-${randomUUID()}`,
            taskQueue,
            args: [createImageWorkflowInput()],
          }),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(providerRequests).toBe(1);
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createAndStoreImageActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_image_1",
          status: "failed",
          terminalError: {
            source: "provider",
            code: "GOOGLE_PROVIDER_REQUEST_FAILED",
            message: "Google rejected the image request",
          },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("persists provider metadata and accrues spend before releasing customer credit when image storage fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `image-storage-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const upsertInputs: unknown[] = [];
    const accrualInputs: unknown[] = [];
    const failedInputs: unknown[] = [];
    let providerRequests = 0;
    const generated = createStoredImageActivityResult({
      storedAsset: null,
      storageError: {
        source: "internal",
        code: "GENERATION_MEDIA_STORAGE_FAILED",
        message: "Generated media could not be copied into durable storage",
      },
    });

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
          createAndStoreImageActivity: async () => {
            activityLog.push(createAndStoreImageActivityType);
            providerRequests += 1;

            return generated;
          },
          markGenerationJobProviderTaskCreatedActivity: async () => {
            activityLog.push(markGenerationJobProviderTaskCreatedActivityType);

            return createJob({ status: "provider_task_created" });
          },
          upsertGenerationResultActivity: async (input: unknown) => {
            activityLog.push(upsertGenerationResultActivityType);
            upsertInputs.push(input);

            return {};
          },
          accrueGenerationProviderCostActivity: async (input: unknown) => {
            activityLog.push(accrueGenerationProviderCostActivityType);
            accrualInputs.push(input);
          },
          finalizeUnsuccessfulGenerationJobActivity: async (input: unknown) => {
            activityLog.push(finalizeUnsuccessfulGenerationJobActivityType);
            failedInputs.push(input);

            return createJob({ status: "failed" });
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
        testEnv.client.workflow.execute(createGenerationWorkflow, {
          workflowId: `generation-image-${randomUUID()}`,
          taskQueue,
          args: [createImageWorkflowInput()],
        }),
      );

      expect(result).toEqual({
        jobId: "job_image_1",
        status: "failed",
        providerTaskId: "interaction_123",
      });
      expect(providerRequests).toBe(1);
      expect(upsertInputs).toEqual([
        {
          jobId: "job_image_1",
          callback: generated.callback,
        },
      ]);
      expect(accrualInputs).toEqual([
        {
          jobId: "job_image_1",
          callback: generated.callback,
        },
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_image_1",
          status: "failed",
          terminalError: generated.storageError,
        },
      ]);
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createAndStoreImageActivityType,
        markGenerationJobProviderTaskCreatedActivityType,
        upsertGenerationResultActivityType,
        accrueGenerationProviderCostActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);
});

describe("video generation workflow", () => {
  it("preserves a succeeded callback when a later nonterminal callback arrives", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `video-create-${randomUUID()}`;
    const activityLog: string[] = [];
    const importInputs: unknown[] = [];
    const previewInputs: unknown[] = [];
    const providerTaskInputs: unknown[] = [];
    const upsertInputs: unknown[] = [];
    const settlementInputs: unknown[] = [];
    const storedVideoAsset = createStoredAsset();
    const storedPreview = createStoredPreview();
    const providerTaskCreationStarted = createDeferred();
    const releaseProviderTaskCreation = createDeferred();

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
          createVideoTaskActivity: async (input: unknown) => {
            activityLog.push(createVideoTaskActivityType);
            providerTaskInputs.push(input);
            providerTaskCreationStarted.resolve();
            await releaseProviderTaskCreation.promise;

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
            createGenerationWorkflow,
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
          await providerTaskCreationStarted.promise;
          await handle.signal(
            generationProviderCallbackSignal,
            createProviderCallback({
              status: "succeeded",
              providerModelId: "dreamina-seedance-2-0-fast-260128",
            }),
          );
          await handle.signal(
            generationProviderCallbackSignal,
            createProviderCallback({
              status: "running",
              providerModelId: "dreamina-seedance-2-0-fast-260128",
              videoUrl: null,
            }),
          );
          releaseProviderTaskCreation.resolve();

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
        createVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        createGenerationResultPreviewActivityType,
        upsertGenerationResultActivityType,
        settleGenerationJobCostActivityType,
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
      expect(providerTaskInputs).toEqual([
        {
          jobId: "job_1",
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
          submittedInput: {
            prompt: "A quiet ocean studio",
            resolution: "720p",
            aspectRatio: "16:9",
            duration: 5,
            generateAudio: true,
          },
          attachmentMedia: [],
          callbackUrl:
            "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=secret",
        },
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
    const taskQueue = `video-rate-limit-${randomUUID()}`;
    const activityLog: string[] = [];
    const reservationInputs: unknown[] = [];
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
          reserveProviderSubmissionCapacityActivity: async (input: unknown) => {
            activityLog.push(reserveProviderSubmissionCapacityActivityType);
            reservationInputs.push(input);
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
            createGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );

          await handle.signal(
            generationProviderCallbackSignal,
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
        reserveProviderSubmissionCapacityActivityType,
        reserveProviderSubmissionCapacityActivityType,
        createVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        upsertGenerationResultActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(reservationInputs).toEqual([
        {
          jobId: "job_1",
          modelSpecId: "seedance-2.0-video-v1",
          providerId: "byteplus",
          facts: { outputResolution: "720p" },
        },
        {
          jobId: "job_1",
          modelSpecId: "seedance-2.0-video-v1",
          providerId: "byteplus",
          facts: { outputResolution: "720p" },
        },
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("keeps a succeeded workflow succeeded when realtime publish fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `video-realtime-failure-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
            createGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            generationProviderCallbackSignal,
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
        createVideoTaskActivityType,
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
    const taskQueue = `video-preview-failure-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
            createGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            generationProviderCallbackSignal,
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
        createVideoTaskActivityType,
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
    const taskQueue = `video-final-cost-failure-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
              createGenerationWorkflow,
              {
                workflowId: `generation-job-${randomUUID()}`,
                taskQueue,
                args: [createWorkflowInput()],
              },
            );
            await handle.signal(
              generationProviderCallbackSignal,
              createProviderCallback({ status: "succeeded" }),
            );

            return handle.result();
          })(),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createVideoTaskActivityType,
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

  it("persists provider metadata and accrues spend when succeeded video import fails", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `video-storage-failure-${randomUUID()}`;
    const activityLog: string[] = [];
    const upsertInputs: unknown[] = [];
    const accrualInputs: unknown[] = [];
    const failedInputs: unknown[] = [];
    const providerCallback = createProviderCallback({ status: "succeeded" });

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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
          upsertGenerationResultActivity: async (input: unknown) => {
            activityLog.push(upsertGenerationResultActivityType);
            upsertInputs.push(input);

            return {};
          },
          accrueGenerationProviderCostActivity: async (input: unknown) => {
            activityLog.push(accrueGenerationProviderCostActivityType);
            accrualInputs.push(input);
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
            createGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(
            generationProviderCallbackSignal,
            providerCallback,
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
        createVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        saveGenerationMediaActivityType,
        upsertGenerationResultActivityType,
        accrueGenerationProviderCostActivityType,
        finalizeUnsuccessfulGenerationJobActivityType,
      ]);
      expect(upsertInputs).toEqual([
        {
          jobId: "job_1",
          callback: providerCallback,
        },
      ]);
      expect(accrualInputs).toEqual([
        {
          jobId: "job_1",
          callback: providerCallback,
        },
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
    providerStatus: GenerationProviderTaskStatus;
  }>)(
    "stores the result and marks the job $providerStatus when a terminal callback arrives",
    async ({ providerStatus }) => {
      const testEnv = await TestWorkflowEnvironment.createLocal();
      const taskQueue = `video-callback-${randomUUID()}`;
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
            createVideoTaskActivity: async () => {
              activityLog.push(createVideoTaskActivityType);

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
              createGenerationWorkflow,
              {
                workflowId: `generation-job-${randomUUID()}`,
                taskQueue,
                args: [createWorkflowInput()],
              },
            );
            await handle.signal(
              generationProviderCallbackSignal,
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
          createVideoTaskActivityType,
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
    const taskQueue = `video-malformed-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
            createGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          );
          await handle.signal(generationProviderCallbackSignal, {
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
        createVideoTaskActivityType,
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
    const taskQueue = `video-create-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
          testEnv.client.workflow.execute(createGenerationWorkflow, {
            workflowId: `generation-job-${randomUUID()}`,
            taskQueue,
            args: [createWorkflowInput()],
          }),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createVideoTaskActivityType,
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
    const taskQueue = `video-create-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
          testEnv.client.workflow.execute(createGenerationWorkflow, {
            workflowId: `generation-job-${randomUUID()}`,
            taskQueue,
            args: [createWorkflowInput()],
          }),
        ),
      ).rejects.toThrow("Workflow execution failed");
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
      ]);
    } finally {
      await testEnv.teardown();
    }
  }, 60_000);

  it("marks the job expired when no provider callback arrives within 24 hours", async () => {
    const testEnv = await createTimeSkippingTestEnvironment();
    const taskQueue = `video-timeout-${randomUUID()}`;
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
          createVideoTaskActivity: async () => {
            activityLog.push(createVideoTaskActivityType);

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
        testEnv.client.workflow.execute(createGenerationWorkflow, {
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
        createVideoTaskActivityType,
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

function createImageWorkflowInput(
  overrides: Partial<InlineGenerationWorkflowInput> = {},
): InlineGenerationWorkflowInput {
  return {
    jobId: "job_image_1",
    submissionId: "submission_image_1",
    modelId: "nano-banana-2",
    modelSpecId: "nano-banana-2-v1",
    providerId: "google",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "1K",
      aspectRatio: "1:1",
    },
    hasAttachmentMedia: false,
    providerExecution: {
      mode: "inline",
      outputKind: "image",
    },
    ...overrides,
  };
}

function createStoredImageActivityResult(
  overrides: Partial<CreateAndStoreImageActivityResult> = {},
): CreateAndStoreImageActivityResult {
  return {
    callback: {
      kind: "result",
      result: {
        provider: "google",
        providerTaskId: "interaction_123",
        providerModelId: "gemini-3.1-flash-image",
        status: "succeeded",
        videoUrl: null,
        usage: {
          completionTokens: null,
          inputTokens: 100,
          outputTextTokens: 20,
          outputImageTokens: 1_120,
          thoughtTokens: 10,
          totalTokens: 1_250,
        },
        createdAt: null,
        updatedAt: null,
        providerError: null,
      },
      rawPayload: {
        id: "interaction_123",
        status: "completed",
        outputImageCount: 1,
      },
      receivedAt: "2026-07-07T12:01:00.000Z",
    },
    storedAsset: {
      kind: "image",
      bucket: "remora-dev-media",
      objectKey: "generations/jobs/job_image_1/image.jpg",
      contentType: "image/jpeg",
      contentLength: 4096,
      etag: '"image-etag"',
      checksumSha256: "image-checksum",
      sourceProviderUrl: null,
    },
    storageError: null,
    ...overrides,
  };
}

function createWorkflowInput(
  overrides: Partial<CallbackGenerationWorkflowInput> = {},
): CallbackGenerationWorkflowInput {
  return {
    jobId: "job_1",
    submissionId: "submission_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    providerId: "byteplus",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    hasAttachmentMedia: false,
    providerExecution: {
      mode: "callback",
      outputKind: "video",
      callbackUrl:
        "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=secret",
    },
    ...overrides,
  };
}

function createProviderCallback(
  overrides: Partial<GenerationProviderTaskResult> = {},
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

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
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

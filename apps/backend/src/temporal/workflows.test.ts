import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

import { ApplicationFailure } from "@temporalio/common";
import { TestWorkflowEnvironment } from "@temporalio/testing";
import { Worker } from "@temporalio/worker";
import { describe, expect, it } from "vitest";

import * as activities from "./activities.ts";
import {
  createGenerationResultPreviewActivityType,
  createSeedanceVideoTaskActivityType,
  saveGenerationMediaActivityType,
  markGenerationJobCancelledActivityType,
  markGenerationJobCreatingProviderTaskActivityType,
  markGenerationJobExpiredActivityType,
  markGenerationJobFailedActivityType,
  markGenerationJobSucceededActivityType,
  markGenerationJobWaitingForProviderCallbackActivityType,
  publishGenerationJobSucceededRealtimeEventActivityType,
  seedanceVideoGenerationProviderCallbackSignal,
  upsertGenerationResultActivityType,
} from "./types.ts";
import { createSeedanceVideoGenerationWorkflow } from "./workflows.ts";
import type {
  RetrieveSeedanceVideoTaskResult,
  SeedanceProviderStatus,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";

const require = createRequire(import.meta.url);

describe("Seedance video generation workflow", () => {
  it("waits for a succeeded provider callback and stores the generation result", async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal();
    const taskQueue = `seedance-create-${randomUUID()}`;
    const activityLog: string[] = [];
    const importInputs: unknown[] = [];
    const previewInputs: unknown[] = [];
    const providerTaskInputs: unknown[] = [];
    const upsertInputs: unknown[] = [];
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
        markGenerationJobSucceededActivityType,
        publishGenerationJobSucceededRealtimeEventActivityType,
      ]);
      expect(providerTaskInputs).toEqual([
        expect.objectContaining({
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
          markGenerationJobFailedActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobFailedActivityType);
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
        markGenerationJobFailedActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
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
      expectedActivityType: markGenerationJobFailedActivityType,
    },
    {
      providerStatus: "cancelled",
      expectedActivityType: markGenerationJobCancelledActivityType,
    },
    {
      providerStatus: "expired",
      expectedActivityType: markGenerationJobExpiredActivityType,
    },
  ] satisfies Array<{
    providerStatus: SeedanceProviderStatus;
    expectedActivityType: string;
  }>)(
    "stores the result and marks the job $providerStatus when a terminal callback arrives",
    async ({ providerStatus, expectedActivityType }) => {
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
            markGenerationJobFailedActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobFailedActivityType);
              terminalInputs.push(input);

              return createJob({ status: "failed" });
            },
            markGenerationJobCancelledActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobCancelledActivityType);
              terminalInputs.push(input);

              return createJob({ status: "cancelled" });
            },
            markGenerationJobExpiredActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobExpiredActivityType);
              terminalInputs.push(input);

              return createJob({ status: "expired" });
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
          expectedActivityType,
        ]);
        expect(terminalInputs).toEqual([
          {
            jobId: "job_1",
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
          markGenerationJobFailedActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobFailedActivityType);
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
        markGenerationJobFailedActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
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
          markGenerationJobFailedActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobFailedActivityType);
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
        markGenerationJobFailedActivityType,
      ]);
      expect(failedInputs).toEqual([
        {
          jobId: "job_1",
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
          markGenerationJobFailedActivity: async () => {
            activityLog.push(markGenerationJobFailedActivityType);

            return createJob({ status: "failed" });
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
    const testEnv = await TestWorkflowEnvironment.createTimeSkipping();
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
          markGenerationJobExpiredActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobExpiredActivityType);
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
        markGenerationJobExpiredActivityType,
      ]);
      expect(expiredInputs).toEqual([
        {
          jobId: "job_1",
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

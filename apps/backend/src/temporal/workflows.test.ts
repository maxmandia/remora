import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { ApplicationFailure } from '@temporalio/common'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { describe, expect, it } from 'vitest'

import * as activities from './activities.ts'
import {
  createSeedanceVideoTaskActivityType,
  markGenerationJobCancelledActivityType,
  markGenerationJobCreatingProviderTaskActivityType,
  markGenerationJobExpiredActivityType,
  markGenerationJobFailedActivityType,
  markGenerationJobSucceededActivityType,
  markGenerationJobWaitingForProviderCallbackActivityType,
  seedanceVideoGenerationProviderCallbackSignal,
  upsertGenerationResultActivityType,
} from './types.ts'
import { createSeedanceVideoGenerationWorkflow } from './workflows.ts'
import type {
  RetrieveSeedanceVideoTaskResult,
  SeedanceProviderStatus,
} from '../modules/generation/generation.types.ts'

const require = createRequire(import.meta.url)

describe('Seedance video generation workflow', () => {
  it('waits for a succeeded provider callback and stores the generation result', async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    const taskQueue = `seedance-create-${randomUUID()}`
    const activityLog: string[] = []

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

            return createJob({ status: 'creating_provider_task' })
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType)

            return {
              provider: 'byteplus',
              providerTaskId: 'cgt-123',
              providerModelId: 'dreamina-seedance-2-0-260128',
            }
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(markGenerationJobWaitingForProviderCallbackActivityType)

            return createJob({
              status: 'waiting_for_provider_callback',
              providerTaskId: 'cgt-123',
            })
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType)

            return {}
          },
          markGenerationJobSucceededActivity: async () => {
            activityLog.push(markGenerationJobSucceededActivityType)

            return createJob({ status: 'succeeded' })
          },
        },
      })

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          )
          await handle.signal(
            seedanceVideoGenerationProviderCallbackSignal,
            createProviderCallback({ status: 'succeeded' }),
          )

          return handle.result()
        })(),
      )

      expect(result).toEqual({
        jobId: 'job_1',
        status: 'succeeded',
        providerTaskId: 'cgt-123',
      })
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        upsertGenerationResultActivityType,
        markGenerationJobSucceededActivityType,
      ])
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)

  it.each([
    {
      providerStatus: 'failed',
      expectedActivityType: markGenerationJobFailedActivityType,
    },
    {
      providerStatus: 'cancelled',
      expectedActivityType: markGenerationJobCancelledActivityType,
    },
    {
      providerStatus: 'expired',
      expectedActivityType: markGenerationJobExpiredActivityType,
    },
  ] satisfies Array<{
    providerStatus: SeedanceProviderStatus
    expectedActivityType: string
  }>)(
    'stores the result and marks the job $providerStatus when a terminal callback arrives',
    async ({ providerStatus, expectedActivityType }) => {
      const testEnv = await TestWorkflowEnvironment.createLocal()
      const taskQueue = `seedance-callback-${randomUUID()}`
      const activityLog: string[] = []
      const terminalInputs: unknown[] = []

      try {
        const worker = await Worker.create({
          connection: testEnv.nativeConnection,
          namespace: testEnv.namespace,
          taskQueue,
          workflowsPath: require.resolve('./workflows.ts'),
          activities: {
            ...activities,
            markGenerationJobCreatingProviderTaskActivity: async () => {
              activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

              return createJob({ status: 'creating_provider_task' })
            },
            createSeedanceVideoTaskActivity: async () => {
              activityLog.push(createSeedanceVideoTaskActivityType)

              return {
                provider: 'byteplus',
                providerTaskId: 'cgt-123',
                providerModelId: 'dreamina-seedance-2-0-260128',
              }
            },
            markGenerationJobWaitingForProviderCallbackActivity: async () => {
              activityLog.push(markGenerationJobWaitingForProviderCallbackActivityType)

              return createJob({ status: 'waiting_for_provider_callback' })
            },
            upsertGenerationResultActivity: async () => {
              activityLog.push(upsertGenerationResultActivityType)

              return {}
            },
            markGenerationJobFailedActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobFailedActivityType)
              terminalInputs.push(input)

              return createJob({ status: 'failed' })
            },
            markGenerationJobCancelledActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobCancelledActivityType)
              terminalInputs.push(input)

              return createJob({ status: 'cancelled' })
            },
            markGenerationJobExpiredActivity: async (input: unknown) => {
              activityLog.push(markGenerationJobExpiredActivityType)
              terminalInputs.push(input)

              return createJob({ status: 'expired' })
            },
          },
        })

        const result = await worker.runUntil(
          (async () => {
            const handle = await testEnv.client.workflow.start(
              createSeedanceVideoGenerationWorkflow,
              {
                workflowId: `generation-job-${randomUUID()}`,
                taskQueue,
                args: [createWorkflowInput()],
              },
            )
            await handle.signal(
              seedanceVideoGenerationProviderCallbackSignal,
              createProviderCallback({
                status: providerStatus,
                providerError: {
                  code: 'ProviderTaskError',
                  message: `Provider task ${providerStatus}`,
                },
              }),
            )

            return handle.result()
          })(),
        )

        expect(result).toEqual({
          jobId: 'job_1',
          status: providerStatus,
          providerTaskId: 'cgt-123',
        })
        expect(activityLog).toEqual([
          markGenerationJobCreatingProviderTaskActivityType,
          createSeedanceVideoTaskActivityType,
          markGenerationJobWaitingForProviderCallbackActivityType,
          upsertGenerationResultActivityType,
          expectedActivityType,
        ])
        expect(terminalInputs).toEqual([
          {
            jobId: 'job_1',
            terminalError: {
              source: 'provider',
              code: 'ProviderTaskError',
              message: `Provider task ${providerStatus}`,
            },
          },
        ])
      } finally {
        await testEnv.teardown()
      }
    },
    60_000,
  )

  it('marks the job failed when an authenticated malformed callback arrives', async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    const taskQueue = `seedance-malformed-${randomUUID()}`
    const activityLog: string[] = []
    const failedInputs: unknown[] = []

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

            return createJob({ status: 'creating_provider_task' })
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType)

            return {
              provider: 'byteplus',
              providerTaskId: 'cgt-123',
              providerModelId: 'dreamina-seedance-2-0-260128',
            }
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(markGenerationJobWaitingForProviderCallbackActivityType)

            return createJob({ status: 'waiting_for_provider_callback' })
          },
          upsertGenerationResultActivity: async () => {
            activityLog.push(upsertGenerationResultActivityType)

            return {}
          },
          markGenerationJobFailedActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobFailedActivityType)
            failedInputs.push(input)

            return createJob({ status: 'failed' })
          },
        },
      })

      const result = await worker.runUntil(
        (async () => {
          const handle = await testEnv.client.workflow.start(
            createSeedanceVideoGenerationWorkflow,
            {
              workflowId: `generation-job-${randomUUID()}`,
              taskQueue,
              args: [createWorkflowInput()],
            },
          )
          await handle.signal(seedanceVideoGenerationProviderCallbackSignal, {
            kind: 'malformed',
            terminalError: {
              source: 'provider',
              code: 'MALFORMED_PROVIDER_CALLBACK',
              message: 'Provider callback payload could not be parsed',
            },
            rawPayload: {
              unexpected: true,
            },
            receivedAt: '2026-06-05T00:00:00.000Z',
          })

          return handle.result()
        })(),
      )

      expect(result).toEqual({
        jobId: 'job_1',
        status: 'failed',
        providerTaskId: 'cgt-123',
      })
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        markGenerationJobFailedActivityType,
      ])
      expect(failedInputs).toEqual([
        {
          jobId: 'job_1',
          terminalError: {
            source: 'provider',
            code: 'MALFORMED_PROVIDER_CALLBACK',
            message: 'Provider callback payload could not be parsed',
          },
        },
      ])
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)

  it('marks the job failed when provider task creation fails', async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    const taskQueue = `seedance-create-${randomUUID()}`
    const activityLog: string[] = []
    const failedInputs: unknown[] = []

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

            return createJob({ status: 'creating_provider_task' })
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType)

            throw new Error('BytePlus request failed')
          },
          markGenerationJobFailedActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobFailedActivityType)
            failedInputs.push(input)

            return createJob({
              status: 'failed',
              terminalError: {
                source: 'provider',
                code: 'Error',
                message: 'BytePlus request failed',
              },
            })
          },
        },
      })

      await expect(
        worker.runUntil(
          testEnv.client.workflow.execute(createSeedanceVideoGenerationWorkflow, {
            workflowId: `generation-job-${randomUUID()}`,
            taskQueue,
            args: [createWorkflowInput()],
          }),
        ),
      ).rejects.toThrow('Workflow execution failed')
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobFailedActivityType,
      ])
      expect(failedInputs).toEqual([
        {
          jobId: 'job_1',
          terminalError: {
            source: 'provider',
            code: 'Error',
            message: 'BytePlus request failed',
          },
        },
      ])
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)

  it('does not mark the job failed when storing a created provider task fails', async () => {
    const testEnv = await TestWorkflowEnvironment.createLocal()
    const taskQueue = `seedance-create-${randomUUID()}`
    const activityLog: string[] = []

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

            return createJob({ status: 'creating_provider_task' })
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType)

            return {
              provider: 'byteplus',
              providerTaskId: 'cgt-123',
              providerModelId: 'dreamina-seedance-2-0-260128',
            }
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(markGenerationJobWaitingForProviderCallbackActivityType)

            throw ApplicationFailure.nonRetryable(
              'Database update failed',
              'PersistenceFailure',
            )
          },
          markGenerationJobFailedActivity: async () => {
            activityLog.push(markGenerationJobFailedActivityType)

            return createJob({ status: 'failed' })
          },
        },
      })

      await expect(
        worker.runUntil(
          testEnv.client.workflow.execute(createSeedanceVideoGenerationWorkflow, {
            workflowId: `generation-job-${randomUUID()}`,
            taskQueue,
            args: [createWorkflowInput()],
          }),
        ),
      ).rejects.toThrow('Workflow execution failed')
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
      ])
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)

  it('marks the job expired when no provider callback arrives within 24 hours', async () => {
    const testEnv = await TestWorkflowEnvironment.createTimeSkipping()
    const taskQueue = `seedance-timeout-${randomUUID()}`
    const activityLog: string[] = []
    const expiredInputs: unknown[] = []

    try {
      const worker = await Worker.create({
        connection: testEnv.nativeConnection,
        namespace: testEnv.namespace,
        taskQueue,
        workflowsPath: require.resolve('./workflows.ts'),
        activities: {
          ...activities,
          markGenerationJobCreatingProviderTaskActivity: async () => {
            activityLog.push(markGenerationJobCreatingProviderTaskActivityType)

            return createJob({ status: 'creating_provider_task' })
          },
          createSeedanceVideoTaskActivity: async () => {
            activityLog.push(createSeedanceVideoTaskActivityType)

            return {
              provider: 'byteplus',
              providerTaskId: 'cgt-123',
              providerModelId: 'dreamina-seedance-2-0-260128',
            }
          },
          markGenerationJobWaitingForProviderCallbackActivity: async () => {
            activityLog.push(markGenerationJobWaitingForProviderCallbackActivityType)

            return createJob({ status: 'waiting_for_provider_callback' })
          },
          markGenerationJobExpiredActivity: async (input: unknown) => {
            activityLog.push(markGenerationJobExpiredActivityType)
            expiredInputs.push(input)

            return createJob({ status: 'expired' })
          },
        },
      })

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createSeedanceVideoGenerationWorkflow, {
          workflowId: `generation-job-${randomUUID()}`,
          taskQueue,
          args: [createWorkflowInput()],
        }),
      )

      expect(result).toEqual({
        jobId: 'job_1',
        status: 'expired',
        providerTaskId: 'cgt-123',
      })
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobWaitingForProviderCallbackActivityType,
        markGenerationJobExpiredActivityType,
      ])
      expect(expiredInputs).toEqual([
        {
          jobId: 'job_1',
          terminalError: {
            source: 'internal',
            code: 'PROVIDER_CALLBACK_TIMEOUT',
            message: 'Provider callback was not received within 24 hours',
          },
        },
      ])
    } finally {
      await testEnv.teardown()
    }
  }, 60_000)
})

function createWorkflowInput() {
  return {
    jobId: 'job_1',
    prompt: 'A quiet ocean studio',
    aspectRatio: '16:9',
    duration: 5,
    generateAudio: true,
    callbackUrl: 'https://api.example.test/api/generation-callbacks/byteplus/job_1?token=secret',
  }
}

function createProviderCallback(
  overrides: Partial<RetrieveSeedanceVideoTaskResult> = {},
) {
  const result = {
    provider: 'byteplus' as const,
    providerTaskId: 'cgt-123',
    providerModelId: 'dreamina-seedance-2-0-260128',
    status: 'succeeded' as const,
    videoUrl: 'https://assets.example/video.mp4',
    lastFrameUrl: null,
    usage: null,
    createdAt: 1780770000,
    updatedAt: 1780770060,
    providerError: null,
    ...overrides,
  }

  return {
    kind: 'result' as const,
    result,
    rawPayload: {
      id: result.providerTaskId,
      status: result.status,
      content: {
        video_url: result.videoUrl,
      },
    },
    receivedAt: '2026-06-05T00:00:00.000Z',
  }
}

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job_1',
    userId: 'user_1',
    modelId: 'seedance-2.0-video',
    modelSpecId: 'seedance-2.0-video-v1',
    status: 'queued',
    submittedInput: {
      prompt: 'A quiet ocean studio',
      aspectRatio: '16:9',
      duration: 5,
      generateAudio: true,
    },
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: 'callback-token-hash',
    providerId: 'byteplus',
    providerTaskId: null,
    providerModelId: 'dreamina-seedance-2-0-260128',
    terminalError: null,
    createdAt: new Date('2026-06-05T00:00:00.000Z'),
    updatedAt: new Date('2026-06-05T00:00:00.000Z'),
    ...overrides,
  }
}

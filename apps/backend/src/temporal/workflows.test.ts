import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'

import { ApplicationFailure } from '@temporalio/common'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { describe, expect, it } from 'vitest'

import * as activities from './activities.ts'
import {
  createSeedanceVideoTaskActivityType,
  markGenerationJobCreatingProviderTaskActivityType,
  markGenerationJobFailedActivityType,
  markGenerationJobProviderTaskCreatedActivityType,
} from './types.ts'
import { createSeedanceVideoGenerationWorkflow } from './workflows.ts'

const require = createRequire(import.meta.url)

describe('Seedance video generation workflow', () => {
  it('creates a provider task and stores the provider task id', async () => {
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
          markGenerationJobProviderTaskCreatedActivity: async () => {
            activityLog.push(markGenerationJobProviderTaskCreatedActivityType)

            return createJob({
              status: 'provider_task_created',
              providerTaskId: 'cgt-123',
            })
          },
        },
      })

      const result = await worker.runUntil(
        testEnv.client.workflow.execute(createSeedanceVideoGenerationWorkflow, {
          workflowId: `generation-job-${randomUUID()}`,
          taskQueue,
          args: [
            {
              jobId: 'job_1',
              prompt: 'A quiet ocean studio',
              aspectRatio: '16:9',
              duration: 5,
              generateAudio: true,
            },
          ],
        }),
      )

      expect(result).toEqual({
        jobId: 'job_1',
        status: 'provider_task_created',
        providerTaskId: 'cgt-123',
      })
      expect(activityLog).toEqual([
        markGenerationJobCreatingProviderTaskActivityType,
        createSeedanceVideoTaskActivityType,
        markGenerationJobProviderTaskCreatedActivityType,
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
          markGenerationJobProviderTaskCreatedActivity: async () => {
            activityLog.push(markGenerationJobProviderTaskCreatedActivityType)

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
        markGenerationJobProviderTaskCreatedActivityType,
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
    providerId: 'byteplus',
    providerTaskId: null,
    providerModelId: 'dreamina-seedance-2-0-260128',
    terminalError: null,
    createdAt: new Date('2026-06-05T00:00:00.000Z'),
    updatedAt: new Date('2026-06-05T00:00:00.000Z'),
    ...overrides,
  }
}

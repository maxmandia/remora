import { proxyActivities, workflowInfo } from '@temporalio/workflow'

import {
  type CreateSeedanceVideoGenerationWorkflowInput,
  type CreateSeedanceVideoGenerationWorkflowResult,
} from './types.ts'

import type * as activities from './activities.ts'

const {
  markGenerationJobCreatingProviderTaskActivity,
  markGenerationJobProviderTaskCreatedActivity,
  markGenerationJobFailedActivity,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '10 seconds',
  retry: {
    maximumAttempts: 5,
  },
})

const { createSeedanceVideoTaskActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 1,
  },
})

export async function createSeedanceVideoGenerationWorkflow(
  input: CreateSeedanceVideoGenerationWorkflowInput,
): Promise<CreateSeedanceVideoGenerationWorkflowResult> {
  const info = workflowInfo()

  await markGenerationJobCreatingProviderTaskActivity({
    jobId: input.jobId,
    workflowId: info.workflowId,
    runId: info.runId,
  })

  let providerTask

  try {
    providerTask = await createSeedanceVideoTaskActivity({
      prompt: input.prompt,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
    })
  } catch (error) {
    await markGenerationJobFailedActivity({
      jobId: input.jobId,
      terminalError: serializeProviderError(error),
    })

    throw error
  }

  await markGenerationJobProviderTaskCreatedActivity({
    jobId: input.jobId,
    providerId: providerTask.provider,
    providerTaskId: providerTask.providerTaskId,
    providerModelId: providerTask.providerModelId,
  })

  return {
    jobId: input.jobId,
    status: 'provider_task_created',
    providerTaskId: providerTask.providerTaskId,
  }
}

function serializeProviderError(error: unknown) {
  const providerError = findProviderErrorDetails(error)

  return {
    source: 'provider' as const,
    code: providerError.code,
    message: providerError.message,
  }
}

function findProviderErrorDetails(error: unknown): {
  code: string | null
  message: string | null
} {
  const visited = new Set<unknown>()
  let current = error

  while (current && !visited.has(current)) {
    visited.add(current)

    const code =
      readStringProperty(current, 'code') ?? readStringProperty(current, 'type')
    const providerMessage = readStringProperty(current, 'providerMessage')
    const message = providerMessage ?? readStringProperty(current, 'message')

    if (code || providerMessage) {
      return {
        code,
        message,
      }
    }

    current = readUnknownProperty(current, 'cause')
  }

  if (error instanceof Error) {
    return {
      code: error.name,
      message: error.message,
    }
  }

  return {
    code: null,
    message: typeof error === 'string' ? error : 'Unknown provider task error',
  }
}

function readStringProperty(value: unknown, key: string) {
  const property = readUnknownProperty(value, key)

  return typeof property === 'string' ? property : null
}

function readUnknownProperty(value: unknown, key: string) {
  if (!value || typeof value !== 'object' || !(key in value)) {
    return undefined
  }

  return (value as Record<string, unknown>)[key]
}

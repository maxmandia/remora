import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generationRouter } from './generation.router.ts'
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from './generation.types.ts'

import type { TRPCContext } from '../../trpc/context.ts'

const mocks = vi.hoisted(() => ({
  createVideoGenerationJob: vi.fn(),
  markGenerationJobWorkflowStartFailed: vi.fn(),
  startSeedanceVideoGenerationWorkflow: vi.fn(),
}))

vi.mock('./generation.service.ts', () => ({
  generationService: {
    createVideoGenerationJob: mocks.createVideoGenerationJob,
  },
}))

vi.mock('./generation.repository.ts', () => ({
  generationRepository: {
    markGenerationJobWorkflowStartFailed:
      mocks.markGenerationJobWorkflowStartFailed,
  },
}))

vi.mock('../../temporal/client.ts', () => ({
  startSeedanceVideoGenerationWorkflow: mocks.startSeedanceVideoGenerationWorkflow,
}))

describe('generation router', () => {
  beforeEach(() => {
    mocks.createVideoGenerationJob.mockReset()
    mocks.markGenerationJobWorkflowStartFailed.mockReset()
    mocks.startSeedanceVideoGenerationWorkflow.mockReset()
    mocks.createVideoGenerationJob.mockResolvedValue({
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
    })
    mocks.startSeedanceVideoGenerationWorkflow.mockResolvedValue({
      workflowId: 'generation-job:job_1',
      runId: 'run_1',
    })
  })

  it('validates createVideo input', async () => {
    const caller = generationRouter.createCaller(createSignedInContext())

    await expect(
      caller.createVideo({
        modelId: 'seedance-2.0-video',
        prompt: '',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    })
    expect(mocks.createVideoGenerationJob).not.toHaveBeenCalled()
  })

  it('rejects unsupported models with a typed error code', async () => {
    mocks.createVideoGenerationJob.mockRejectedValueOnce(
      new UnsupportedGenerationModelError('kling-2.1-video'),
    )
    const caller = generationRouter.createCaller(createSignedInContext())

    await expect(
      caller.createVideo({
        modelId: 'kling-2.1-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'UNSUPPORTED_MODEL',
    })
    expect(mocks.createVideoGenerationJob).toHaveBeenCalledWith({
      userId: 'user_1',
      input: {
        modelId: 'kling-2.1-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      },
    })
  })

  it('maps spec validation failures to a typed error code', async () => {
    mocks.createVideoGenerationJob.mockRejectedValueOnce(
      new GenerationInputValidationError(
        'aspectRatio',
        'aspectRatio must match a supported model option',
      ),
    )
    const caller = generationRouter.createCaller(createSignedInContext())

    await expect(
      caller.createVideo({
        modelId: 'seedance-2.0-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '2:1',
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'INVALID_GENERATION_INPUT',
    })
  })

  it('creates a local job and starts the Seedance workflow', async () => {
    const caller = generationRouter.createCaller(createSignedInContext())

    await expect(
      caller.createVideo({
        modelId: 'seedance-2.0-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      }),
    ).resolves.toEqual({
      jobId: 'job_1',
      workflowId: 'generation-job:job_1',
      status: 'queued',
    })
    expect(mocks.createVideoGenerationJob).toHaveBeenCalledWith({
      userId: 'user_1',
      input: {
        modelId: 'seedance-2.0-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      },
    })
    expect(mocks.startSeedanceVideoGenerationWorkflow).toHaveBeenCalledWith({
      jobId: 'job_1',
      prompt: 'A quiet ocean studio',
      aspectRatio: '16:9',
      duration: 5,
      generateAudio: true,
    })
  })

  it('marks the local job failed when workflow start fails', async () => {
    const workflowError = new Error('Temporal is unavailable')
    mocks.startSeedanceVideoGenerationWorkflow.mockRejectedValueOnce(workflowError)
    const caller = generationRouter.createCaller(createSignedInContext())

    await expect(
      caller.createVideo({
        modelId: 'seedance-2.0-video',
        prompt: 'A quiet ocean studio',
        aspectRatio: '16:9',
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Temporal is unavailable',
    })
    expect(mocks.createVideoGenerationJob).toHaveBeenCalled()
    expect(mocks.markGenerationJobWorkflowStartFailed).toHaveBeenCalledWith({
      jobId: 'job_1',
      terminalError: {
        source: 'internal',
        code: 'WORKFLOW_START_FAILED',
        message: 'Temporal is unavailable',
      },
    })
  })
})

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: 'session_1',
    },
    user: {
      id: 'user_1',
      name: 'User',
      email: 'user@example.test',
      emailVerified: true,
      image: null,
      createdAt: '2026-06-05T00:00:00.000Z',
      updatedAt: '2026-06-05T00:00:00.000Z',
    },
  } as unknown as TRPCContext
}

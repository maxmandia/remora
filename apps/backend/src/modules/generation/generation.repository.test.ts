import { beforeEach, describe, expect, it, vi } from 'vitest'

import { generationRepository } from './generation.repository.ts'

import type { VideoModelSpec } from '../model/types.ts'

const mocks = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertRows: [] as unknown[],
  updateRows: [] as unknown[],
  insertValues: vi.fn(),
  updateSet: vi.fn(),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}))

vi.mock('node:crypto', () => ({
  randomUUID: () => 'job_1',
}))

vi.mock('drizzle-orm', () => ({
  and: mocks.and,
  desc: mocks.desc,
  eq: mocks.eq,
}))

vi.mock('../../db/client.ts', () => ({
  db: {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    generationJob: {
      id: 'generation_job.id',
      userId: 'generation_job.user_id',
      modelId: 'generation_job.model_id',
      modelSpecId: 'generation_job.model_spec_id',
      status: 'generation_job.status',
    },
    generationModel: {
      id: 'generation_model.id',
      providerId: 'generation_model.provider_id',
      status: 'generation_model.status',
    },
    generationModelSpec: {
      id: 'generation_model_spec.id',
      modelId: 'generation_model_spec.model_id',
      spec: 'generation_model_spec.spec',
      status: 'generation_model_spec.status',
      version: 'generation_model_spec.version',
    },
  },
}))

describe('generation repository', () => {
  beforeEach(() => {
    mocks.selectRows = [
      {
        id: 'seedance-2.0-video-v1',
        modelId: 'seedance-2.0-video',
        providerId: 'byteplus',
        spec: {
          providerModelId: 'dreamina-seedance-2-0-260128',
        },
      },
    ]
    mocks.insertRows = [createJob({ status: 'queued' })]
    mocks.updateRows = [createJob({ status: 'creating_provider_task' })]
    mocks.insertValues.mockClear()
    mocks.updateSet.mockClear()
  })

  it('loads the latest published model spec', async () => {
    await expect(
      generationRepository.getLatestPublishedGenerationModelSpec('seedance-2.0-video'),
    ).resolves.toEqual({
      id: 'seedance-2.0-video-v1',
      modelId: 'seedance-2.0-video',
      providerId: 'byteplus',
      spec: {
        providerModelId: 'dreamina-seedance-2-0-260128',
      },
    })
  })

  it('creates queued generation jobs', async () => {
    await expect(
      generationRepository.insertGenerationJob({
        userId: 'user_1',
        input: {
          modelId: 'seedance-2.0-video',
          prompt: 'A quiet ocean studio',
          aspectRatio: '16:9',
          duration: 5,
          generateAudio: true,
        },
        modelSpec: {
          id: 'seedance-2.0-video-v1',
          modelId: 'seedance-2.0-video',
          providerId: 'byteplus',
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: 'A quiet ocean studio',
          aspectRatio: '16:9',
          duration: 5,
          generateAudio: true,
        },
      }),
    ).resolves.toMatchObject({
      id: 'job_1',
      status: 'queued',
    })

    expect(mocks.insertValues).toHaveBeenCalledWith({
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
      providerId: 'byteplus',
      providerModelId: 'dreamina-seedance-2-0-260128',
    })
  })

  it('updates jobs while creating provider tasks', async () => {
    mocks.updateRows = [
      createJob({
        status: 'creating_provider_task',
        temporalWorkflowId: 'generation-job:job_1',
        temporalRunId: 'run_1',
      }),
    ]

    await expect(
      generationRepository.markGenerationJobCreatingProviderTask({
        jobId: 'job_1',
        workflowId: 'generation-job:job_1',
        runId: 'run_1',
      }),
    ).resolves.toMatchObject({
      status: 'creating_provider_task',
      temporalWorkflowId: 'generation-job:job_1',
      temporalRunId: 'run_1',
    })

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'creating_provider_task',
        temporalWorkflowId: 'generation-job:job_1',
        temporalRunId: 'run_1',
        terminalError: null,
      }),
    )
  })

  it('stores provider task creation results', async () => {
    mocks.updateRows = [
      createJob({
        status: 'provider_task_created',
        providerId: 'byteplus',
        providerTaskId: 'cgt-123',
        providerModelId: 'dreamina-seedance-2-0-260128',
      }),
    ]

    await expect(
      generationRepository.markGenerationJobProviderTaskCreated({
        jobId: 'job_1',
        providerId: 'byteplus',
        providerTaskId: 'cgt-123',
        providerModelId: 'dreamina-seedance-2-0-260128',
      }),
    ).resolves.toMatchObject({
      status: 'provider_task_created',
      providerTaskId: 'cgt-123',
    })

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'provider_task_created',
        providerId: 'byteplus',
        providerTaskId: 'cgt-123',
        providerModelId: 'dreamina-seedance-2-0-260128',
        terminalError: null,
      }),
    )
  })

  it('stores failure errors when jobs fail', async () => {
    mocks.updateRows = [
      createJob({
        status: 'failed',
        terminalError: {
          source: 'provider',
          code: 'ProviderHttpError',
          message: 'BytePlus request failed',
        },
      }),
    ]

    await expect(
      generationRepository.markGenerationJobFailed({
        jobId: 'job_1',
        terminalError: {
          source: 'provider',
          code: 'ProviderHttpError',
          message: 'BytePlus request failed',
        },
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      terminalError: {
        source: 'provider',
        code: 'ProviderHttpError',
        message: 'BytePlus request failed',
      },
    })
  })

  it('stores workflow start failures without clearing provider task fields', async () => {
    mocks.updateRows = [
      createJob({
        status: 'failed',
        terminalError: {
          source: 'internal',
          code: 'WORKFLOW_START_FAILED',
          message: 'Temporal is unavailable',
        },
      }),
    ]

    await expect(
      generationRepository.markGenerationJobWorkflowStartFailed({
        jobId: 'job_1',
        terminalError: {
          source: 'internal',
          code: 'WORKFLOW_START_FAILED',
          message: 'Temporal is unavailable',
        },
      }),
    ).resolves.toMatchObject({
      status: 'failed',
      terminalError: {
        source: 'internal',
        code: 'WORKFLOW_START_FAILED',
        message: 'Temporal is unavailable',
      },
    })

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        terminalError: {
          source: 'internal',
          code: 'WORKFLOW_START_FAILED',
          message: 'Temporal is unavailable',
        },
      }),
    )
    expect(mocks.updateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({
        providerTaskId: expect.anything(),
      }),
    )
  })
})

function createSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => mocks.selectRows),
  }

  return chain
}

function createInsertChain() {
  return {
    values: vi.fn((values: unknown) => {
      mocks.insertValues(values)

      return {
        returning: vi.fn(async () => mocks.insertRows),
      }
    }),
  }
}

function createUpdateChain() {
  const chain = {
    set: vi.fn((values: unknown) => {
      mocks.updateSet(values)

      return chain
    }),
    where: vi.fn(() => chain),
    returning: vi.fn(async () => mocks.updateRows),
  }

  return chain
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

function createModelSpec(): VideoModelSpec {
  return {
    schemaVersion: 1,
    id: 'seedance-2.0-video',
    provider: 'byteplus',
    providerModelId: 'dreamina-seedance-2-0-260128',
    displayName: 'Seedance 2.0',
    type: 'video',
    status: 'published',
    sourceUrls: [],
    endpoint: {
      method: 'POST',
      path: '/contents/generations/tasks',
    },
    modelParameter: {
      path: ['model'],
      source: 'spec',
    },
    fields: [
      {
        id: 'prompt',
        label: 'Prompt',
        componentKind: 'promptTextarea',
        valueKind: 'string',
        required: false,
        advanced: false,
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
    ],
    groups: [
      {
        id: 'output',
        label: 'Output',
        fieldIds: ['prompt'],
        advanced: false,
      },
    ],
    transforms: [{ kind: 'seedanceContentArray' }],
    validationRules: ['seedance20ContentRules'],
  }
}

import { randomUUID } from 'node:crypto'

import { and, desc, eq } from 'drizzle-orm'

import { db, schema } from '../../db/client.ts'

import type { VideoModelSpec } from '../model/types.ts'
import type {
  CreateVideoGenerationInput,
  GenerationJobTerminalError,
  GenerationJobRecord,
  GenerationJobSubmittedInput,
} from './generation.types.ts'

export type PublishedGenerationModelSpec = {
  id: string
  modelId: string
  providerId: string
  spec: VideoModelSpec
}

export class GenerationRepository {
  async getLatestPublishedGenerationModelSpec(
    modelId: string,
  ): Promise<PublishedGenerationModelSpec | null> {
    const [row] = await db
      .select({
        id: schema.generationModelSpec.id,
        modelId: schema.generationModel.id,
        providerId: schema.generationModel.providerId,
        spec: schema.generationModelSpec.spec,
      })
      .from(schema.generationModelSpec)
      .innerJoin(
        schema.generationModel,
        eq(schema.generationModel.id, schema.generationModelSpec.modelId),
      )
      .where(
        and(
          eq(schema.generationModel.id, modelId),
          eq(schema.generationModel.status, 'published'),
          eq(schema.generationModelSpec.status, 'published'),
        ),
      )
      .orderBy(desc(schema.generationModelSpec.version))
      .limit(1)

    if (!row) {
      return null
    }

    return {
      id: row.id,
      modelId: row.modelId,
      providerId: row.providerId,
      spec: row.spec as VideoModelSpec,
    }
  }

  async insertGenerationJob({
    userId,
    input,
    modelSpec,
    submittedInput,
  }: {
    userId: string
    input: CreateVideoGenerationInput
    modelSpec: PublishedGenerationModelSpec
    submittedInput: GenerationJobSubmittedInput
  }): Promise<GenerationJobRecord> {
    const [job] = await db
      .insert(schema.generationJob)
      .values({
        id: randomUUID(),
        userId,
        modelId: input.modelId,
        modelSpecId: modelSpec.id,
        status: 'queued',
        submittedInput,
        providerId: modelSpec.providerId,
        providerModelId: modelSpec.spec.providerModelId,
      })
      .returning()

    if (!job) {
      throw new Error('Generation job was not created')
    }

    return job
  }

  async markGenerationJobCreatingProviderTask({
    jobId,
    workflowId,
    runId,
  }: {
    jobId: string
    workflowId: string
    runId: string
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: 'creating_provider_task',
      temporalWorkflowId: workflowId,
      temporalRunId: runId,
      terminalError: null,
    })
  }

  async markGenerationJobProviderTaskCreated({
    jobId,
    providerId,
    providerTaskId,
    providerModelId,
  }: {
    jobId: string
    providerId: string
    providerTaskId: string
    providerModelId: string
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: 'provider_task_created',
      providerId,
      providerTaskId,
      providerModelId,
      terminalError: null,
    })
  }

  async markGenerationJobFailed({
    jobId,
    terminalError,
  }: {
    jobId: string
    terminalError: GenerationJobTerminalError
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: 'failed',
      terminalError,
    })
  }

  async markGenerationJobWorkflowStartFailed({
    jobId,
    terminalError,
  }: {
    jobId: string
    terminalError: GenerationJobTerminalError
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: 'failed',
      terminalError,
    })
  }

  private async updateGenerationJob(
    jobId: string,
    values: Partial<typeof schema.generationJob.$inferInsert>,
  ): Promise<GenerationJobRecord> {
    const [job] = await db
      .update(schema.generationJob)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(schema.generationJob.id, jobId))
      .returning()

    if (!job) {
      throw new Error(`Generation job was not found: ${jobId}`)
    }

    return job
  }
}

export const generationRepository = new GenerationRepository()

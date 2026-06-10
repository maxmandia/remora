import { randomBytes, randomUUID } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import { db, schema } from "../../db/client.ts";

import type { VideoModelSpec } from "../model/types.ts";
import type {
  CreateVideoGenerationInput,
  GenerationJobRecord,
  GenerationJobSubmittedInput,
  GenerationJobTerminalError,
  GenerationThreadSummary,
  RetrieveSeedanceVideoTaskResult,
} from "./generation.types.ts";
import { GenerationThreadNotFoundError } from "./generation.types.ts";

export type PublishedGenerationModelSpec = {
  id: string;
  modelId: string;
  providerId: string;
  spec: VideoModelSpec;
};

export class GenerationRepository {
  async listGenerationThreadsForUser(
    userId: string,
  ): Promise<GenerationThreadSummary[]> {
    const rows = await db
      .select({
        id: schema.generationThread.id,
        name: schema.generationThread.name,
        createdAt: schema.generationThread.createdAt,
        updatedAt: schema.generationThread.updatedAt,
      })
      .from(schema.generationThread)
      .where(eq(schema.generationThread.userId, userId))
      .orderBy(desc(schema.generationThread.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

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
          eq(schema.generationModel.status, "published"),
          eq(schema.generationModelSpec.status, "published"),
        ),
      )
      .orderBy(desc(schema.generationModelSpec.version))
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      modelId: row.modelId,
      providerId: row.providerId,
      spec: row.spec as VideoModelSpec,
    };
  }

  async getPublishedGenerationModelSpecById({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId: string;
  }): Promise<PublishedGenerationModelSpec | null> {
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
          eq(schema.generationModel.status, "published"),
          eq(schema.generationModelSpec.id, modelSpecId),
          eq(schema.generationModelSpec.status, "published"),
        ),
      )
      .limit(1);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      modelId: row.modelId,
      providerId: row.providerId,
      spec: row.spec,
    };
  }

  async insertGenerationJob({
    userId,
    input,
    modelSpec,
    submittedInput,
    callbackTokenHash,
  }: {
    userId: string;
    input: CreateVideoGenerationInput;
    modelSpec: PublishedGenerationModelSpec;
    submittedInput: GenerationJobSubmittedInput;
    callbackTokenHash: string;
  }): Promise<GenerationJobRecord> {
    return db.transaction(async (tx) => {
      const threadId = input.threadId ?? randomUUID();

      if (input.threadId) {
        const [thread] = await tx
          .update(schema.generationThread)
          .set({ updatedAt: new Date() })
          .where(
            and(
              eq(schema.generationThread.id, input.threadId),
              eq(schema.generationThread.userId, userId),
            ),
          )
          .returning({ id: schema.generationThread.id });

        if (!thread) {
          throw new GenerationThreadNotFoundError(input.threadId);
        }
      } else {
        await tx.insert(schema.generationThread).values({
          id: threadId,
          userId,
          name: `Thread ${randomBytes(4).toString("hex")}`,
        });
      }

      const [job] = await tx
        .insert(schema.generationJob)
        .values({
          id: randomUUID(),
          threadId,
          userId,
          modelId: input.modelId,
          modelSpecId: modelSpec.id,
          status: "queued",
          submittedInput,
          callbackTokenHash,
          providerId: modelSpec.providerId,
          providerModelId: modelSpec.spec.providerModelId,
        })
        .returning();

      if (!job) {
        throw new Error("Generation job was not created");
      }

      return job;
    });
  }

  async getGenerationJobById(
    jobId: string,
  ): Promise<GenerationJobRecord | null> {
    const [job] = await db
      .select()
      .from(schema.generationJob)
      .where(eq(schema.generationJob.id, jobId))
      .limit(1);

    return job ?? null;
  }

  async markGenerationJobCreatingProviderTask({
    jobId,
    workflowId,
    runId,
  }: {
    jobId: string;
    workflowId: string;
    runId: string;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "creating_provider_task",
      temporalWorkflowId: workflowId,
      temporalRunId: runId,
      terminalError: null,
    });
  }

  async markGenerationJobProviderTaskCreated({
    jobId,
    providerId,
    providerTaskId,
    providerModelId,
  }: {
    jobId: string;
    providerId: string;
    providerTaskId: string;
    providerModelId: string;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "provider_task_created",
      providerId,
      providerTaskId,
      providerModelId,
      terminalError: null,
    });
  }

  async markGenerationJobWaitingForProviderCallback({
    jobId,
    providerId,
    providerTaskId,
    providerModelId,
  }: {
    jobId: string;
    providerId: string;
    providerTaskId: string;
    providerModelId: string;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "waiting_for_provider_callback",
      providerId,
      providerTaskId,
      providerModelId,
      terminalError: null,
    });
  }

  async upsertGenerationResult({
    jobId,
    result,
    rawPayload,
    receivedAt,
  }: {
    jobId: string;
    result: RetrieveSeedanceVideoTaskResult;
    rawPayload: unknown;
    receivedAt: Date;
  }) {
    const values = {
      id: randomUUID(),
      jobId,
      providerId: result.provider,
      providerTaskId: result.providerTaskId,
      providerModelId: result.providerModelId,
      providerStatus: result.status,
      videoUrl: result.videoUrl,
      lastFrameUrl: result.lastFrameUrl,
      usage: result.usage,
      providerError: result.providerError,
      rawPayload,
      receivedAt,
    };

    const [generationResult] = await db
      .insert(schema.generationResult)
      .values(values)
      .onConflictDoUpdate({
        target: schema.generationResult.jobId,
        set: {
          providerId: values.providerId,
          providerTaskId: values.providerTaskId,
          providerModelId: values.providerModelId,
          providerStatus: values.providerStatus,
          videoUrl: values.videoUrl,
          lastFrameUrl: values.lastFrameUrl,
          usage: values.usage,
          providerError: values.providerError,
          rawPayload: values.rawPayload,
          receivedAt: values.receivedAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!generationResult) {
      throw new Error(`Generation result was not stored for job: ${jobId}`);
    }

    return generationResult;
  }

  async markGenerationJobSucceeded({
    jobId,
  }: {
    jobId: string;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "succeeded",
      terminalError: null,
    });
  }

  async markGenerationJobCancelled({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError | null;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "cancelled",
      terminalError,
    });
  }

  async markGenerationJobExpired({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError | null;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "expired",
      terminalError,
    });
  }

  async markGenerationJobFailed({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "failed",
      terminalError,
    });
  }

  async markGenerationJobWorkflowStartFailed({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "failed",
      terminalError,
    });
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
      .returning();

    if (!job) {
      throw new Error(`Generation job was not found: ${jobId}`);
    }

    return job;
  }
}

export const generationRepository = new GenerationRepository();

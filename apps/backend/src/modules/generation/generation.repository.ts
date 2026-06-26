import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { randomBytes, randomUUID } from "node:crypto";
import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import {
  GenerationAttachmentMediaRepository,
  generationAttachmentMediaRepository,
} from "../generation-attachment-media/generation-attachment-media.repository.ts";
import type { StoredGenerationAttachmentMediaWithPosition } from "../generation-attachment-media/generation-attachment-media.types.ts";
import {
  createEmptyGenerationThreadAttachmentMediaValue,
  toThreadAttachmentMediaValue,
} from "../generation-attachment-media/generation-attachment-media.utils.ts";
import type { VideoModelSpec } from "../model/model.types.ts";
import { parsePersistedVideoModelSpec } from "../model/model.utils.ts";
import type {
  CreateVideoGenerationInput,
  GenerationJobRecord,
  GenerationJobTerminalError,
  GenerationJobWithSubmissionContext,
  GenerationSubmissionInput,
  GenerationSubmissionRecord,
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  GenerationThreadSummary,
  RetrieveSeedanceVideoTaskResult,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "./generation.types.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
} from "./generation.types.ts";

export type PublishedGenerationModelSpec = {
  id: string;
  modelId: string;
  providerId: string;
  spec: VideoModelSpec;
};

export class GenerationRepository {
  constructor(
    private readonly executor: DatabaseExecutor = db,
    private readonly attachmentMediaRepository: GenerationAttachmentMediaRepository = generationAttachmentMediaRepository,
  ) {}

  async listThreadsWithoutProjectForUser(
    userId: string,
  ): Promise<GenerationThreadSummary[]> {
    const rows = await this.executor
      .select({
        id: schema.generationThread.id,
        name: schema.generationThread.name,
        createdAt: schema.generationThread.createdAt,
        updatedAt: schema.generationThread.updatedAt,
      })
      .from(schema.generationThread)
      .where(
        and(
          eq(schema.generationThread.userId, userId),
          isNull(schema.generationThread.projectId),
        ),
      )
      .orderBy(desc(schema.generationThread.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async listSubmissionsFromThread({
    userId,
    threadId,
  }: {
    userId: string;
    threadId: string;
  }): Promise<GenerationThreadSubmission[]> {
    const rows = await this.executor
      .select({
        submissionId: schema.generationSubmission.id,
        submissionThreadId: schema.generationSubmission.threadId,
        submissionUserId: schema.generationSubmission.userId,
        submissionModelId: schema.generationSubmission.modelId,
        submissionModelSpecId: schema.generationSubmission.modelSpecId,
        submissionSubmittedInput: schema.generationSubmission.submittedInput,
        submissionRequestedGenerations:
          schema.generationSubmission.requestedGenerations,
        submissionCreatedAt: schema.generationSubmission.createdAt,
        submissionUpdatedAt: schema.generationSubmission.updatedAt,
        jobId: schema.generationJob.id,
        jobSubmissionId: schema.generationJob.submissionId,
        jobSubmissionIndex: schema.generationJob.submissionIndex,
        jobStatus: schema.generationJob.status,
        providerId: schema.generationJob.providerId,
        providerTaskId: schema.generationJob.providerTaskId,
        providerModelId: schema.generationJob.providerModelId,
        terminalError: schema.generationJob.terminalError,
        jobCreatedAt: schema.generationJob.createdAt,
        jobUpdatedAt: schema.generationJob.updatedAt,
        resultId: schema.generationResult.id,
        resultProviderId: schema.generationResult.providerId,
        resultProviderTaskId: schema.generationResult.providerTaskId,
        resultProviderModelId: schema.generationResult.providerModelId,
        resultProviderStatus: schema.generationResult.providerStatus,
        resultVideoUrl: schema.generationResult.videoUrl,
        resultProviderError: schema.generationResult.providerError,
        resultReceivedAt: schema.generationResult.receivedAt,
        resultCreatedAt: schema.generationResult.createdAt,
        resultUpdatedAt: schema.generationResult.updatedAt,
        assetResultId: schema.generationResultAsset.resultId,
        assetKind: schema.generationResultAsset.kind,
        assetBucket: schema.generationResultAsset.bucket,
        assetObjectKey: schema.generationResultAsset.objectKey,
        assetContentType: schema.generationResultAsset.contentType,
        assetContentLength: schema.generationResultAsset.contentLength,
        assetEtag: schema.generationResultAsset.etag,
        assetChecksumSha256: schema.generationResultAsset.checksumSha256,
        assetSourceProviderUrl: schema.generationResultAsset.sourceProviderUrl,
        previewResultId: schema.generationResultPreview.resultId,
        previewBucket: schema.generationResultPreview.bucket,
        previewObjectKey: schema.generationResultPreview.objectKey,
        previewContentType: schema.generationResultPreview.contentType,
        previewContentLength: schema.generationResultPreview.contentLength,
        previewEtag: schema.generationResultPreview.etag,
        previewChecksumSha256: schema.generationResultPreview.checksumSha256,
        previewFrameTimeMs: schema.generationResultPreview.frameTimeMs,
      })
      .from(schema.generationSubmission)
      .leftJoin(
        schema.generationJob,
        eq(schema.generationJob.submissionId, schema.generationSubmission.id),
      )
      .leftJoin(
        schema.generationResult,
        eq(schema.generationResult.jobId, schema.generationJob.id),
      )
      .leftJoin(
        schema.generationResultAsset,
        eq(schema.generationResultAsset.resultId, schema.generationResult.id),
      )
      .leftJoin(
        schema.generationResultPreview,
        eq(schema.generationResultPreview.resultId, schema.generationResult.id),
      )
      .where(
        and(
          eq(schema.generationSubmission.userId, userId),
          eq(schema.generationSubmission.threadId, threadId),
        ),
      )
      .orderBy(
        asc(schema.generationSubmission.createdAt),
        asc(schema.generationJob.submissionIndex),
        asc(schema.generationResultAsset.kind),
      );

    const submissionsById = new Map<string, GenerationThreadSubmission>();
    const jobsById = new Map<string, GenerationThreadSubmissionJob>();

    for (const row of rows) {
      let submission = submissionsById.get(row.submissionId);

      if (!submission) {
        submission = {
          id: row.submissionId,
          threadId: row.submissionThreadId,
          userId: row.submissionUserId,
          modelId: row.submissionModelId,
          modelSpecId: row.submissionModelSpecId,
          submittedInput: row.submissionSubmittedInput,
          requestedGenerations: row.submissionRequestedGenerations,
          createdAt: row.submissionCreatedAt.toISOString(),
          updatedAt: row.submissionUpdatedAt.toISOString(),
          jobs: [],
          attachmentMedia: createEmptyGenerationThreadAttachmentMediaValue(),
        };
        submissionsById.set(row.submissionId, submission);
      }

      if (!row.jobId) {
        continue;
      }

      let job = jobsById.get(row.jobId);

      if (!job) {
        job = {
          id: row.jobId,
          submissionId: row.jobSubmissionId!,
          submissionIndex: row.jobSubmissionIndex!,
          status: row.jobStatus!,
          providerId: row.providerId,
          providerTaskId: row.providerTaskId,
          providerModelId: row.providerModelId,
          terminalError: row.terminalError,
          createdAt: row.jobCreatedAt!.toISOString(),
          updatedAt: row.jobUpdatedAt!.toISOString(),
          result: row.resultId
            ? {
                providerId: row.resultProviderId!,
                providerTaskId: row.resultProviderTaskId!,
                providerModelId: row.resultProviderModelId,
                providerStatus: row.resultProviderStatus!,
                videoUrl: row.resultVideoUrl,
                previewImageUrl: null,
                mediaUrlExpiresAt: null,
                assets: [],
                preview: row.previewResultId
                  ? {
                      bucket: row.previewBucket!,
                      objectKey: row.previewObjectKey!,
                      contentType: row.previewContentType,
                      contentLength: row.previewContentLength,
                      etag: row.previewEtag,
                      checksumSha256: row.previewChecksumSha256,
                      frameTimeMs: row.previewFrameTimeMs!,
                    }
                  : null,
                providerError: row.resultProviderError,
                receivedAt: row.resultReceivedAt!.toISOString(),
                createdAt: row.resultCreatedAt!.toISOString(),
                updatedAt: row.resultUpdatedAt!.toISOString(),
              }
            : null,
        };
        jobsById.set(row.jobId, job);
        submission.jobs.push(job);
      }

      if (job.result && row.assetResultId && row.assetKind) {
        const asset = {
          kind: row.assetKind,
          bucket: row.assetBucket!,
          objectKey: row.assetObjectKey!,
          contentType: row.assetContentType,
          contentLength: row.assetContentLength,
          etag: row.assetEtag,
          checksumSha256: row.assetChecksumSha256,
          sourceProviderUrl: row.assetSourceProviderUrl,
        };

        job.result.assets ??= [];
        job.result.assets.push(asset);
      }
    }

    const submissions = Array.from(submissionsById.values());
    await this.attachmentMediaRepository.attachAttachmentMediaToSubmissions(
      submissions,
    );

    return submissions;
  }

  async getLatestPublishedGenerationModelSpec(
    modelId: string,
  ): Promise<PublishedGenerationModelSpec | null> {
    const [row] = await this.executor
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
      spec: parsePersistedVideoModelSpec(row.spec),
    };
  }

  async getPublishedGenerationModelSpecById({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId: string;
  }): Promise<PublishedGenerationModelSpec | null> {
    const [row] = await this.executor
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
      spec: parsePersistedVideoModelSpec(row.spec),
    };
  }

  async insertGenerationSubmission({
    userId,
    input,
    modelSpec,
    submittedInput,
    attachmentMedia = [],
    callbackTokenHashes,
  }: {
    userId: string;
    input: CreateVideoGenerationInput;
    modelSpec: PublishedGenerationModelSpec;
    submittedInput: GenerationSubmissionInput;
    attachmentMedia?: StoredGenerationAttachmentMediaWithPosition[];
    callbackTokenHashes: string[];
  }): Promise<{
    submission: GenerationSubmissionRecord;
    jobs: GenerationJobRecord[];
  }> {
    const threadId = input.threadId ?? randomUUID();

    if (input.threadId) {
      const [thread] = await this.executor
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
      if (input.projectId) {
        const [project] = await this.executor
          .select({ id: schema.project.id })
          .from(schema.project)
          .where(
            and(
              eq(schema.project.id, input.projectId),
              eq(schema.project.userId, userId),
              isNull(schema.project.archivedAt),
            ),
          )
          .limit(1);

        if (!project) {
          throw new GenerationProjectNotFoundError(input.projectId);
        }
      }

      await this.executor.insert(schema.generationThread).values({
        id: threadId,
        userId,
        name: `Thread ${randomBytes(4).toString("hex")}`,
        ...(input.projectId ? { projectId: input.projectId } : {}),
      });
    }

    const [submission] = await this.executor
      .insert(schema.generationSubmission)
      .values({
        id: randomUUID(),
        threadId,
        userId,
        modelId: input.modelId,
        modelSpecId: modelSpec.id,
        submittedInput,
        requestedGenerations: input.requestedGenerations,
      })
      .returning();

    if (!submission) {
      throw new Error("Generation submission was not created");
    }

    await this.attachmentMediaRepository.attachAttachmentMediaToSubmission(
      submission.id,
      attachmentMedia,
    );

    const jobs = await this.executor
      .insert(schema.generationJob)
      .values(
        callbackTokenHashes.map((callbackTokenHash, submissionIndex) => ({
          id: randomUUID(),
          submissionId: submission.id,
          submissionIndex,
          status: "queued" as const,
          callbackTokenHash,
          providerId: modelSpec.providerId,
          providerModelId: modelSpec.spec.providerModelId,
        })),
      )
      .returning();

    if (jobs.length !== callbackTokenHashes.length) {
      throw new Error("Generation jobs were not created");
    }

    return {
      submission: {
        ...submission,
        attachmentMedia: toThreadAttachmentMediaValue(attachmentMedia),
      },
      jobs: [...jobs].sort(
        (left, right) => left.submissionIndex - right.submissionIndex,
      ),
    };
  }

  async getGenerationJobById(
    jobId: string,
  ): Promise<GenerationJobWithSubmissionContext | null> {
    const [row] = await this.executor
      .select({
        id: schema.generationJob.id,
        submissionId: schema.generationJob.submissionId,
        submissionIndex: schema.generationJob.submissionIndex,
        status: schema.generationJob.status,
        temporalWorkflowId: schema.generationJob.temporalWorkflowId,
        temporalRunId: schema.generationJob.temporalRunId,
        callbackTokenHash: schema.generationJob.callbackTokenHash,
        providerId: schema.generationJob.providerId,
        providerTaskId: schema.generationJob.providerTaskId,
        providerModelId: schema.generationJob.providerModelId,
        terminalError: schema.generationJob.terminalError,
        createdAt: schema.generationJob.createdAt,
        updatedAt: schema.generationJob.updatedAt,
        threadId: schema.generationSubmission.threadId,
        userId: schema.generationSubmission.userId,
        modelId: schema.generationSubmission.modelId,
        modelSpecId: schema.generationSubmission.modelSpecId,
        submittedInput: schema.generationSubmission.submittedInput,
        requestedGenerations: schema.generationSubmission.requestedGenerations,
      })
      .from(schema.generationJob)
      .innerJoin(
        schema.generationSubmission,
        eq(schema.generationSubmission.id, schema.generationJob.submissionId),
      )
      .where(eq(schema.generationJob.id, jobId))
      .limit(1);

    return row ?? null;
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
    storedAssets = [],
    storedPreview = null,
  }: {
    jobId: string;
    result: RetrieveSeedanceVideoTaskResult;
    rawPayload: unknown;
    receivedAt: Date;
    storedAssets?: StoredGenerationResultAssetReference[];
    storedPreview?: StoredGenerationResultPreviewReference | null;
  }) {
    const values = {
      id: randomUUID(),
      jobId,
      providerId: result.provider,
      providerTaskId: result.providerTaskId,
      providerModelId: result.providerModelId,
      providerStatus: result.status,
      videoUrl: result.videoUrl,
      usage: result.usage,
      providerError: result.providerError,
      rawPayload,
      receivedAt,
    };

    const [generationResult] = await this.executor
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

    for (const asset of storedAssets) {
      const assetValues = {
        id: randomUUID(),
        resultId: generationResult.id,
        kind: asset.kind,
        bucket: asset.bucket,
        objectKey: asset.objectKey,
        contentType: asset.contentType,
        contentLength: asset.contentLength,
        etag: asset.etag,
        checksumSha256: asset.checksumSha256,
        sourceProviderUrl: asset.sourceProviderUrl,
      };

      await this.executor
        .insert(schema.generationResultAsset)
        .values(assetValues)
        .onConflictDoUpdate({
          target: [
            schema.generationResultAsset.resultId,
            schema.generationResultAsset.kind,
          ],
          set: {
            bucket: assetValues.bucket,
            objectKey: assetValues.objectKey,
            contentType: assetValues.contentType,
            contentLength: assetValues.contentLength,
            etag: assetValues.etag,
            checksumSha256: assetValues.checksumSha256,
            sourceProviderUrl: assetValues.sourceProviderUrl,
            updatedAt: new Date(),
          },
        });
    }

    if (storedPreview) {
      const previewValues = {
        id: randomUUID(),
        resultId: generationResult.id,
        bucket: storedPreview.bucket,
        objectKey: storedPreview.objectKey,
        contentType: storedPreview.contentType,
        contentLength: storedPreview.contentLength,
        etag: storedPreview.etag,
        checksumSha256: storedPreview.checksumSha256,
        frameTimeMs: storedPreview.frameTimeMs,
      };

      await this.executor
        .insert(schema.generationResultPreview)
        .values(previewValues)
        .onConflictDoUpdate({
          target: schema.generationResultPreview.resultId,
          set: {
            bucket: previewValues.bucket,
            objectKey: previewValues.objectKey,
            contentType: previewValues.contentType,
            contentLength: previewValues.contentLength,
            etag: previewValues.etag,
            checksumSha256: previewValues.checksumSha256,
            frameTimeMs: previewValues.frameTimeMs,
            updatedAt: new Date(),
          },
        });
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

  async markGenerationJobFinalCostCalculationFailed({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError;
  }): Promise<GenerationJobRecord> {
    return this.updateGenerationJob(jobId, {
      status: "final_cost_calculation_failure",
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
    const [job] = await this.executor
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

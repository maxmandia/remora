import { createHash, randomBytes } from "node:crypto";

import { assertNever } from "@remora/utils";
import type { TransactionManager } from "../../db/transaction-manager.ts";
import { analyticsService } from "../analytics/analytics.service.ts";
import type {
  AnalyticsTracker,
  GenerationAnalyticsContext,
  GenerationTargetType,
} from "../analytics/analytics.types.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import type { GenerationAttachmentMediaService } from "../generation-attachment-media/generation-attachment-media.service.ts";
import type { StoredGenerationAttachmentMediaWithPosition } from "../generation-attachment-media/generation-attachment-media.types.ts";
import { createProvisionalGenerationThreadName } from "../generation-thread/generation-thread.utils.ts";
import type {
  GenerationModelAdapter,
  JsonPrimitive,
  VideoFieldSpec,
  VideoModelSpec,
} from "../model/model.types.ts";
import type { ModelRatesService } from "../model_rates/model_rates.service.ts";
import type {
  EstimateGenerationCostAttachmentMediaInput,
  EstimateGenerationCostInput,
} from "../model_rates/model_rates.types.ts";
import { toErrorLogFields } from "../observability/observability.service.ts";
import {
  objectStorageService,
  type SignedObjectUrl,
} from "../storage/object-storage.service.ts";
import { logGenerationLifecycleEvent } from "./generation.observability.ts";
import type {
  GenerationModelSpecRecord,
  GenerationRepository,
} from "./generation.repository.ts";
import { generationRepository } from "./generation.repository.ts";
import type {
  CreatedVideoGenerationSubmission,
  CreateVideoTaskInput,
  CreateVideoTaskResult,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  FinalizeUnsuccessfulGenerationJobInput,
  GenerationJobRecord,
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationJobWithSubmissionContext,
  GenerationProviderCallback,
  GenerationProviderTaskResult,
  GenerationSubmissionInput,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
} from "./generation.types.ts";
import {
  createVideoGenerationFieldIds,
  GenerationInputValidationError,
  GenerationProviderTaskMismatchError,
  maxRequestedGenerations,
  minRequestedGenerations,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";
import type { BytePlusService } from "./providers/byteplus/byteplus.service.ts";
import type { KlingService } from "./providers/kling/kling.service.ts";

type ObjectStorageReader = {
  createSignedGetUrlWithExpiration(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<SignedObjectUrl>;
};

type GenerationServiceOptions = {
  analyticsService?: AnalyticsTracker;
  attachmentMediaService: Pick<
    GenerationAttachmentMediaService,
    "resolveSelectionForSubmission"
  >;
  bytePlusService: Pick<
    BytePlusService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  klingService: Pick<
    KlingService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  modelRatesService: Pick<
    ModelRatesService,
    "estimateGenerationCostForSingleJob"
  >;
  storage?: ObjectStorageReader;
  transactionManager: TransactionManager;
};

export class GenerationService {
  private readonly analytics: AnalyticsTracker;
  private readonly attachmentMedia: Pick<
    GenerationAttachmentMediaService,
    "resolveSelectionForSubmission"
  >;
  private readonly bytePlus: Pick<
    BytePlusService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  private readonly kling: Pick<
    KlingService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  private readonly modelRates: Pick<
    ModelRatesService,
    "estimateGenerationCostForSingleJob"
  >;
  private readonly storage: ObjectStorageReader;
  private readonly transactionManager: TransactionManager;

  constructor(
    private readonly repository: GenerationRepository = generationRepository,
    options: GenerationServiceOptions,
  ) {
    this.analytics = options.analyticsService ?? analyticsService;
    this.attachmentMedia = options.attachmentMediaService;
    this.bytePlus = options.bytePlusService;
    this.kling = options.klingService;
    this.modelRates = options.modelRatesService;
    this.storage = options.storage ?? objectStorageService;
    this.transactionManager = options.transactionManager;
  }

  async listSubmissionsFromThread({
    userId,
    threadId,
  }: {
    userId: string;
    threadId: string;
  }): Promise<GenerationThreadSubmission[]> {
    const submissions = await this.repository.listSubmissionsFromThread({
      userId,
      threadId,
    });

    for (const submission of submissions) {
      for (const job of submission.jobs) {
        if (!job.result) {
          continue;
        }

        for (const asset of job.result.assets ?? []) {
          this.applySignedVideoAssetUrl({
            result: job.result,
            signedUrl: await this.storage.createSignedGetUrlWithExpiration({
              bucket: asset.bucket,
              objectKey: asset.objectKey,
            }),
          });
        }

        if (job.result.preview) {
          this.applySignedPreviewImageUrl({
            result: job.result,
            signedUrl: await this.storage.createSignedGetUrlWithExpiration({
              bucket: job.result.preview.bucket,
              objectKey: job.result.preview.objectKey,
            }),
          });
        }
      }
    }

    return submissions;
  }

  async createVideoGenerationSubmission({
    userId,
    input,
  }: {
    userId: string;
    input: CreateVideoGenerationInput;
  }): Promise<CreatedVideoGenerationSubmission> {
    this.validateRequestedGenerations(input.requestedGenerations);

    const modelSpec = await this.getPublishedSupportedVideoModelSpec({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
    });
    const submittedInput = this.toSubmittedInput(input);
    const attachmentMedia =
      await this.attachmentMedia.resolveSelectionForSubmission({
        input: input.attachmentMedia,
        spec: modelSpec.spec,
        userId,
      });
    const callbackTokens = [...Array(input.requestedGenerations)].map(() =>
      this.createGenerationCallbackToken(),
    );

    this.validateCreateVideoInputAgainstSpec({
      input: {
        ...input,
        ...submittedInput,
      },
      spec: modelSpec.spec,
    });

    const jobCost = await this.modelRates.estimateGenerationCostForSingleJob(
      this.toEstimateGenerationCostInput({
        attachmentMedia,
        input,
        submittedInput,
      }),
    );
    const generation = this.toGenerationAnalyticsContext({
      modelId: input.modelId,
      modelSpecId: modelSpec.id,
      requestedGenerations: input.requestedGenerations,
      submittedInput,
      attachmentMedia,
    });
    const targetType = this.getGenerationTargetType(input);

    try {
      const createdSubmission = await this.transactionManager.transaction(
        async (tx) => {
          const createdThread = input.threadId
            ? null
            : await tx.generationThread.createThread({
                userId,
                name: createProvisionalGenerationThreadName(input.prompt),
                ...(input.projectId ? { projectId: input.projectId } : {}),
              });

          if (input.threadId) {
            // Inserting a submission updates a child row, so the thread's Drizzle
            // $onUpdate hook does not run. Touch it to preserve activity ordering.
            await tx.generationThread.touchOwnedThread({
              userId,
              threadId: input.threadId,
            });
          }

          const created = await tx.generation.insertGenerationSubmission({
            userId,
            threadId: input.threadId ?? createdThread!.id,
            input,
            modelSpec,
            submittedInput,
            attachmentMedia,
            callbackTokenHashes: callbackTokens.map((callbackToken) =>
              this.hashGenerationCallbackToken(callbackToken),
            ),
          });

          for (const job of created.jobs) {
            const cost =
              await tx.modelRates.createGenerationJobCostWithEstimate({
                jobId: job.id,
                estimatedCostUsdMicros: jobCost.estimatedCostUsdMicros,
                currencyCode: jobCost.currencyCode,
                estimatedCostSnapshot: jobCost.estimatedCostSnapshot,
              });
            await tx.services.credits.reserveGenerationJobCostEstimate({
              userId,
              generationSubmissionId: created.submission.id,
              generationJobId: job.id,
              generationJobCostId: cost.id,
              estimatedCostUsdMicros: cost.estimatedCostUsdMicros,
            });
          }

          return {
            ...created,
            createdThread,
          };
        },
      );

      this.analytics.track({
        type: "generation_submission_created",
        userId,
        occurredAt: createdSubmission.submission.createdAt,
        submissionId: createdSubmission.submission.id,
        generation,
        targetType,
        estimatedCostUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
        estimatedCostUsdMicrosTotal:
          jobCost.estimatedCostUsdMicros * input.requestedGenerations,
      });

      return {
        submission: createdSubmission.submission,
        jobs: createdSubmission.jobs.map((job, index) => ({
          job,
          callbackToken: callbackTokens[index]!,
        })),
        createdThread: createdSubmission.createdThread,
      };
    } catch (error) {
      if (error instanceof InsufficientCreditBalanceError) {
        this.analytics.track({
          type: "insufficient_credits_encountered",
          userId,
          occurredAt: new Date(),
          generation,
          targetType,
          requiredCreditUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
          requiredCreditUsdMicrosTotal:
            jobCost.estimatedCostUsdMicros * input.requestedGenerations,
        });
      }

      throw error;
    }
  }

  private toEstimateGenerationCostInput({
    attachmentMedia,
    input,
    submittedInput,
  }: {
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
    input: CreateVideoGenerationInput;
    submittedInput: GenerationSubmissionInput;
  }): EstimateGenerationCostInput {
    return {
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      resolution: submittedInput.resolution,
      aspectRatio: submittedInput.aspectRatio,
      duration: submittedInput.duration,
      generateAudio: submittedInput.generateAudio,
      requestedGenerations: input.requestedGenerations,
      attachmentMedia:
        this.toEstimateGenerationCostAttachmentMedia(attachmentMedia),
    };
  }

  private toEstimateGenerationCostAttachmentMedia(
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[],
  ): EstimateGenerationCostAttachmentMediaInput | undefined {
    if (attachmentMedia.length === 0) {
      return undefined;
    }

    const estimateAttachmentMedia: EstimateGenerationCostAttachmentMediaInput =
      {};

    for (const media of attachmentMedia) {
      estimateAttachmentMedia[media.fieldId] ??= [];
      estimateAttachmentMedia[media.fieldId]?.push({
        role: media.role,
      });
    }

    return estimateAttachmentMedia;
  }

  async createVideoTask(
    input: CreateVideoTaskInput,
  ): Promise<CreateVideoTaskResult> {
    const modelSpec = await this.getRunnableSupportedVideoModelSpec({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
    });
    const startedAt = Date.now();

    try {
      let providerTask: CreateVideoTaskResult;

      switch (modelSpec.adapter) {
        case "byteplus_seedance_video":
          providerTask = await this.bytePlus.createVideoTask({
            spec: modelSpec.spec,
            input,
          });
          break;
        case "kling_v3_text_to_video":
          providerTask = await this.kling.createVideoTask({
            spec: modelSpec.spec,
            input,
          });
          break;
        default:
          return assertNever(modelSpec.adapter);
      }

      logGenerationLifecycleEvent("generation.provider.task_created", {
        modelId: input.modelId,
        modelSpecId: input.modelSpecId,
        providerId: modelSpec.providerId,
        providerTaskId: providerTask.providerTaskId,
        providerModelId: providerTask.providerModelId,
        durationMs: Date.now() - startedAt,
      });

      return providerTask;
    } catch (error) {
      logGenerationLifecycleEvent("generation.provider.task_create_failed", {
        modelId: input.modelId,
        modelSpecId: input.modelSpecId,
        providerId: modelSpec.providerId,
        durationMs: Date.now() - startedAt,
        ...toErrorLogFields(error),
      });

      throw error;
    }
  }

  async normalizeVideoGenerationProviderCallback({
    modelId,
    modelSpecId,
    expectedProviderTaskId,
    rawPayload,
    receivedAt,
  }: {
    modelId: string;
    modelSpecId: string;
    expectedProviderTaskId: string | null;
    rawPayload: unknown;
    receivedAt: string;
  }): Promise<GenerationProviderCallback> {
    const modelSpec = await this.getRunnableSupportedVideoModelSpec({
      modelId,
      modelSpecId,
    });
    let result: GenerationProviderTaskResult;

    try {
      switch (modelSpec.adapter) {
        case "byteplus_seedance_video":
          result = this.bytePlus.normalizeVideoTaskResult(rawPayload);
          break;
        case "kling_v3_text_to_video":
          result = this.kling.normalizeVideoTaskResult(
            rawPayload,
            modelSpec.spec.providerModelId ?? "",
          );
          break;
        default:
          return assertNever(modelSpec.adapter);
      }
    } catch {
      return {
        kind: "malformed",
        terminalError: {
          source: "provider",
          code: "MALFORMED_PROVIDER_CALLBACK",
          message: "Provider callback payload could not be parsed",
        },
        rawPayload,
        receivedAt,
      };
    }

    if (
      expectedProviderTaskId &&
      expectedProviderTaskId !== result.providerTaskId
    ) {
      throw new GenerationProviderTaskMismatchError(
        expectedProviderTaskId,
        result.providerTaskId,
      );
    }

    return {
      kind: "result",
      result,
      rawPayload,
      receivedAt,
    };
  }

  async finalizeUnsuccessfulGenerationJob(
    input: FinalizeUnsuccessfulGenerationJobInput,
  ): Promise<GenerationJobRecord> {
    let jobContext: GenerationJobWithSubmissionContext | null = null;
    let shouldTrack = false;
    const finalizedJob = await this.transactionManager.transaction(
      async (tx) => {
        const job = await tx.generation.getGenerationJobById(input.jobId);

        if (!job) {
          throw new Error(`Generation job was not found: ${input.jobId}`);
        }
        jobContext = job;
        shouldTrack = !this.isTerminalGenerationJobStatus(job.status);

        const cost = await tx.modelRates.getGenerationJobCostByJobId(
          input.jobId,
        );

        if (!cost) {
          throw new Error(
            `Generation job cost was not found for job ${input.jobId}`,
          );
        }

        if (cost.finalizedAt) {
          throw new Error(
            `Generation job cost was already finalized for job ${input.jobId}`,
          );
        }

        await tx.services.credits.releaseGenerationJobCostReservation({
          userId: job.userId,
          generationJobId: input.jobId,
          generationJobCostId: cost.id,
          estimatedCostUsdMicros: cost.estimatedCostUsdMicros,
        });
        await tx.services.modelRateLimits.releaseJobConcurrencyLeases({
          jobId: input.jobId,
        });

        switch (input.status) {
          case "failed":
            return tx.generation.markGenerationJobFailed(input);
          case "cancelled":
            return tx.generation.markGenerationJobCancelled(input);
          case "expired":
            return tx.generation.markGenerationJobExpired(input);
        }
      },
    );
    const jobContextForLog =
      jobContext as GenerationJobWithSubmissionContext | null;

    logGenerationLifecycleEvent("generation.job.terminal", {
      userId: jobContextForLog?.userId,
      submissionId: finalizedJob.submissionId,
      jobId: finalizedJob.id,
      threadId: jobContextForLog?.threadId,
      modelId: jobContextForLog?.modelId,
      modelSpecId: jobContextForLog?.modelSpecId,
      providerId: finalizedJob.providerId,
      providerTaskId: finalizedJob.providerTaskId,
      providerModelId: finalizedJob.providerModelId,
      temporalWorkflowId: finalizedJob.temporalWorkflowId,
      temporalRunId: finalizedJob.temporalRunId,
      status: finalizedJob.status,
      errorSource: finalizedJob.terminalError?.source,
      errorCode: finalizedJob.terminalError?.code,
      errorMessage: finalizedJob.terminalError?.message,
    });

    if (shouldTrack && jobContextForLog) {
      this.trackGenerationJobOutcome(finalizedJob, jobContextForLog);
    }

    return finalizedJob;
  }

  async markGenerationJobSucceeded({
    jobId,
  }: {
    jobId: string;
  }): Promise<GenerationJobRecord> {
    let jobContext: GenerationJobWithSubmissionContext | null = null;
    let shouldTrack = false;
    const finalizedJob = await this.transactionManager.transaction(
      async (tx) => {
        const job = await tx.generation.getGenerationJobById(jobId);

        if (!job) {
          throw new Error(`Generation job was not found: ${jobId}`);
        }

        jobContext = job;
        shouldTrack = !this.isTerminalGenerationJobStatus(job.status);
        await tx.services.modelRateLimits.releaseJobConcurrencyLeases({
          jobId,
        });

        return tx.generation.markGenerationJobSucceeded({ jobId });
      },
    );
    const context = jobContext as GenerationJobWithSubmissionContext | null;

    if (shouldTrack && context) {
      this.trackGenerationJobOutcome(finalizedJob, context);
    }

    return finalizedJob;
  }

  async markGenerationJobFinalCostCalculationFailed({
    jobId,
    terminalError,
  }: {
    jobId: string;
    terminalError: GenerationJobTerminalError;
  }): Promise<GenerationJobRecord> {
    let jobContext: GenerationJobWithSubmissionContext | null = null;
    let shouldTrack = false;
    const finalizedJob = await this.transactionManager.transaction(
      async (tx) => {
        const job = await tx.generation.getGenerationJobById(jobId);

        if (!job) {
          throw new Error(`Generation job was not found: ${jobId}`);
        }

        jobContext = job;
        shouldTrack = !this.isTerminalGenerationJobStatus(job.status);
        await tx.services.modelRateLimits.releaseJobConcurrencyLeases({
          jobId,
        });

        return tx.generation.markGenerationJobFinalCostCalculationFailed({
          jobId,
          terminalError,
        });
      },
    );
    const context = jobContext as GenerationJobWithSubmissionContext | null;

    if (shouldTrack && context) {
      this.trackGenerationJobOutcome(finalizedJob, context);
    }

    return finalizedJob;
  }

  private trackGenerationJobOutcome(
    job: GenerationJobRecord,
    context: GenerationJobWithSubmissionContext,
  ): void {
    if (!job.terminalAt) {
      return;
    }

    const input = {
      userId: context.userId,
      occurredAt: job.terminalAt,
      jobId: job.id,
      generation: this.toGenerationAnalyticsContext({
        modelId: context.modelId,
        modelSpecId: context.modelSpecId,
        requestedGenerations: context.requestedGenerations,
        submittedInput: context.submittedInput,
        attachmentMedia: Object.values(context.attachmentMedia).flat(),
      }),
      outputIndex: job.submissionIndex,
      providerId: job.providerId ?? undefined,
      providerModelId: job.providerModelId ?? undefined,
      processingDurationMs: Math.max(
        0,
        job.terminalAt.getTime() - job.createdAt.getTime(),
      ),
    };

    if (job.status === "succeeded") {
      this.analytics.track({
        type: "generation_job_succeeded",
        ...input,
      });
      return;
    }

    if (
      job.status === "failed" ||
      job.status === "cancelled" ||
      job.status === "expired" ||
      job.status === "final_cost_calculation_failure"
    ) {
      this.analytics.track({
        type: "generation_job_failed",
        ...input,
        terminalStatus: job.status,
        errorSource: job.terminalError?.source,
        errorCode: job.terminalError?.code ?? undefined,
      });
    }
  }

  private toGenerationAnalyticsContext({
    modelId,
    modelSpecId,
    requestedGenerations,
    submittedInput,
    attachmentMedia,
  }: {
    modelId: string;
    modelSpecId: string;
    requestedGenerations: number;
    submittedInput: GenerationSubmissionInput;
    attachmentMedia: readonly { kind: "image" | "video" | "audio" }[];
  }): GenerationAnalyticsContext {
    return {
      modelId,
      modelSpecId,
      requestedOutputCount: requestedGenerations,
      resolution: submittedInput.resolution,
      aspectRatio: submittedInput.aspectRatio,
      generationDurationSeconds: submittedInput.duration,
      generateAudio: submittedInput.generateAudio,
      attachmentCount: attachmentMedia.length,
      hasImageAttachment: attachmentMedia.some(
        (attachment) => attachment.kind === "image",
      ),
      hasVideoAttachment: attachmentMedia.some(
        (attachment) => attachment.kind === "video",
      ),
      hasAudioAttachment: attachmentMedia.some(
        (attachment) => attachment.kind === "audio",
      ),
    };
  }

  private getGenerationTargetType(
    input: CreateVideoGenerationInput,
  ): GenerationTargetType {
    if (input.threadId) {
      return "existing_thread";
    }

    return input.projectId ? "new_project_thread" : "new_unprojected_thread";
  }

  private isTerminalGenerationJobStatus(status: GenerationJobStatus): boolean {
    return (
      status === "succeeded" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "expired" ||
      status === "final_cost_calculation_failure"
    );
  }

  private applySignedVideoAssetUrl({
    result,
    signedUrl,
  }: {
    result: GenerationThreadJobResult;
    signedUrl: SignedObjectUrl;
  }) {
    result.videoUrl = signedUrl.url;

    result.mediaUrlExpiresAt = this.getEarliestMediaUrlExpiration(
      result.mediaUrlExpiresAt,
      signedUrl.expiresAt,
    );
  }

  private applySignedPreviewImageUrl({
    result,
    signedUrl,
  }: {
    result: GenerationThreadJobResult;
    signedUrl: SignedObjectUrl;
  }) {
    result.previewImageUrl = signedUrl.url;

    result.mediaUrlExpiresAt = this.getEarliestMediaUrlExpiration(
      result.mediaUrlExpiresAt,
      signedUrl.expiresAt,
    );
  }

  private getEarliestMediaUrlExpiration(current: string | null, next: string) {
    if (!current || next < current) {
      return next;
    }

    return current;
  }

  private async getPublishedSupportedVideoModelSpec({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId: string;
  }) {
    const modelSpec = await this.repository.getPublishedGenerationModelSpecById(
      {
        modelId,
        modelSpecId,
      },
    );

    if (!modelSpec) {
      throw new UnsupportedGenerationModelError(modelId);
    }

    this.assertSupportedVideoModelSpec(modelSpec);
    return modelSpec;
  }

  private async getRunnableSupportedVideoModelSpec({
    modelId,
    modelSpecId,
  }: {
    modelId: string;
    modelSpecId: string;
  }) {
    const modelSpec = await this.repository.getRunnableGenerationModelSpecById({
      modelId,
      modelSpecId,
    });

    if (!modelSpec) {
      throw new UnsupportedGenerationModelError(modelId);
    }

    this.assertSupportedVideoModelSpec(modelSpec);
    return modelSpec;
  }

  private assertSupportedVideoModelSpec(
    modelSpec: GenerationModelSpecRecord,
  ): asserts modelSpec is GenerationModelSpecRecord & {
    adapter: GenerationModelAdapter;
  } {
    if (modelSpec.adapter === null) {
      throw new UnsupportedGenerationModelError(modelSpec.modelId);
    }
  }

  private toSubmittedInput(
    input: CreateVideoGenerationInput,
  ): GenerationSubmissionInput {
    return {
      prompt: input.prompt.trim(),
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
    };
  }

  private validateCreateVideoInputAgainstSpec({
    input,
    spec,
  }: {
    input: CreateVideoGenerationInput;
    spec: VideoModelSpec;
  }) {
    for (const fieldId of createVideoGenerationFieldIds) {
      this.validateFieldValue({
        field: this.getRequiredField(spec, fieldId),
        value: input[fieldId],
      });
    }
  }

  private validateRequestedGenerations(requestedGenerations: number) {
    if (!Number.isInteger(requestedGenerations)) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        "requestedGenerations must be an integer",
      );
    }

    if (requestedGenerations < minRequestedGenerations) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        `requestedGenerations must be greater than or equal to ${minRequestedGenerations}`,
      );
    }

    if (requestedGenerations > maxRequestedGenerations) {
      throw new GenerationInputValidationError(
        "requestedGenerations",
        `requestedGenerations must be less than or equal to ${maxRequestedGenerations}`,
      );
    }
  }

  private getRequiredField(
    spec: VideoModelSpec,
    fieldId: CreateVideoGenerationFieldId,
  ) {
    const field = spec.fields.find((candidate) => candidate.id === fieldId);

    if (!field) {
      throw new GenerationInputValidationError(
        fieldId,
        `${fieldId} is not supported by this model`,
      );
    }

    return field;
  }

  private validateFieldValue({
    field,
    value,
  }: {
    field: VideoFieldSpec;
    value: JsonPrimitive;
  }) {
    this.validateFieldValueKind(field, value);
    this.validateFieldBounds(field, value);
    this.validateFieldOptions(field, value);
  }

  private validateFieldValueKind(field: VideoFieldSpec, value: JsonPrimitive) {
    if (field.valueKind === "integer" && !Number.isInteger(value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be an integer`,
      );
    }

    if (field.valueKind === "number" && typeof value !== "number") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a number`,
      );
    }

    if (field.valueKind === "boolean" && typeof value !== "boolean") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a boolean`,
      );
    }

    if (field.valueKind === "string" && typeof value !== "string") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a string`,
      );
    }
  }

  private validateFieldBounds(field: VideoFieldSpec, value: JsonPrimitive) {
    if (typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be greater than or equal to ${field.min}`,
        );
      }

      if (field.max !== undefined && value > field.max) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be less than or equal to ${field.max}`,
        );
      }
    }

    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at least ${field.minLength} characters`,
        );
      }

      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at most ${field.maxLength} characters`,
        );
      }
    }
  }

  private validateFieldOptions(field: VideoFieldSpec, value: JsonPrimitive) {
    if (!field.options || field.options.length === 0) {
      return;
    }

    if (!field.options.some((option) => option.value === value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must match a supported model option`,
      );
    }
  }

  private createGenerationCallbackToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashGenerationCallbackToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

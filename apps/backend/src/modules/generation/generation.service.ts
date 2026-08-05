import { createHash, randomBytes } from "node:crypto";

import { assertNever } from "@remora/utils";
import type { TransactionManager } from "../../db/transaction-manager.ts";
import { analyticsService } from "../analytics/analytics.service.ts";
import type {
  AnalyticsDeliveryContext,
  AnalyticsTracker,
  GenerationAnalyticsContext,
  GenerationTargetType,
} from "../analytics/analytics.types.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import type { GenerationAttachmentMediaService } from "../generation-attachment-media/generation-attachment-media.service.ts";
import type {
  GenerationAttachmentMediaInput,
  GenerationThreadAttachmentMediaValue,
  StoredGenerationAttachmentMediaWithPosition,
} from "../generation-attachment-media/generation-attachment-media.types.ts";
import { createProvisionalGenerationThreadName } from "../generation-thread/generation-thread.utils.ts";
import type {
  GenerationFieldSpec,
  GenerationModelSpec,
  ImageModelSpec,
  JsonPrimitive,
  VideoModelSpec,
} from "../model/model.types.ts";
import type { ModelRatesService } from "../model_rates/model_rates.service.ts";
import type {
  EstimateGenerationCostAttachmentMediaInput,
  EstimateGenerationCostInput,
  GenerationJobCost,
} from "../model_rates/model_rates.types.ts";
import { toErrorLogFields } from "../observability/observability.service.ts";
import {
  objectStorageService,
  type RemoteObject,
  type SignedObjectUrl,
} from "../storage/object-storage.service.ts";
import { logGenerationLifecycleEvent } from "./generation.observability.ts";
import { toGoogleProviderErrorLogFields } from "./providers/google/google.observability.ts";
import { toOpenAIProviderErrorLogFields } from "./providers/openai/openai.observability.ts";
import type { GenerationRepository } from "./generation.repository.ts";
import { generationRepository } from "./generation.repository.ts";
import type {
  CreatedImageGenerationSubmission,
  CreatedDraftEnhancementSubmission,
  CreatedVideoGenerationSubmission,
  CreateGenerationInputBase,
  CreateGenerationSubmissionInput,
  CreateImageGenerationFieldId,
  CreateImageGenerationInput,
  CreateImageTaskInput,
  CreateImageTaskResult,
  CreateVideoTaskInput,
  CreateVideoTaskResult,
  CreateVideoGenerationFieldId,
  CreateVideoGenerationInput,
  FinalizeUnsuccessfulGenerationJobInput,
  GenerationDraftEnhancementSourceJob,
  GenerationJobRecord,
  GenerationDraftEnhancementQuote,
  GenerationImageDownloadUrl,
  GenerationImageDownload,
  GenerationJobTerminalError,
  GenerationJobWithSubmissionContext,
  GenerationModelSpecRecord,
  GenerationProviderCallback,
  GenerationProviderTaskResult,
  GenerationSubmissionInput,
  GenerationThreadJobResult,
  GenerationThreadSubmission,
  ImageGenerationSubmissionInput,
  PollVideoTaskInput,
  VideoGenerationSubmissionInput,
} from "./generation.types.ts";
import {
  createImageGenerationFieldIds,
  createVideoGenerationFieldIds,
  GenerationInputValidationError,
  GenerationImageDownloadNotFoundError,
  GenerationDraftEnhancementUnavailableError,
  GenerationModelTypeMismatchError,
  GenerationProviderTaskMismatchError,
  GenerationSubmissionNotFoundError,
  isTerminalGenerationJobStatus,
  maxRequestedGenerations,
  minRequestedGenerations,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";
import { createGeneratedImageFilename } from "./generation.utils.ts";
import type { BflService } from "./providers/bfl/bfl.service.ts";
import { BflPayloadError } from "./providers/bfl/bfl.types.ts";
import type { BytePlusService } from "./providers/byteplus/byteplus.service.ts";
import {
  googleService,
  type GoogleService,
} from "./providers/google/google.service.ts";
import type { KlingService } from "./providers/kling/kling.service.ts";
import {
  openAIService,
  type OpenAIService,
} from "./providers/openai/openai.service.ts";

type ObjectStorageReader = {
  createSignedGetUrlWithExpiration(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<SignedObjectUrl>;
  downloadObject(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<RemoteObject>;
};

type GenerationServiceOptions = {
  analyticsService?: AnalyticsTracker;
  attachmentMediaService: Pick<
    GenerationAttachmentMediaService,
    "resolveSelectionForSubmission"
  >;
  bflService: Pick<
    BflService,
    "createVideoTask" | "retrieveVideoTask" | "normalizeVideoTaskResult"
  >;
  bytePlusService: Pick<
    BytePlusService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  googleService?: Pick<GoogleService, "generateImage">;
  openAIService?: Pick<OpenAIService, "generateImage">;
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
  private readonly bfl: Pick<
    BflService,
    "createVideoTask" | "retrieveVideoTask" | "normalizeVideoTaskResult"
  >;
  private readonly bytePlus: Pick<
    BytePlusService,
    "createVideoTask" | "normalizeVideoTaskResult"
  >;
  private readonly google: Pick<GoogleService, "generateImage">;
  private readonly openAI: Pick<OpenAIService, "generateImage">;
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
    this.bfl = options.bflService;
    this.bytePlus = options.bytePlusService;
    this.google = options.googleService ?? googleService;
    this.openAI = options.openAIService ?? openAIService;
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
          const signedUrl = await this.storage.createSignedGetUrlWithExpiration(
            {
              bucket: asset.bucket,
              objectKey: asset.objectKey,
            },
          );

          asset.url = signedUrl.url;
          asset.urlExpiresAt = signedUrl.expiresAt;

          if (asset.kind === "video") {
            this.applySignedVideoAssetUrl({
              result: job.result,
              signedUrl,
            });
          }
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

  async getGenerationSubmissionRetryInput({
    submissionId,
    userId,
  }: {
    submissionId: string;
    userId: string;
  }): Promise<CreateGenerationSubmissionInput> {
    const submission = await this.repository.getGenerationSubmissionByIdForUser(
      {
        submissionId,
        userId,
      },
    );

    if (!submission) {
      throw new GenerationSubmissionNotFoundError();
    }

    const inputBase = {
      modelId: submission.modelId,
      modelSpecId: submission.modelSpecId,
      threadId: submission.threadId,
      requestedGenerations: submission.requestedGenerations,
      attachmentMedia: this.toRetryAttachmentMediaInput(
        submission.attachmentMedia,
      ),
    };

    return submission.modelType === "video"
      ? {
          modelType: "video",
          input: {
            ...inputBase,
            ...submission.submittedInput,
          },
        }
      : {
          modelType: "image",
          input: {
            ...inputBase,
            ...submission.submittedInput,
          },
        };
  }

  async getDraftEnhancementQuote({
    submissionId,
    sourceJobId,
    userId,
  }: {
    submissionId: string;
    sourceJobId?: string;
    userId: string;
  }): Promise<GenerationDraftEnhancementQuote> {
    const prepared = await this.prepareDraftEnhancement({
      submissionId,
      sourceJobId,
      userId,
    });
    const jobCost = await this.modelRates.estimateGenerationCostForSingleJob(
      this.toEstimateVideoGenerationCostInput({
        attachmentMedia: prepared.attachmentMedia,
        input: prepared.input,
        submittedInput: {
          ...prepared.submission.submittedInput,
          draft: false,
        },
      }),
    );

    return {
      eligibleDraftCount: prepared.sourceJobs.length,
      estimatedCostUsdMicros:
        jobCost.estimatedCostUsdMicros * prepared.sourceJobs.length,
      currencyCode: jobCost.currencyCode,
    };
  }

  async createDraftEnhancementSubmission({
    analyticsContext,
    submissionId,
    sourceJobId,
    userId,
  }: {
    analyticsContext: AnalyticsDeliveryContext;
    submissionId: string;
    sourceJobId?: string;
    userId: string;
  }): Promise<CreatedDraftEnhancementSubmission> {
    const prepared = await this.prepareDraftEnhancement({
      submissionId,
      sourceJobId,
      userId,
    });
    const created = await this.createVideoGenerationSubmission({
      analyticsContext,
      userId,
      input: prepared.input,
    });

    if (created.jobs.length !== prepared.sourceJobs.length) {
      throw new Error("Draft enhancement job count did not match its sources");
    }

    const jobs = created.jobs.map((createdJob, index) => {
      if (createdJob.providerExecution.mode !== "polling") {
        throw new Error("Draft enhancement requires polling execution");
      }

      return {
        job: createdJob.job,
        providerExecution: createdJob.providerExecution,
        draftEnhancementSourceJobId: prepared.sourceJobs[index]!.jobId,
      };
    });

    return { ...created, jobs };
  }

  async createImageDownloadUrl({
    userId,
    jobId,
  }: {
    userId: string;
    jobId: string;
  }): Promise<GenerationImageDownloadUrl> {
    const asset = await this.getOwnedImageResultAsset({ jobId, userId });

    const signedUrl = await this.storage.createSignedGetUrlWithExpiration({
      bucket: asset.bucket,
      objectKey: asset.objectKey,
    });

    return {
      url: signedUrl.url,
      contentType: asset.contentType,
    };
  }

  async downloadImage({
    userId,
    jobId,
  }: {
    userId: string;
    jobId: string;
  }): Promise<GenerationImageDownload> {
    const asset = await this.getOwnedImageResultAsset({ jobId, userId });
    const downloaded = await this.storage.downloadObject({
      bucket: asset.bucket,
      objectKey: asset.objectKey,
    });
    const contentType = asset.contentType ?? downloaded.contentType;

    return {
      body: downloaded.body,
      contentLength: asset.contentLength ?? downloaded.contentLength,
      contentType,
      filename: createGeneratedImageFilename({ contentType, jobId }),
    };
  }

  async createVideoGenerationSubmission({
    analyticsContext,
    userId,
    input,
  }: {
    analyticsContext: AnalyticsDeliveryContext;
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
    const providerExecutionMode = this.getVideoProviderExecutionMode(
      modelSpec.adapter,
    );
    const callbackTokens =
      providerExecutionMode === "callback"
        ? [...Array(input.requestedGenerations)].map(() =>
            this.createGenerationCallbackToken(),
          )
        : null;

    this.validateCreateVideoInputAgainstSpec({
      input: {
        ...input,
        ...submittedInput,
      },
      spec: modelSpec.spec,
    });
    this.validateVideoAttachmentsForAdapter({
      adapter: modelSpec.adapter,
      attachmentMedia,
      submittedInput,
    });

    const jobCost = await this.modelRates.estimateGenerationCostForSingleJob(
      this.toEstimateVideoGenerationCostInput({
        attachmentMedia,
        input,
        submittedInput,
      }),
    );
    const generation = this.toGenerationAnalyticsContext({
      modelType: "video",
      modelId: input.modelId,
      modelSpecId: modelSpec.id,
      requestedGenerations: input.requestedGenerations,
      submittedInput,
      attachmentMedia,
    });
    const targetType = this.getGenerationTargetType(input);

    try {
      const createdSubmission = await this.persistGenerationSubmission({
        analyticsContext,
        userId,
        input,
        modelSpec,
        submittedInput,
        attachmentMedia,
        ...(callbackTokens
          ? {
              callbackTokenHashes: callbackTokens.map((callbackToken) =>
                this.hashGenerationCallbackToken(callbackToken),
              ),
            }
          : {}),
        jobCost,
      });

      if (createdSubmission.submission.modelType !== "video") {
        throw new Error("Video submission was created with a non-video model");
      }

      this.analytics.track(
        {
          type: "generation_submission_created",
          userId,
          occurredAt: createdSubmission.submission.createdAt,
          submissionId: createdSubmission.submission.id,
          generation,
          targetType,
          estimatedCostUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
          estimatedCostUsdMicrosTotal:
            jobCost.estimatedCostUsdMicros * input.requestedGenerations,
        },
        analyticsContext,
      );

      return {
        submission: createdSubmission.submission,
        jobs: createdSubmission.jobs.map((job, index) =>
          providerExecutionMode === "callback"
            ? {
                job,
                providerExecution: {
                  mode: "callback" as const,
                  callbackToken: callbackTokens![index]!,
                },
              }
            : {
                job,
                providerExecution: { mode: "polling" as const },
              },
        ),
        createdThread: createdSubmission.createdThread,
      };
    } catch (error) {
      if (error instanceof InsufficientCreditBalanceError) {
        this.analytics.track(
          {
            type: "insufficient_credits_encountered",
            userId,
            occurredAt: new Date(),
            generation,
            targetType,
            requiredCreditUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
            requiredCreditUsdMicrosTotal:
              jobCost.estimatedCostUsdMicros * input.requestedGenerations,
          },
          analyticsContext,
        );
      }

      throw error;
    }
  }

  async createImageGenerationSubmission({
    analyticsContext,
    userId,
    input,
  }: {
    analyticsContext: AnalyticsDeliveryContext;
    userId: string;
    input: CreateImageGenerationInput;
  }): Promise<CreatedImageGenerationSubmission> {
    this.validateRequestedGenerations(input.requestedGenerations);

    const modelSpec = await this.getPublishedSupportedImageModelSpec({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
    });
    const submittedInput = this.toSubmittedImageInput(input);
    const attachmentMedia =
      await this.attachmentMedia.resolveSelectionForSubmission({
        input: input.attachmentMedia,
        spec: modelSpec.spec,
        userId,
      });

    this.validateCreateImageInputAgainstSpec({
      input: {
        ...input,
        ...submittedInput,
      },
      spec: modelSpec.spec,
    });

    const jobCost = await this.modelRates.estimateGenerationCostForSingleJob(
      this.toEstimateImageGenerationCostInput({
        attachmentMedia,
        input,
        submittedInput,
      }),
    );
    const generation = this.toGenerationAnalyticsContext({
      modelType: "image",
      modelId: input.modelId,
      modelSpecId: modelSpec.id,
      requestedGenerations: input.requestedGenerations,
      submittedInput,
      attachmentMedia,
    });
    const targetType = this.getGenerationTargetType(input);

    try {
      const createdSubmission = await this.persistGenerationSubmission({
        analyticsContext,
        userId,
        input,
        modelSpec,
        submittedInput,
        attachmentMedia,
        jobCost,
      });

      if (createdSubmission.submission.modelType !== "image") {
        throw new Error("Image submission was created with a non-image model");
      }

      this.analytics.track(
        {
          type: "generation_submission_created",
          userId,
          occurredAt: createdSubmission.submission.createdAt,
          submissionId: createdSubmission.submission.id,
          generation,
          targetType,
          estimatedCostUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
          estimatedCostUsdMicrosTotal:
            jobCost.estimatedCostUsdMicros * input.requestedGenerations,
        },
        analyticsContext,
      );

      return {
        submission: createdSubmission.submission,
        jobs: createdSubmission.jobs,
        createdThread: createdSubmission.createdThread,
      };
    } catch (error) {
      if (error instanceof InsufficientCreditBalanceError) {
        this.analytics.track(
          {
            type: "insufficient_credits_encountered",
            userId,
            occurredAt: new Date(),
            generation,
            targetType,
            requiredCreditUsdMicrosPerOutput: jobCost.estimatedCostUsdMicros,
            requiredCreditUsdMicrosTotal:
              jobCost.estimatedCostUsdMicros * input.requestedGenerations,
          },
          analyticsContext,
        );
      }

      throw error;
    }
  }

  private async persistGenerationSubmission({
    analyticsContext,
    userId,
    input,
    modelSpec,
    submittedInput,
    attachmentMedia,
    callbackTokenHashes,
    jobCost,
  }: {
    analyticsContext: AnalyticsDeliveryContext;
    userId: string;
    input: CreateGenerationInputBase;
    modelSpec: GenerationModelSpecRecord;
    submittedInput: GenerationSubmissionInput;
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
    callbackTokenHashes?: string[];
    jobCost: GenerationJobCost;
  }) {
    return this.transactionManager.transaction(async (tx) => {
      const createdThread = input.threadId
        ? null
        : await tx.generationThread.createThread({
            userId,
            name: createProvisionalGenerationThreadName(submittedInput.prompt),
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
        modelId: input.modelId,
        modelSpecId: modelSpec.id,
        modelType: modelSpec.modelType,
        providerId: modelSpec.providerId,
        providerModelId: modelSpec.spec.providerModelId,
        submittedInput,
        requestedGenerations: input.requestedGenerations,
        attachmentMedia,
        ...(callbackTokenHashes ? { callbackTokenHashes } : {}),
      });

      for (const job of created.jobs) {
        const cost = await tx.modelRates.createGenerationJobCostWithEstimate({
          jobId: job.id,
          estimatedCostUsdMicros: jobCost.estimatedCostUsdMicros,
          currencyCode: jobCost.currencyCode,
          estimatedCostSnapshot: jobCost.estimatedCostSnapshot,
        });
        await tx.services.credits.reserveGenerationJobCostEstimate({
          analyticsContext,
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
    });
  }

  private toEstimateVideoGenerationCostInput({
    attachmentMedia,
    input,
    submittedInput,
  }: {
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
    input: CreateVideoGenerationInput;
    submittedInput: VideoGenerationSubmissionInput;
  }): EstimateGenerationCostInput {
    return {
      modelType: "video",
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      resolution: submittedInput.resolution,
      aspectRatio: submittedInput.aspectRatio,
      duration: submittedInput.duration,
      generateAudio: submittedInput.generateAudio,
      draft: submittedInput.draft,
      requestedGenerations: input.requestedGenerations,
      attachmentMedia:
        this.toEstimateGenerationCostAttachmentMedia(attachmentMedia),
    };
  }

  private toEstimateImageGenerationCostInput({
    attachmentMedia,
    input,
    submittedInput,
  }: {
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
    input: CreateImageGenerationInput;
    submittedInput: ImageGenerationSubmissionInput;
  }): EstimateGenerationCostInput {
    return {
      modelType: "image",
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
      resolution: submittedInput.resolution,
      aspectRatio: submittedInput.aspectRatio,
      prompt: submittedInput.prompt,
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
        ...(media.fieldId === "videos"
          ? { durationSec: this.getAttachmentVideoDurationSeconds(media) }
          : {}),
      });
    }

    return estimateAttachmentMedia;
  }

  private getAttachmentVideoDurationSeconds(
    media: StoredGenerationAttachmentMediaWithPosition,
  ) {
    if (media.metadata.durationSec === null) {
      throw new GenerationInputValidationError(
        "videos",
        "duration could not be detected",
      );
    }

    return media.metadata.durationSec;
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
        case "bfl_flux_3_video":
          if (input.draftEnhancementSourceJobId) {
            input = {
              ...input,
              draftCacheBase64: await this.resolveDraftEnhancementCache({
                sourceJobId: input.draftEnhancementSourceJobId,
                targetJobId: input.jobId,
              }),
            };
          }
          providerTask = await this.bfl.createVideoTask({
            spec: modelSpec.spec,
            input,
          });
          break;
        case "byteplus_seedance_video":
          providerTask = await this.bytePlus.createVideoTask({
            spec: modelSpec.spec,
            input: this.requireCallbackUrl(input),
          });
          break;
        case "kling_v3_text_to_video":
          providerTask = await this.kling.createVideoTask({
            spec: modelSpec.spec,
            input: this.requireCallbackUrl(input),
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

  async pollVideoTask(
    input: PollVideoTaskInput,
  ): Promise<GenerationProviderCallback> {
    const modelSpec = await this.getRunnableSupportedVideoModelSpec({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
    });

    if (modelSpec.adapter !== "bfl_flux_3_video") {
      throw new UnsupportedGenerationModelError(input.modelId);
    }

    const rawPayload = await this.bfl.retrieveVideoTask(input.pollingUrl);
    const receivedAt = new Date().toISOString();

    try {
      return {
        kind: "result",
        result: this.bfl.normalizeVideoTaskResult({
          expectedProviderTaskId: input.providerTaskId,
          providerModelId: modelSpec.spec.providerModelId ?? "latest",
          expectsDraftCache: input.expectsDraftCache,
          value: rawPayload,
        }),
        rawPayload,
        receivedAt,
      };
    } catch (error) {
      if (!(error instanceof BflPayloadError)) {
        throw error;
      }

      return {
        kind: "malformed",
        terminalError: {
          source: "provider",
          code: "MALFORMED_PROVIDER_RESULT",
          message: error.message,
        },
        rawPayload,
        receivedAt,
      };
    }
  }

  async createImageTask(
    input: CreateImageTaskInput,
  ): Promise<CreateImageTaskResult> {
    const modelSpec = await this.getRunnableSupportedImageModelSpec({
      modelId: input.modelId,
      modelSpecId: input.modelSpecId,
    });
    const startedAt = Date.now();

    try {
      let providerTask: CreateImageTaskResult;

      switch (modelSpec.adapter) {
        case "google_gemini_interactions_image":
          providerTask = await this.google.generateImage({
            jobId: input.jobId,
            spec: modelSpec.spec,
            input: {
              submittedInput: input.submittedInput,
              attachmentMedia: input.attachmentMedia,
            },
          });
          break;
        case "openai_gpt_image_2":
          providerTask = await this.openAI.generateImage({
            jobId: input.jobId,
            spec: modelSpec.spec,
            input: {
              submittedInput: input.submittedInput,
              attachmentMedia: input.attachmentMedia,
            },
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
        ...toGoogleProviderErrorLogFields(error),
        ...toOpenAIProviderErrorLogFields(error),
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
        case "bfl_flux_3_video":
          throw new UnsupportedGenerationModelError(modelId);
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
    input: FinalizeUnsuccessfulGenerationJobInput & {
      analyticsContext?: AnalyticsDeliveryContext;
    },
  ): Promise<GenerationJobRecord> {
    const analyticsContext = input.analyticsContext ?? { suppressed: false };
    let jobContext: GenerationJobWithSubmissionContext | null = null;
    let shouldTrack = false;
    const finalizedJob = await this.transactionManager.transaction(
      async (tx) => {
        const job = await tx.generation.getGenerationJobById(input.jobId);

        if (!job) {
          throw new Error(`Generation job was not found: ${input.jobId}`);
        }
        jobContext = job;
        shouldTrack = !isTerminalGenerationJobStatus(job.status);

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
          analyticsContext,
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
      this.trackGenerationJobOutcome(
        finalizedJob,
        jobContextForLog,
        analyticsContext,
      );
    }

    return finalizedJob;
  }

  async markGenerationJobSucceeded({
    analyticsContext = { suppressed: false },
    jobId,
  }: {
    analyticsContext?: AnalyticsDeliveryContext;
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
        shouldTrack = !isTerminalGenerationJobStatus(job.status);
        await tx.services.modelRateLimits.releaseJobConcurrencyLeases({
          jobId,
        });

        return tx.generation.markGenerationJobSucceeded({ jobId });
      },
    );
    const context = jobContext as GenerationJobWithSubmissionContext | null;

    if (shouldTrack && context) {
      this.trackGenerationJobOutcome(finalizedJob, context, analyticsContext);
    }

    return finalizedJob;
  }

  async markGenerationJobFinalCostCalculationFailed({
    analyticsContext = { suppressed: false },
    jobId,
    terminalError,
  }: {
    analyticsContext?: AnalyticsDeliveryContext;
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
        shouldTrack = !isTerminalGenerationJobStatus(job.status);
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
      this.trackGenerationJobOutcome(finalizedJob, context, analyticsContext);
    }

    return finalizedJob;
  }

  private trackGenerationJobOutcome(
    job: GenerationJobRecord,
    context: GenerationJobWithSubmissionContext,
    analyticsContext: AnalyticsDeliveryContext,
  ): void {
    if (!job.terminalAt) {
      return;
    }

    const input = {
      userId: context.userId,
      occurredAt: job.terminalAt,
      jobId: job.id,
      generation: this.toGenerationAnalyticsContext({
        modelType: context.modelType,
        modelId: context.modelId,
        modelSpecId: context.modelSpecId,
        requestedGenerations: context.requestedGenerations,
        submittedInput: context.submittedInput,
        attachmentMedia: context.attachmentMedia,
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
      this.analytics.track(
        {
          type: "generation_job_succeeded",
          ...input,
        },
        analyticsContext,
      );
      return;
    }

    if (
      job.status === "failed" ||
      job.status === "cancelled" ||
      job.status === "expired" ||
      job.status === "final_cost_calculation_failure"
    ) {
      this.analytics.track(
        {
          type: "generation_job_failed",
          ...input,
          terminalStatus: job.status,
          errorSource: job.terminalError?.source,
          errorCode: job.terminalError?.code ?? undefined,
        },
        analyticsContext,
      );
    }
  }

  private toGenerationAnalyticsContext({
    modelType,
    modelId,
    modelSpecId,
    requestedGenerations,
    submittedInput,
    attachmentMedia,
  }: {
    modelType: "video" | "image";
    modelId: string;
    modelSpecId: string;
    requestedGenerations: number;
    submittedInput: GenerationSubmissionInput;
    attachmentMedia: readonly { kind: "image" | "video" | "audio" }[];
  }): GenerationAnalyticsContext {
    return {
      modelType,
      modelId,
      modelSpecId,
      requestedOutputCount: requestedGenerations,
      resolution: submittedInput.resolution,
      aspectRatio: submittedInput.aspectRatio,
      ...(modelType === "video" && "duration" in submittedInput
        ? {
            generationDurationSeconds: submittedInput.duration,
            generateAudio: submittedInput.generateAudio,
          }
        : {}),
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
    input: Pick<CreateGenerationInputBase, "threadId" | "projectId">,
  ): GenerationTargetType {
    if (input.threadId) {
      return "existing_thread";
    }

    return input.projectId ? "new_project_thread" : "new_unprojected_thread";
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

  private async getOwnedImageResultAsset({
    jobId,
    userId,
  }: {
    jobId: string;
    userId: string;
  }) {
    const context = await this.repository.getImageResultAssetForJob(jobId);

    if (
      !context ||
      context.userId !== userId ||
      context.status !== "succeeded" ||
      !context.asset
    ) {
      throw new GenerationImageDownloadNotFoundError();
    }

    return context.asset;
  }

  private toRetryAttachmentMediaInput(
    attachmentMedia: GenerationThreadAttachmentMediaValue,
  ): GenerationAttachmentMediaInput {
    return {
      images: attachmentMedia.images.map(({ id, role }) => ({ id, role })),
      videos: attachmentMedia.videos.map(({ id, role }) => {
        if (role !== "reference") {
          throw new Error("Stored video attachment has an invalid role");
        }

        return { id, role };
      }),
      audios: attachmentMedia.audios.map(({ id, role }) => {
        if (role !== "reference") {
          throw new Error("Stored audio attachment has an invalid role");
        }

        return { id, role };
      }),
    };
  }

  private async prepareDraftEnhancement({
    submissionId,
    sourceJobId,
    userId,
  }: {
    submissionId: string;
    sourceJobId?: string;
    userId: string;
  }) {
    const submission = await this.repository.getGenerationSubmissionByIdForUser(
      {
        submissionId,
        userId,
      },
    );

    if (!submission) {
      throw new GenerationSubmissionNotFoundError();
    }

    if (submission.modelType !== "video" || !submission.submittedInput.draft) {
      throw new GenerationDraftEnhancementUnavailableError();
    }

    const modelSpec = await this.repository.getPublishedGenerationModelSpecById(
      {
        modelId: submission.modelId,
        modelSpecId: submission.modelSpecId,
      },
    );

    if (
      !modelSpec ||
      modelSpec.modelType !== "video" ||
      modelSpec.adapter !== "bfl_flux_3_video"
    ) {
      throw new GenerationDraftEnhancementUnavailableError(
        "This draft's model is no longer available",
      );
    }

    const sourceJobs =
      await this.repository.listGenerationDraftEnhancementSourceJobs({
        submissionId,
      });

    let eligibleSourceJobs: GenerationDraftEnhancementSourceJob[];

    if (sourceJobId) {
      const selectedSourceJob = sourceJobs.find(
        (job) => job.jobId === sourceJobId,
      );

      if (
        !selectedSourceJob ||
        selectedSourceJob.status !== "succeeded" ||
        !selectedSourceJob.draftCache
      ) {
        throw new GenerationDraftEnhancementUnavailableError(
          "This draft is not available to enhance",
        );
      }

      eligibleSourceJobs = [selectedSourceJob];
    } else {
      if (
        sourceJobs.length === 0 ||
        sourceJobs.some((job) => !isTerminalGenerationJobStatus(job.status))
      ) {
        throw new GenerationDraftEnhancementUnavailableError(
          "Wait for every draft job to finish before enhancing",
        );
      }

      eligibleSourceJobs = sourceJobs.filter(
        (job) => job.status === "succeeded" && job.draftCache,
      );
    }

    if (eligibleSourceJobs.length === 0) {
      throw new GenerationDraftEnhancementUnavailableError(
        "No completed drafts are available to enhance",
      );
    }

    const attachmentMediaInput = this.toRetryAttachmentMediaInput(
      submission.attachmentMedia,
    );
    const attachmentMedia =
      await this.attachmentMedia.resolveSelectionForSubmission({
        input: attachmentMediaInput,
        spec: modelSpec.spec,
        userId,
      });
    const input: CreateVideoGenerationInput = {
      modelId: submission.modelId,
      modelSpecId: submission.modelSpecId,
      threadId: submission.threadId,
      requestedGenerations: eligibleSourceJobs.length,
      attachmentMedia: attachmentMediaInput,
      ...submission.submittedInput,
      draft: false,
    };

    return {
      attachmentMedia,
      input,
      sourceJobs: eligibleSourceJobs,
      submission,
    };
  }

  private async resolveDraftEnhancementCache({
    sourceJobId,
    targetJobId,
  }: {
    sourceJobId: string;
    targetJobId: string;
  }) {
    const [sourceJob, targetJob, draftCache] = await Promise.all([
      this.repository.getGenerationJobById(sourceJobId),
      this.repository.getGenerationJobById(targetJobId),
      this.repository.getGenerationDraftCacheByJobId(sourceJobId),
    ]);

    if (
      !sourceJob ||
      !targetJob ||
      !draftCache ||
      sourceJob.modelType !== "video" ||
      targetJob.modelType !== "video" ||
      sourceJob.status !== "succeeded" ||
      !sourceJob.submittedInput.draft ||
      targetJob.submittedInput.draft ||
      sourceJob.userId !== targetJob.userId ||
      sourceJob.threadId !== targetJob.threadId ||
      sourceJob.modelId !== targetJob.modelId ||
      sourceJob.modelSpecId !== targetJob.modelSpecId
    ) {
      throw new GenerationDraftEnhancementUnavailableError();
    }

    const downloadedCache = await this.storage.downloadObject({
      bucket: draftCache.bucket,
      objectKey: draftCache.objectKey,
    });
    const chunks: Buffer[] = [];

    for await (const chunk of downloadedCache.body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks).toString("base64");
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

  private async getPublishedSupportedImageModelSpec({
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

    this.assertSupportedImageModelSpec(modelSpec);
    return modelSpec;
  }

  private async getRunnableSupportedImageModelSpec({
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

    this.assertSupportedImageModelSpec(modelSpec);
    return modelSpec;
  }

  private assertSupportedVideoModelSpec(
    modelSpec: GenerationModelSpecRecord,
  ): asserts modelSpec is Extract<
    GenerationModelSpecRecord,
    { modelType: "video" }
  > & {
    adapter:
      | "bfl_flux_3_video"
      | "byteplus_seedance_video"
      | "kling_v3_text_to_video";
  } {
    if (modelSpec.modelType !== "video") {
      throw new GenerationModelTypeMismatchError(
        modelSpec.modelId,
        "video",
        modelSpec.modelType,
      );
    }

    if (
      modelSpec.adapter !== "bfl_flux_3_video" &&
      modelSpec.adapter !== "byteplus_seedance_video" &&
      modelSpec.adapter !== "kling_v3_text_to_video"
    ) {
      throw new UnsupportedGenerationModelError(modelSpec.modelId);
    }
  }

  private getVideoProviderExecutionMode(
    adapter:
      | "bfl_flux_3_video"
      | "byteplus_seedance_video"
      | "kling_v3_text_to_video",
  ): "callback" | "polling" {
    return adapter === "bfl_flux_3_video" ? "polling" : "callback";
  }

  private requireCallbackUrl(
    input: CreateVideoTaskInput,
  ): CreateVideoTaskInput & { callbackUrl: string } {
    if (!input.callbackUrl) {
      throw new GenerationInputValidationError(
        "callbackUrl",
        "callbackUrl is required for this provider",
      );
    }

    return { ...input, callbackUrl: input.callbackUrl };
  }

  private validateVideoAttachmentsForAdapter({
    adapter,
    attachmentMedia,
    submittedInput,
  }: {
    adapter:
      | "bfl_flux_3_video"
      | "byteplus_seedance_video"
      | "kling_v3_text_to_video";
    attachmentMedia: StoredGenerationAttachmentMediaWithPosition[];
    submittedInput: VideoGenerationSubmissionInput;
  }) {
    if (adapter !== "bfl_flux_3_video") {
      return;
    }

    const imageCount = attachmentMedia.filter(
      (attachment) => attachment.kind === "image",
    ).length;
    const videoCount = attachmentMedia.filter(
      (attachment) => attachment.kind === "video",
    ).length;
    const audioCount = attachmentMedia.filter(
      (attachment) => attachment.kind === "audio",
    ).length;

    if (imageCount > 0 && videoCount > 0) {
      throw new GenerationInputValidationError(
        "attachmentMedia",
        "FLUX 3 images and video continuation input cannot be combined",
      );
    }

    if (imageCount > 10) {
      throw new GenerationInputValidationError(
        "images",
        "FLUX 3 supports at most 10 keyframe images",
      );
    }

    if (videoCount > 1) {
      throw new GenerationInputValidationError(
        "videos",
        "FLUX 3 supports exactly one video continuation input",
      );
    }

    if (videoCount > 0 && submittedInput.duration > 15) {
      throw new GenerationInputValidationError(
        "duration",
        "FLUX 3 video continuation supports durations from 5 to 15 seconds",
      );
    }

    if (audioCount > 0) {
      throw new GenerationInputValidationError(
        "audios",
        "FLUX 3 does not support audio attachments",
      );
    }
  }

  private assertSupportedImageModelSpec(
    modelSpec: GenerationModelSpecRecord,
  ): asserts modelSpec is Extract<
    GenerationModelSpecRecord,
    { modelType: "image" }
  > & {
    adapter: "google_gemini_interactions_image" | "openai_gpt_image_2";
  } {
    if (modelSpec.modelType !== "image") {
      throw new GenerationModelTypeMismatchError(
        modelSpec.modelId,
        "image",
        modelSpec.modelType,
      );
    }

    if (
      modelSpec.adapter !== "google_gemini_interactions_image" &&
      modelSpec.adapter !== "openai_gpt_image_2"
    ) {
      throw new UnsupportedGenerationModelError(modelSpec.modelId);
    }
  }

  private toSubmittedInput(
    input: CreateVideoGenerationInput,
  ): VideoGenerationSubmissionInput {
    return {
      prompt: input.prompt.trim(),
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
      draft: input.draft ?? false,
    };
  }

  private toSubmittedImageInput(
    input: CreateImageGenerationInput,
  ): ImageGenerationSubmissionInput {
    return {
      prompt: input.prompt.trim(),
      resolution: input.resolution,
      aspectRatio: input.aspectRatio,
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

    const draftField = spec.fields.find((field) => field.id === "draft");
    if (draftField) {
      this.validateFieldValue({
        field: draftField,
        value: input.draft ?? false,
      });
    } else if (input.draft) {
      throw new GenerationInputValidationError(
        "draft",
        "draft is not supported by this model",
      );
    }
  }

  private validateCreateImageInputAgainstSpec({
    input,
    spec,
  }: {
    input: CreateImageGenerationInput;
    spec: ImageModelSpec;
  }) {
    for (const fieldId of createImageGenerationFieldIds) {
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
    spec: GenerationModelSpec,
    fieldId: CreateVideoGenerationFieldId | CreateImageGenerationFieldId,
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
    field: GenerationFieldSpec;
    value: JsonPrimitive;
  }) {
    this.validateFieldValueKind(field, value);
    this.validateFieldBounds(field, value);
    this.validateFieldOptions(field, value);
  }

  private validateFieldValueKind(
    field: GenerationFieldSpec,
    value: JsonPrimitive,
  ) {
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

  private validateFieldBounds(
    field: GenerationFieldSpec,
    value: JsonPrimitive,
  ) {
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

  private validateFieldOptions(
    field: GenerationFieldSpec,
    value: JsonPrimitive,
  ) {
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

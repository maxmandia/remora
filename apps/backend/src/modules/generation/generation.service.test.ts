import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import { GenerationAttachmentMediaValidationError } from "../generation-attachment-media/generation-attachment-media.types.ts";
import { GoogleProviderError } from "./providers/google/google.types.ts";
import { GenerationService } from "./generation.service.ts";
import {
  GenerationDraftEnhancementUnavailableError,
  GenerationImageDownloadNotFoundError,
  GenerationInputValidationError,
  GenerationModelTypeMismatchError,
  GenerationSubmissionNotFoundError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type {
  ImageModelSpec,
  GenerationFieldSpec,
  VideoModelSpec,
} from "../model/model.types.ts";
import type {
  CreateImageGenerationInput,
  CreateImageTaskInput,
  CreateVideoGenerationInput,
  CreateVideoTaskInput,
  FinalizeUnsuccessfulGenerationJobInput,
  VideoGenerationThreadSubmission,
} from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  createBflVideoTask: vi.fn(),
  downloadObject: vi.fn(),
  createSignedGetUrlWithExpiration: vi.fn(),
  createKlingVideoTask: vi.fn(),
  generateImage: vi.fn(),
  generateOpenAIImage: vi.fn(),
  createVideoTask: vi.fn(),
  trackAnalytics: vi.fn(),
  createThread: vi.fn(),
  getPublishedGenerationModelSpecById: vi.fn(),
  getRunnableGenerationModelSpecById: vi.fn(),
  estimateGenerationCostForSingleJob: vi.fn(),
  insertGenerationSubmission: vi.fn(),
  createGenerationJobCostWithEstimate: vi.fn(),
  getGenerationJobById: vi.fn(),
  getImageResultAssetForJob: vi.fn(),
  getGenerationSubmissionByIdForUser: vi.fn(),
  getGenerationDraftCacheByJobId: vi.fn(),
  listGenerationDraftEnhancementSourceJobs: vi.fn(),
  getGenerationJobCostByJobId: vi.fn(),
  listSubmissionsFromThread: vi.fn(),
  markGenerationJobFinalCostCalculationFailed: vi.fn(),
  markGenerationJobCancelled: vi.fn(),
  markGenerationJobExpired: vi.fn(),
  markGenerationJobFailed: vi.fn(),
  markGenerationJobSucceeded: vi.fn(),
  normalizeVideoTaskResult: vi.fn(),
  normalizeKlingVideoTaskResult: vi.fn(),
  normalizeBflVideoTaskResult: vi.fn(),
  retrieveBflVideoTask: vi.fn(),
  releaseGenerationJobCostReservation: vi.fn(),
  releaseJobConcurrencyLeases: vi.fn(),
  resolveSelectionForSubmission: vi.fn(),
  reserveGenerationJobCostEstimate: vi.fn(),
  touchOwnedThread: vi.fn(),
  transaction: vi.fn(),
  logGenerationLifecycleEvent: vi.fn(),
}));

vi.mock("../storage/object-storage.service.ts", () => ({
  ObjectStorageService: class {
    static joinObjectKey(...segments: string[]) {
      return segments
        .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/");
    }
  },
  objectStorageService: {
    createSignedGetUrlWithExpiration: mocks.createSignedGetUrlWithExpiration,
    downloadObject: mocks.downloadObject,
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getPublishedGenerationModelSpecById:
      mocks.getPublishedGenerationModelSpecById,
    getRunnableGenerationModelSpecById:
      mocks.getRunnableGenerationModelSpecById,
    getImageResultAssetForJob: mocks.getImageResultAssetForJob,
    getGenerationSubmissionByIdForUser:
      mocks.getGenerationSubmissionByIdForUser,
    getGenerationDraftCacheByJobId: mocks.getGenerationDraftCacheByJobId,
    getGenerationJobById: mocks.getGenerationJobById,
    listGenerationDraftEnhancementSourceJobs:
      mocks.listGenerationDraftEnhancementSourceJobs,
    insertGenerationSubmission: mocks.insertGenerationSubmission,
    listSubmissionsFromThread: mocks.listSubmissionsFromThread,
  },
}));

vi.mock("./generation.observability.ts", () => ({
  logGenerationLifecycleEvent: mocks.logGenerationLifecycleEvent,
}));

describe("generation service", () => {
  let generationService: GenerationService;

  beforeEach(() => {
    mocks.createBflVideoTask.mockReset();
    mocks.createSignedGetUrlWithExpiration.mockReset();
    mocks.downloadObject.mockReset();
    mocks.createKlingVideoTask.mockReset();
    mocks.generateImage.mockReset();
    mocks.generateOpenAIImage.mockReset();
    mocks.createVideoTask.mockReset();
    mocks.trackAnalytics.mockReset();
    mocks.createThread.mockReset();
    mocks.getPublishedGenerationModelSpecById.mockReset();
    mocks.getRunnableGenerationModelSpecById.mockReset();
    mocks.estimateGenerationCostForSingleJob.mockReset();
    mocks.insertGenerationSubmission.mockReset();
    mocks.createGenerationJobCostWithEstimate.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.getImageResultAssetForJob.mockReset();
    mocks.getGenerationSubmissionByIdForUser.mockReset();
    mocks.getGenerationDraftCacheByJobId.mockReset();
    mocks.listGenerationDraftEnhancementSourceJobs.mockReset();
    mocks.getGenerationJobCostByJobId.mockReset();
    mocks.listSubmissionsFromThread.mockReset();
    mocks.markGenerationJobFinalCostCalculationFailed.mockReset();
    mocks.markGenerationJobCancelled.mockReset();
    mocks.markGenerationJobExpired.mockReset();
    mocks.markGenerationJobFailed.mockReset();
    mocks.markGenerationJobSucceeded.mockReset();
    mocks.normalizeVideoTaskResult.mockReset();
    mocks.normalizeKlingVideoTaskResult.mockReset();
    mocks.normalizeBflVideoTaskResult.mockReset();
    mocks.retrieveBflVideoTask.mockReset();
    mocks.releaseGenerationJobCostReservation.mockReset();
    mocks.releaseJobConcurrencyLeases.mockReset();
    mocks.resolveSelectionForSubmission.mockReset();
    mocks.reserveGenerationJobCostEstimate.mockReset();
    mocks.touchOwnedThread.mockReset();
    mocks.transaction.mockReset();
    mocks.logGenerationLifecycleEvent.mockReset();
    mocks.transaction.mockImplementation(
      async (callback: (tx: TransactionManager) => Promise<unknown>) =>
        callback({
          generation: {
            getGenerationJobById: mocks.getGenerationJobById,
            insertGenerationSubmission: mocks.insertGenerationSubmission,
            markGenerationJobCancelled: mocks.markGenerationJobCancelled,
            markGenerationJobExpired: mocks.markGenerationJobExpired,
            markGenerationJobFailed: mocks.markGenerationJobFailed,
            markGenerationJobFinalCostCalculationFailed:
              mocks.markGenerationJobFinalCostCalculationFailed,
            markGenerationJobSucceeded: mocks.markGenerationJobSucceeded,
          },
          generationThread: {
            createThread: mocks.createThread,
            touchOwnedThread: mocks.touchOwnedThread,
          },
          modelRates: {
            createGenerationJobCostWithEstimate:
              mocks.createGenerationJobCostWithEstimate,
            getGenerationJobCostByJobId: mocks.getGenerationJobCostByJobId,
          },
          services: {
            credits: {
              releaseGenerationJobCostReservation:
                mocks.releaseGenerationJobCostReservation,
              reserveGenerationJobCostEstimate:
                mocks.reserveGenerationJobCostEstimate,
            },
            modelRateLimits: {
              releaseJobConcurrencyLeases: mocks.releaseJobConcurrencyLeases,
            },
          },
        } as unknown as TransactionManager),
    );
    mocks.createSignedGetUrlWithExpiration.mockImplementation(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
    mocks.createThread.mockImplementation(
      async ({
        name,
        projectId = null,
      }: {
        name: string;
        projectId?: string | null;
      }) => createGenerationThreadRecord({ name, projectId }),
    );
    mocks.touchOwnedThread.mockResolvedValue(undefined);
    mocks.getPublishedGenerationModelSpecById.mockImplementation(
      async ({
        modelId,
        modelSpecId,
      }: {
        modelId: string;
        modelSpecId: string;
      }) => {
        if (
          modelId === "seedance-2.0-fast-video" &&
          modelSpecId === "seedance-2.0-fast-video-v1"
        ) {
          return createPublishedModelSpec({
            id: modelSpecId,
            modelId,
            spec: createSeedanceFastSpec(),
          });
        }

        if (
          modelId === "seedance-2.0-video" &&
          modelSpecId === "seedance-2.0-video-v1"
        ) {
          return createPublishedModelSpec();
        }

        return null;
      },
    );
    mocks.getRunnableGenerationModelSpecById.mockImplementation(
      async ({
        modelId,
        modelSpecId,
      }: {
        modelId: string;
        modelSpecId: string;
      }) => mocks.getPublishedGenerationModelSpecById({ modelId, modelSpecId }),
    );
    mocks.insertGenerationSubmission.mockResolvedValue({
      submission: createSubmission(),
      jobs: [createJob()],
    });
    mocks.estimateGenerationCostForSingleJob.mockResolvedValue(
      createGenerationJobCostWithEstimate(),
    );
    mocks.createGenerationJobCostWithEstimate.mockImplementation(
      async (input: { jobId: string }) =>
        createPersistedGenerationJobCost({
          ...input,
          id: `${input.jobId}_estimate`,
        }),
    );
    mocks.getGenerationJobById.mockResolvedValue(
      createJob({
        threadId: "thread_1",
        userId: "user_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        submittedInput: createSubmission().submittedInput,
        requestedGenerations: 1,
        attachmentMedia: [],
      }),
    );
    mocks.getGenerationJobCostByJobId.mockResolvedValue(
      createPersistedGenerationJobCost(),
    );
    mocks.markGenerationJobCancelled.mockResolvedValue(
      createJob({
        status: "cancelled",
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      }),
    );
    mocks.markGenerationJobExpired.mockResolvedValue(
      createJob({
        status: "expired",
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      }),
    );
    mocks.markGenerationJobFailed.mockResolvedValue(
      createJob({
        status: "failed",
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      }),
    );
    mocks.markGenerationJobSucceeded.mockResolvedValue(
      createJob({
        status: "succeeded",
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      }),
    );
    mocks.markGenerationJobFinalCostCalculationFailed.mockResolvedValue(
      createJob({
        status: "final_cost_calculation_failure",
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      }),
    );
    mocks.createVideoTask.mockResolvedValue({
      provider: "byteplus",
      providerTaskId: "cgt-fast",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
      pollingUrl: null,
    });
    mocks.createBflVideoTask.mockResolvedValue({
      provider: "bfl",
      providerTaskId: "bfl-task-1",
      providerModelId: "latest",
      pollingUrl: "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
    });
    mocks.createKlingVideoTask.mockResolvedValue({
      provider: "kling",
      providerTaskId: "kling-task-1",
      providerModelId: "kling-v3",
      pollingUrl: null,
    });
    mocks.generateImage.mockResolvedValue({
      provider: "google",
      providerTaskId: "interaction_123",
      providerModelId: "gemini-3.1-flash-image",
      image: {
        data: Buffer.from("image"),
        contentType: "image/jpeg",
        contentLength: 5,
      },
      usage: null,
      rawPayload: {
        id: "interaction_123",
        status: "completed",
      },
      receivedAt: "2026-06-05T00:00:05.000Z",
    });
    mocks.generateOpenAIImage.mockResolvedValue({
      provider: "openai",
      providerTaskId: "openai-stateless:image_job_1",
      providerModelId: "gpt-image-2-2026-04-21",
      image: {
        data: Buffer.from("image"),
        contentType: "image/jpeg",
        contentLength: 5,
      },
      usage: {
        inputTokens: 10,
        inputTextTokens: 10,
        inputImageTokens: 0,
        outputTextTokens: null,
        outputImageTokens: 7_024,
        thoughtTokens: null,
        totalTokens: 7_034,
      },
      rawPayload: {
        outputFormat: "jpeg",
        quality: "high",
        size: "1024x1024",
      },
      receivedAt: "2026-06-05T00:00:05.000Z",
    });
    mocks.normalizeVideoTaskResult.mockReturnValue({
      provider: "byteplus",
      providerTaskId: "cgt-fast",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
      status: "succeeded",
      videoUrl: "https://assets.example/video.mp4",
      usage: null,
      createdAt: 1780770000,
      updatedAt: 1780770060,
      providerError: null,
    });
    mocks.normalizeKlingVideoTaskResult.mockReturnValue({
      provider: "kling",
      providerTaskId: "kling-task-1",
      providerModelId: "kling-v3",
      status: "succeeded",
      videoUrl: "https://assets.example/kling-video.mp4",
      usage: null,
      createdAt: 1780770000,
      updatedAt: 1780770060,
      providerError: null,
    });
    mocks.releaseGenerationJobCostReservation.mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_2",
    });
    mocks.releaseJobConcurrencyLeases.mockResolvedValue(undefined);
    mocks.reserveGenerationJobCostEstimate.mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 24_580_000,
      reservedCreditAmountUsdMicros: 420_000,
      ledgerEntryId: "ledger_1",
    });
    mocks.resolveSelectionForSubmission.mockResolvedValue([]);
    mocks.getGenerationDraftCacheByJobId.mockResolvedValue(null);
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValue([]);
    mocks.listSubmissionsFromThread.mockResolvedValue([]);
    generationService = createGenerationService();
  });

  it("reconstructs the complete stored video submission for retry", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createSubmission({
        requestedGenerations: 3,
        attachmentMedia: {
          images: [
            {
              id: "first_frame_1",
              kind: "image",
              fieldId: "images",
              role: "firstFrame",
              originalFileName: "first.png",
              contentType: "image/png",
              contentLength: 1024,
              metadata: {
                widthPx: 1280,
                heightPx: 720,
                durationSec: null,
                fps: null,
              },
              createdAt: "2026-06-05T00:00:00.000Z",
            },
          ],
          videos: [
            {
              id: "reference_video_1",
              kind: "video",
              fieldId: "videos",
              role: "reference",
              originalFileName: "motion.mp4",
              contentType: "video/mp4",
              contentLength: 2048,
              metadata: {
                widthPx: 1280,
                heightPx: 720,
                durationSec: 5,
                fps: 24,
              },
              createdAt: "2026-06-05T00:00:00.000Z",
            },
          ],
          audios: [],
        },
      }),
    );

    await expect(
      generationService.getGenerationSubmissionRetryInput({
        submissionId: "submission_1",
        userId: "user_1",
      }),
    ).resolves.toEqual({
      modelType: "video",
      input: {
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        threadId: "thread_1",
        prompt: "Quiet sea",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        draft: false,
        requestedGenerations: 3,
        attachmentMedia: {
          images: [{ id: "first_frame_1", role: "firstFrame" }],
          videos: [{ id: "reference_video_1", role: "reference" }],
          audios: [],
        },
      },
    });
  });

  it("conceals a missing or unowned retry source", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(null);

    await expect(
      generationService.getGenerationSubmissionRetryInput({
        submissionId: "submission_1",
        userId: "other_user",
      }),
    ).rejects.toBeInstanceOf(GenerationSubmissionNotFoundError);
  });

  it("quotes every eligible completed draft at full quality", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ jobId: "source_1", submissionIndex: 0 }),
      createDraftSourceJob({
        jobId: "source_failed",
        status: "failed",
        submissionIndex: 1,
        draftCache: null,
      }),
      createDraftSourceJob({ jobId: "source_3", submissionIndex: 2 }),
    ]);

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        userId: "user_1",
      }),
    ).resolves.toEqual({
      eligibleDraftCount: 2,
      estimatedCostUsdMicros: 924_000,
      currencyCode: "USD",
    });
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        modelId: "flux-3-video",
        modelSpecId: "flux-3-video-v1",
        requestedGenerations: 2,
        resolution: "fhd",
      }),
    );
  });

  it("quotes one selected draft without waiting for sibling jobs", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ jobId: "source_1", submissionIndex: 0 }),
      createDraftSourceJob({
        jobId: "source_2",
        status: "queued",
        submissionIndex: 1,
        draftCache: null,
      }),
    ]);

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        sourceJobId: "source_1",
        userId: "user_1",
      }),
    ).resolves.toEqual({
      eligibleDraftCount: 1,
      estimatedCostUsdMicros: 462_000,
      currencyCode: "USD",
    });
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: false,
        requestedGenerations: 1,
      }),
    );
  });

  it.each([
    ["missing", [createDraftSourceJob({ jobId: "source_2" })]],
    [
      "unsuccessful",
      [
        createDraftSourceJob({
          jobId: "source_1",
          status: "failed",
          draftCache: null,
        }),
      ],
    ],
    [
      "cacheless",
      [createDraftSourceJob({ jobId: "source_1", draftCache: null })],
    ],
  ])("rejects a %s selected draft", async (_label, sourceJobs) => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce(
      sourceJobs,
    );

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        sourceJobId: "source_1",
        userId: "user_1",
      }),
    ).rejects.toBeInstanceOf(GenerationDraftEnhancementUnavailableError);
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
  });

  it("conceals an unowned draft enhancement source", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(null);

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        userId: "other_user",
      }),
    ).rejects.toBeInstanceOf(GenerationSubmissionNotFoundError);
  });

  it("waits for terminal jobs and requires at least one durable draft cache", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValue(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValue(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ status: "queued", draftCache: null }),
    ]);

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        userId: "user_1",
      }),
    ).rejects.toBeInstanceOf(GenerationDraftEnhancementUnavailableError);

    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ status: "succeeded", draftCache: null }),
      createDraftSourceJob({
        jobId: "source_failed",
        submissionIndex: 1,
        status: "failed",
        draftCache: null,
      }),
    ]);

    await expect(
      generationService.getDraftEnhancementQuote({
        submissionId: "submission_1",
        userId: "user_1",
      }),
    ).rejects.toBeInstanceOf(GenerationDraftEnhancementUnavailableError);
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
  });

  it("creates one ordered full-quality enhancement job per eligible draft", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValue(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ jobId: "source_1", submissionIndex: 0 }),
      createDraftSourceJob({ jobId: "source_2", submissionIndex: 1 }),
    ]);
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission: createFluxDraftSubmission({
        id: "enhanced_submission",
        submittedInput: {
          ...createFluxDraftSubmission().submittedInput,
          draft: false,
        },
        requestedGenerations: 2,
      }),
      jobs: [
        createJob({ id: "enhanced_1", providerId: "bfl" }),
        createJob({ id: "enhanced_2", providerId: "bfl", submissionIndex: 1 }),
      ],
    });

    const created = await generationService.createDraftEnhancementSubmission({
      analyticsContext: { suppressed: false },
      submissionId: "submission_1",
      userId: "user_1",
    });

    expect(created.submission.submittedInput.draft).toBe(false);
    expect(created.jobs.map((job) => job.draftEnhancementSourceJobId)).toEqual([
      "source_1",
      "source_2",
    ]);
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledTimes(2);
  });

  it("creates one enhancement job for the selected draft", async () => {
    mocks.getGenerationSubmissionByIdForUser.mockResolvedValueOnce(
      createFluxDraftSubmission(),
    );
    mocks.getPublishedGenerationModelSpecById.mockResolvedValue(
      createPublishedBflModelSpec(),
    );
    mocks.listGenerationDraftEnhancementSourceJobs.mockResolvedValueOnce([
      createDraftSourceJob({ jobId: "source_1", submissionIndex: 0 }),
      createDraftSourceJob({
        jobId: "source_2",
        status: "queued",
        submissionIndex: 1,
        draftCache: null,
      }),
    ]);
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission: createFluxDraftSubmission({
        id: "enhanced_submission",
        submittedInput: {
          ...createFluxDraftSubmission().submittedInput,
          draft: false,
        },
        requestedGenerations: 1,
      }),
      jobs: [createJob({ id: "enhanced_1", providerId: "bfl" })],
    });

    const created = await generationService.createDraftEnhancementSubmission({
      analyticsContext: { suppressed: false },
      submissionId: "submission_1",
      sourceJobId: "source_1",
      userId: "user_1",
    });

    expect(created.submission.requestedGenerations).toBe(1);
    expect(created.jobs).toHaveLength(1);
    expect(created.jobs[0]?.draftEnhancementSourceJobId).toBe("source_1");
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledTimes(1);
  });

  it("creates a fresh signed download URL for an owned successful image", async () => {
    mocks.getImageResultAssetForJob.mockResolvedValue({
      status: "succeeded",
      userId: "user_1",
      asset: {
        bucket: "generation-results",
        contentLength: 12,
        objectKey: "jobs/job_1/image.jpg",
        contentType: "image/jpeg",
      },
    });

    await expect(
      generationService.createImageDownloadUrl({
        userId: "user_1",
        jobId: "job_1",
      }),
    ).resolves.toEqual({
      url: "https://signed.example/jobs/job_1/image.jpg",
      contentType: "image/jpeg",
    });
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "generation-results",
      objectKey: "jobs/job_1/image.jpg",
    });
  });

  it("streams an owned successful image through the storage boundary", async () => {
    const body = Readable.from(Buffer.from("image-bytes"));

    mocks.getImageResultAssetForJob.mockResolvedValue({
      status: "succeeded",
      userId: "user_1",
      asset: {
        bucket: "generation-results",
        contentLength: 11,
        objectKey: "jobs/job_1/image",
        contentType: "image/png",
      },
    });
    mocks.downloadObject.mockResolvedValue({
      body,
      contentLength: null,
      contentType: null,
    });

    await expect(
      generationService.downloadImage({
        userId: "user_1",
        jobId: "job_1",
      }),
    ).resolves.toEqual({
      body,
      contentLength: 11,
      contentType: "image/png",
      filename: "remora-image-job_1.png",
    });
    expect(mocks.downloadObject).toHaveBeenCalledWith({
      bucket: "generation-results",
      objectKey: "jobs/job_1/image",
    });
  });

  it.each([
    ["missing job", null],
    [
      "another user's job",
      {
        status: "succeeded",
        userId: "user_2",
        asset: {
          bucket: "generation-results",
          objectKey: "image.jpg",
          contentType: "image/jpeg",
        },
      },
    ],
    [
      "unsuccessful job",
      {
        status: "failed",
        userId: "user_1",
        asset: {
          bucket: "generation-results",
          objectKey: "image.jpg",
          contentType: "image/jpeg",
        },
      },
    ],
    [
      "job without an image asset",
      {
        status: "succeeded",
        userId: "user_1",
        asset: null,
      },
    ],
  ])("conceals a %s as not found", async (_label, context) => {
    mocks.getImageResultAssetForJob.mockResolvedValue(context);

    await expect(
      generationService.createImageDownloadUrl({
        userId: "user_1",
        jobId: "job_1",
      }),
    ).rejects.toBeInstanceOf(GenerationImageDownloadNotFoundError);
    expect(mocks.createSignedGetUrlWithExpiration).not.toHaveBeenCalled();
  });

  it("rejects model type mismatches before submission side effects", async () => {
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce({
      id: "image-model-v1",
      modelId: "image-model",
      modelType: "image",
      providerId: "byteplus",
      status: "published",
      adapter: null,
      rateLimitMode: "enforced",
      spec: {},
    });

    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          modelId: "image-model",
          modelSpecId: "image-model-v1",
        }),
      }),
    ).rejects.toBeInstanceOf(GenerationModelTypeMismatchError);
    expect(mocks.resolveSelectionForSubmission).not.toHaveBeenCalled();
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects video models from image submission before side effects", async () => {
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedModelSpec(),
    );

    await expect(
      generationService.createImageGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createImageInput({
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
        }),
      }),
    ).rejects.toBeInstanceOf(GenerationModelTypeMismatchError);
    expect(mocks.resolveSelectionForSubmission).not.toHaveBeenCalled();
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("fans out image jobs without creating callback credentials", async () => {
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedImageModelSpec(),
    );
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission: createImageSubmission({ requestedGenerations: 2 }),
      jobs: [
        createImageJob({ id: "image_job_1", submissionIndex: 0 }),
        createImageJob({ id: "image_job_2", submissionIndex: 1 }),
      ],
    });

    const result = await generationService.createImageGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createImageInput({
        prompt: "  Glass flowers  ",
        requestedGenerations: 2,
      }),
    });

    expect(result).toEqual({
      submission: createImageSubmission({ requestedGenerations: 2 }),
      jobs: [
        createImageJob({ id: "image_job_1", submissionIndex: 0 }),
        createImageJob({ id: "image_job_2", submissionIndex: 1 }),
      ],
      createdThread: createGenerationThreadRecord({ name: "Glass flowers" }),
    });
    const insertion = mocks.insertGenerationSubmission.mock.calls[0]?.[0];
    expect(insertion).toEqual(
      expect.objectContaining({
        modelId: "nano-banana-2",
        modelSpecId: "nano-banana-2-v1",
        modelType: "image",
        providerId: "google",
        providerModelId: "gemini-3.1-flash-image",
        submittedInput: {
          prompt: "Glass flowers",
          resolution: "1K",
          aspectRatio: "1:1",
        },
        requestedGenerations: 2,
      }),
    );
    expect(insertion).not.toHaveProperty("callbackTokenHashes");
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith({
      modelType: "image",
      modelId: "nano-banana-2",
      modelSpecId: "nano-banana-2-v1",
      resolution: "1K",
      aspectRatio: "1:1",
      prompt: "Glass flowers",
      requestedGenerations: 2,
      attachmentMedia: undefined,
    });
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenCalledTimes(2);
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledTimes(2);
    expect(mocks.trackAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "generation_submission_created",
        generation: expect.objectContaining({
          modelType: "image",
          modelId: "nano-banana-2",
          requestedOutputCount: 2,
          resolution: "1K",
          aspectRatio: "1:1",
        }),
      }),
      { suppressed: false },
    );
    expect(
      mocks.trackAnalytics.mock.calls[0]?.[0]?.generation,
    ).not.toHaveProperty("generationDurationSeconds");
    expect(
      mocks.trackAnalytics.mock.calls[0]?.[0]?.generation,
    ).not.toHaveProperty("generateAudio");
  });

  it("rejects unsupported or unpublished exact model specs", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          modelId: "kling-v3-text-to-video",
          modelSpecId: "kling-v3-text-to-video-v1",
        }),
      }),
    ).rejects.toBeInstanceOf(UnsupportedGenerationModelError);
    expect(mocks.getPublishedGenerationModelSpecById).toHaveBeenCalledWith({
      modelId: "kling-v3-text-to-video",
      modelSpecId: "kling-v3-text-to-video-v1",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects aspect ratios outside the model spec options", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          aspectRatio: "2:1",
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "aspectRatio",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects resolution values outside the model spec options", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
          resolution: "1080p",
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "resolution",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects duration values outside the model spec options", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          duration: 7,
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "duration",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects prompts over the model spec max length", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          prompt: "A prompt that is too long",
        }),
      }),
    ).rejects.toBeInstanceOf(GenerationInputValidationError);
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects requested generation counts below the supported minimum", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          requestedGenerations: 0,
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "requestedGenerations",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects requested generation counts above the supported maximum", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          requestedGenerations: 16,
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "requestedGenerations",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects non-integer requested generation counts", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          requestedGenerations: 1.5,
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "requestedGenerations",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("normalizes and creates valid Seedance generation submissions", async () => {
    const billableJobCost = createGenerationJobCostWithEstimate({
      estimatedCostUsdMicros: 462_000,
      estimatedCostSnapshot: createGenerationJobEstimatedCostSnapshot(),
    });
    mocks.estimateGenerationCostForSingleJob.mockResolvedValueOnce(
      billableJobCost,
    );

    const result = await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        prompt: "  Quiet sea  ",
      }),
    });

    expect(result).toEqual({
      submission: createSubmission(),
      jobs: [
        {
          job: createJob(),
          providerExecution: {
            mode: "callback",
            callbackToken: expect.any(String),
          },
        },
      ],
      createdThread: createGenerationThreadRecord({ name: "Quiet sea" }),
    });
    expect(result.jobs[0]?.providerExecution).toEqual({
      mode: "callback",
      callbackToken: expect.any(String),
    });
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        modelType: "video",
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-260128",
        submittedInput: {
          prompt: "Quiet sea",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          draft: false,
        },
        requestedGenerations: 1,
        callbackTokenHashes: [expect.stringMatching(/^[a-f0-9]{64}$/)],
      }),
    );
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith({
      modelType: "video",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: false,
      requestedGenerations: 1,
      attachmentMedia: undefined,
    });
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenCalledWith({
      jobId: "job_1",
      estimatedCostUsdMicros: 462_000,
      currencyCode: "USD",
      estimatedCostSnapshot: billableJobCost.estimatedCostSnapshot,
    });
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledWith({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      generationSubmissionId: "submission_1",
      generationJobId: "job_1",
      generationJobCostId: "job_1_estimate",
      estimatedCostUsdMicros: 462_000,
    });
    expect(mocks.createThread).toHaveBeenCalledWith({
      userId: "user_1",
      name: "Quiet sea",
    });
    expect(mocks.trackAnalytics).toHaveBeenCalledWith(
      {
        type: "generation_submission_created",
        userId: "user_1",
        occurredAt: createSubmission().createdAt,
        submissionId: "submission_1",
        generation: {
          modelType: "video",
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          requestedOutputCount: 1,
          resolution: "720p",
          aspectRatio: "16:9",
          generationDurationSeconds: 5,
          generateAudio: true,
          attachmentCount: 0,
          hasImageAttachment: false,
          hasVideoAttachment: false,
          hasAudioAttachment: false,
        },
        targetType: "new_unprojected_thread",
        estimatedCostUsdMicrosPerOutput: 462_000,
        estimatedCostUsdMicrosTotal: 462_000,
      },
      { suppressed: false },
    );
  });

  it("creates distinct callback tokens for requested generation jobs", async () => {
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission: createSubmission({
        requestedGenerations: 3,
      }),
      jobs: [
        createJob({ id: "job_1", submissionIndex: 0 }),
        createJob({ id: "job_2", submissionIndex: 1 }),
        createJob({ id: "job_3", submissionIndex: 2 }),
      ],
    });

    const result = await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        requestedGenerations: 3,
      }),
    });

    expect(result.jobs).toHaveLength(3);
    const callbackTokens = result.jobs.map((job) =>
      job.providerExecution.mode === "callback"
        ? job.providerExecution.callbackToken
        : null,
    );
    expect(new Set(callbackTokens).size).toBe(3);
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedGenerations: 3,
        callbackTokenHashes: [
          expect.stringMatching(/^[a-f0-9]{64}$/),
          expect.stringMatching(/^[a-f0-9]{64}$/),
          expect.stringMatching(/^[a-f0-9]{64}$/),
        ],
      }),
    );
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenCalledTimes(3);
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ jobId: "job_1" }),
    );
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ jobId: "job_2" }),
    );
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ jobId: "job_3" }),
    );
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledTimes(3);
  });

  it("creates BFL polling jobs without callback credentials", async () => {
    const submittedInput = {
      prompt: "Quiet sea",
      resolution: "hd",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    };
    const submission = createSubmission({
      modelId: "flux-3-video",
      modelSpecId: "flux-3-video-v1",
      submittedInput,
    });
    const job = createJob({
      callbackTokenHash: null,
      providerId: "bfl",
      providerModelId: "latest",
    });
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedBflModelSpec(),
    );
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission,
      jobs: [job],
    });

    const result = await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        modelId: "flux-3-video",
        modelSpecId: "flux-3-video-v1",
        ...submittedInput,
      }),
    });

    expect(result).toMatchObject({
      jobs: [{ job, providerExecution: { mode: "polling" } }],
    });
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.not.objectContaining({ callbackTokenHashes: expect.anything() }),
    );
  });

  it("rejects invalid BFL video continuation before cost reservation", async () => {
    mocks.getPublishedGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedBflModelSpec(),
    );
    mocks.resolveSelectionForSubmission.mockResolvedValueOnce([
      createStoredVideoAttachment({ durationSec: 4 }),
    ]);

    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          modelId: "flux-3-video",
          modelSpecId: "flux-3-video-v1",
          resolution: "hd",
          duration: 16,
          attachmentMedia: {
            videos: [{ id: "reference_video_1", role: "reference" }],
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "duration",
    });
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
    expect(mocks.reserveGenerationJobCostEstimate).not.toHaveBeenCalled();
  });

  it("propagates reservation failures", async () => {
    mocks.reserveGenerationJobCostEstimate.mockRejectedValueOnce(
      new InsufficientCreditBalanceError({
        userId: "user_1",
        requiredAmountUsdMicros: 420_000,
      }),
    );

    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput(),
      }),
    ).rejects.toBeInstanceOf(InsufficientCreditBalanceError);
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.createGenerationJobCostWithEstimate).toHaveBeenCalledTimes(1);
    expect(mocks.trackAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "insufficient_credits_encountered",
        userId: "user_1",
        requiredCreditUsdMicrosPerOutput: 462_000,
        requiredCreditUsdMicrosTotal: 462_000,
      }),
      { suppressed: false },
    );
    expect(mocks.trackAnalytics).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "generation_submission_created" }),
    );
  });

  it.each([
    {
      input: {
        jobId: "job_1",
        status: "failed",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      },
      mark: () => mocks.markGenerationJobFailed,
    },
    {
      input: {
        jobId: "job_1",
        status: "cancelled",
        terminalError: null,
      },
      mark: () => mocks.markGenerationJobCancelled,
    },
    {
      input: {
        jobId: "job_1",
        status: "expired",
        terminalError: {
          source: "internal",
          code: "PROVIDER_CALLBACK_TIMEOUT",
          message: "Provider callback was not received within 24 hours",
        },
      },
      mark: () => mocks.markGenerationJobExpired,
    },
  ] satisfies Array<{
    input: FinalizeUnsuccessfulGenerationJobInput;
    mark: () => ReturnType<typeof vi.fn>;
  }>)(
    "releases reserved credits when finalizing a $input.status generation job",
    async ({ input, mark }) => {
      const markedJob = createJob({
        status: input.status,
        terminalError: input.terminalError,
        terminalAt: new Date("2026-06-05T00:01:00.000Z"),
      });
      mark().mockResolvedValueOnce(markedJob);

      await expect(
        generationService.finalizeUnsuccessfulGenerationJob(input),
      ).resolves.toEqual(markedJob);

      expect(mocks.getGenerationJobById).toHaveBeenCalledWith("job_1");
      expect(mocks.getGenerationJobCostByJobId).toHaveBeenCalledWith("job_1");
      expect(mocks.releaseGenerationJobCostReservation).toHaveBeenCalledWith({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        generationJobId: "job_1",
        generationJobCostId: "estimate_1",
        estimatedCostUsdMicros: 462_000,
      });
      expect(mocks.releaseJobConcurrencyLeases).toHaveBeenCalledWith({
        jobId: "job_1",
      });
      expect(mark()).toHaveBeenCalledWith(input);
      expect(mocks.trackAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "generation_job_failed",
          jobId: "job_1",
          terminalStatus: input.status,
          processingDurationMs: 60_000,
        }),
        { suppressed: false },
      );
    },
  );

  it("releases concurrency leases when marking jobs succeeded", async () => {
    const succeededJob = createJob({
      status: "succeeded",
      terminalAt: new Date("2026-06-05T00:01:00.000Z"),
    });
    mocks.markGenerationJobSucceeded.mockResolvedValueOnce(succeededJob);

    await expect(
      generationService.markGenerationJobSucceeded({ jobId: "job_1" }),
    ).resolves.toEqual(succeededJob);

    expect(mocks.releaseJobConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
    });
    expect(mocks.markGenerationJobSucceeded).toHaveBeenCalledWith({
      jobId: "job_1",
    });
    expect(mocks.trackAnalytics).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "generation_job_succeeded",
        userId: "user_1",
        jobId: "job_1",
        outputIndex: 0,
        processingDurationMs: 60_000,
      }),
      { suppressed: false },
    );
  });

  it("does not track jobs that were already terminal", async () => {
    const terminalAt = new Date("2026-06-05T00:01:00.000Z");
    mocks.getGenerationJobById.mockResolvedValueOnce(
      createJob({
        status: "succeeded",
        terminalAt,
        threadId: "thread_1",
        userId: "user_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        submittedInput: createSubmission().submittedInput,
        requestedGenerations: 1,
        attachmentMedia: [],
      }),
    );
    mocks.markGenerationJobSucceeded.mockResolvedValueOnce(
      createJob({ status: "succeeded", terminalAt }),
    );

    await generationService.markGenerationJobSucceeded({ jobId: "job_1" });

    expect(mocks.trackAnalytics).not.toHaveBeenCalled();
  });

  it("releases concurrency leases when marking final cost calculation failures", async () => {
    const terminalError = {
      source: "internal" as const,
      code: "FINAL_COST_CALCULATION_FAILED",
      message: "Model rates unavailable",
    };
    const failedJob = createJob({ status: "final_cost_calculation_failure" });
    mocks.markGenerationJobFinalCostCalculationFailed.mockResolvedValueOnce(
      failedJob,
    );

    await expect(
      generationService.markGenerationJobFinalCostCalculationFailed({
        jobId: "job_1",
        terminalError,
      }),
    ).resolves.toEqual(failedJob);

    expect(mocks.releaseJobConcurrencyLeases).toHaveBeenCalledWith({
      jobId: "job_1",
    });
    expect(
      mocks.markGenerationJobFinalCostCalculationFailed,
    ).toHaveBeenCalledWith({
      jobId: "job_1",
      terminalError,
    });
  });

  it("does not mark unsuccessful jobs when the job cost is missing", async () => {
    mocks.getGenerationJobCostByJobId.mockResolvedValueOnce(null);

    await expect(
      generationService.finalizeUnsuccessfulGenerationJob({
        jobId: "job_1",
        status: "failed",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      }),
    ).rejects.toThrow("Generation job cost was not found for job job_1");
    expect(mocks.releaseGenerationJobCostReservation).not.toHaveBeenCalled();
    expect(mocks.markGenerationJobFailed).not.toHaveBeenCalled();
  });

  it("does not release or mark unsuccessful jobs when the job cost is already finalized", async () => {
    mocks.getGenerationJobCostByJobId.mockResolvedValueOnce(
      createPersistedGenerationJobCost({
        finalCostUsdMicros: 462_000,
        finalCostBasis: "provider_usage",
        finalizedAt: new Date("2026-06-05T00:10:00.000Z"),
      }),
    );

    await expect(
      generationService.finalizeUnsuccessfulGenerationJob({
        jobId: "job_1",
        status: "failed",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      }),
    ).rejects.toThrow(
      "Generation job cost was already finalized for job job_1",
    );
    expect(mocks.releaseGenerationJobCostReservation).not.toHaveBeenCalled();
    expect(mocks.markGenerationJobFailed).not.toHaveBeenCalled();
  });

  it("normalizes and creates valid Seedance Fast generation submissions", async () => {
    const fastSubmission = createSubmission({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
    });
    const fastJob = createJob({
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    mocks.insertGenerationSubmission.mockResolvedValueOnce({
      submission: fastSubmission,
      jobs: [fastJob],
    });

    const result = await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        modelId: "seedance-2.0-fast-video",
        modelSpecId: "seedance-2.0-fast-video-v1",
      }),
    });

    expect(result.submission).toMatchObject({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
    });
    expect(result.jobs[0]?.job).toMatchObject({
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: "seedance-2.0-fast-video",
        modelSpecId: "seedance-2.0-fast-video-v1",
        modelType: "video",
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-fast-260128",
      }),
    );
  });

  it("resolves submitted attachment media before creating a submission", async () => {
    mocks.resolveSelectionForSubmission.mockResolvedValueOnce([
      {
        id: "reference_image_1",
        fieldId: "images",
        role: "reference",
        position: 0,
      },
    ]);

    await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        modelSpecId: "seedance-2.0-video-v1",
        attachmentMedia: {
          images: [{ id: "reference_image_1", role: "reference" }],
        },
      }),
    });

    expect(mocks.resolveSelectionForSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        input: {
          images: [{ id: "reference_image_1", role: "reference" }],
        },
      }),
    );
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentMedia: [
          expect.objectContaining({
            id: "reference_image_1",
            fieldId: "images",
            role: "reference",
            position: 0,
          }),
        ],
      }),
    );
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentMedia: {
          images: [{ role: "reference" }],
        },
      }),
    );
  });

  it("uses authoritative uploaded video duration for the job cost estimate", async () => {
    mocks.resolveSelectionForSubmission.mockResolvedValueOnce([
      createStoredVideoAttachment({ durationSec: 2.5 }),
    ]);

    await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        attachmentMedia: {
          videos: [{ id: "reference_video_1", role: "reference" }],
        },
      }),
    });

    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentMedia: {
          videos: [{ role: "reference", durationSec: 2.5 }],
        },
      }),
    );
  });

  it("rejects a resolved video without authoritative duration metadata", async () => {
    mocks.resolveSelectionForSubmission.mockResolvedValueOnce([
      createStoredVideoAttachment({ durationSec: null }),
    ]);

    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          attachmentMedia: {
            videos: [{ id: "reference_video_1", role: "reference" }],
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "videos",
    });
    expect(mocks.estimateGenerationCostForSingleJob).not.toHaveBeenCalled();
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("propagates attachment media validation failures without creating a submission", async () => {
    mocks.resolveSelectionForSubmission.mockRejectedValueOnce(
      new GenerationAttachmentMediaValidationError(
        "images",
        "attachment media cannot include duplicates",
      ),
    );

    await expect(
      generationService.createVideoGenerationSubmission({
        analyticsContext: { suppressed: false },
        userId: "user_1",
        input: createInput({
          modelSpecId: "seedance-2.0-video-v1",
          attachmentMedia: {
            images: [
              { id: "reference_image_1", role: "reference" },
              { id: "reference_image_1", role: "reference" },
            ],
          },
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "images",
    });
    expect(mocks.insertGenerationSubmission).not.toHaveBeenCalled();
  });

  it("creates provider tasks from the exact persisted model spec", async () => {
    const input = createVideoTaskInput({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
    });

    await expect(generationService.createVideoTask(input)).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-fast",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
      pollingUrl: null,
    });
    expect(mocks.getRunnableGenerationModelSpecById).toHaveBeenCalledWith({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
    });
    expect(mocks.createVideoTask).toHaveBeenCalledWith({
      spec: createSeedanceFastSpec(),
      input,
    });
  });

  it("dispatches synchronous image creation through the Google adapter", async () => {
    const modelSpec = createPublishedImageModelSpec();
    const input = createImageTaskInput();
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);

    await expect(generationService.createImageTask(input)).resolves.toEqual(
      expect.objectContaining({
        provider: "google",
        providerTaskId: "interaction_123",
        providerModelId: "gemini-3.1-flash-image",
        image: expect.objectContaining({ contentType: "image/jpeg" }),
      }),
    );
    expect(mocks.generateImage).toHaveBeenCalledWith({
      jobId: input.jobId,
      spec: modelSpec.spec,
      input: {
        submittedInput: input.submittedInput,
        attachmentMedia: input.attachmentMedia,
      },
    });
    expect(mocks.createVideoTask).not.toHaveBeenCalled();
    expect(mocks.createKlingVideoTask).not.toHaveBeenCalled();
  });

  it("dispatches synchronous image creation through the OpenAI adapter", async () => {
    const modelSpec = createPublishedOpenAIImageModelSpec();
    const input = createImageTaskInput({
      modelId: "gpt-image-2-high",
      modelSpecId: "gpt-image-2-high-v1",
      submittedInput: {
        prompt: "Glass flowers",
        resolution: "standard",
        aspectRatio: "1:1",
      },
    });
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);

    await expect(generationService.createImageTask(input)).resolves.toEqual(
      expect.objectContaining({
        provider: "openai",
        providerTaskId: "openai-stateless:image_job_1",
        providerModelId: "gpt-image-2-2026-04-21",
      }),
    );
    expect(mocks.generateOpenAIImage).toHaveBeenCalledWith({
      jobId: input.jobId,
      spec: modelSpec.spec,
      input: {
        submittedInput: input.submittedInput,
        attachmentMedia: input.attachmentMedia,
      },
    });
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });

  it("records flat Google diagnostics with the provider error code", async () => {
    const modelSpec = createPublishedImageModelSpec();
    const input = createImageTaskInput();
    const providerError = new GoogleProviderError(
      "Google interaction did not return an image",
      {
        code: "IMAGE_SAFETY",
        interactionStatus: "completed",
        providerMessage: "The request could not be completed",
        diagnostics: {
          interactionId: "interaction_123",
          interactionStatus: "completed",
          providerCode: "IMAGE_SAFETY",
          providerMessage: "The request could not be completed",
          stepTypes: ["thought", "model_output"],
          contentTypes: ["text", "text"],
          imageCount: 0,
        },
      },
    );
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);
    mocks.generateImage.mockRejectedValueOnce(providerError);

    await expect(generationService.createImageTask(input)).rejects.toBe(
      providerError,
    );
    expect(mocks.logGenerationLifecycleEvent).toHaveBeenCalledWith(
      "generation.provider.task_create_failed",
      expect.objectContaining({
        errorCode: "IMAGE_SAFETY",
        errorSource: "provider",
        providerMessage: "The request could not be completed",
        providerInteractionId: "interaction_123",
        providerInteractionStatus: "completed",
        providerResponseStepTypes: "thought,model_output",
        providerResponseContentTypes: "text,text",
        providerResponseImageCount: 0,
      }),
    );
  });

  it("dispatches Kling task creation through its exact adapter", async () => {
    const spec = createKlingSpec();
    const modelSpec = createPublishedModelSpec({
      id: spec.id,
      modelId: "kling-v3-text-to-video",
      providerId: "kling",
      adapter: "kling_v3_text_to_video",
      spec,
    });
    const input = createVideoTaskInput({
      modelId: "kling-v3-text-to-video",
      modelSpecId: spec.id,
      submittedInput: {
        prompt: "A silver airship above the sea",
        resolution: "1080p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: false,
        draft: false,
      },
      callbackUrl:
        "https://backend.example/api/generation-callbacks/kling/job_1?token=test",
    });
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);

    await expect(generationService.createVideoTask(input)).resolves.toEqual({
      provider: "kling",
      providerTaskId: "kling-task-1",
      providerModelId: "kling-v3",
      pollingUrl: null,
    });
    expect(mocks.createKlingVideoTask).toHaveBeenCalledWith({ spec, input });
    expect(mocks.createVideoTask).not.toHaveBeenCalled();
  });

  it("dispatches BFL task creation without a callback URL", async () => {
    const modelSpec = createPublishedBflModelSpec();
    const input = createVideoTaskInput({
      modelId: "flux-3-video",
      modelSpecId: "flux-3-video-v1",
      submittedInput: {
        prompt: "A glass whale",
        resolution: "hd",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        draft: false,
      },
      callbackUrl: null,
    });
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);

    await expect(generationService.createVideoTask(input)).resolves.toEqual({
      provider: "bfl",
      providerTaskId: "bfl-task-1",
      providerModelId: "latest",
      pollingUrl: "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
    });
    expect(mocks.createBflVideoTask).toHaveBeenCalledWith({
      spec: modelSpec.spec,
      input,
    });
    expect(mocks.createVideoTask).not.toHaveBeenCalled();
    expect(mocks.createKlingVideoTask).not.toHaveBeenCalled();
  });

  it("downloads and encodes the owned source cache inside BFL enhancement task creation", async () => {
    const modelSpec = createPublishedBflModelSpec();
    const sourceSubmittedInput = createFluxDraftSubmission().submittedInput;
    const targetSubmittedInput = { ...sourceSubmittedInput, draft: false };
    const input = createVideoTaskInput({
      jobId: "target_job",
      modelId: "flux-3-video",
      modelSpecId: "flux-3-video-v1",
      submittedInput: targetSubmittedInput,
      callbackUrl: null,
      draftEnhancementSourceJobId: "source_job",
    });
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);
    mocks.getGenerationJobById
      .mockResolvedValueOnce(
        createJob({
          id: "source_job",
          status: "succeeded",
          userId: "user_1",
          threadId: "thread_1",
          modelId: "flux-3-video",
          modelSpecId: "flux-3-video-v1",
          modelType: "video",
          submittedInput: sourceSubmittedInput,
        }),
      )
      .mockResolvedValueOnce(
        createJob({
          id: "target_job",
          status: "queued",
          userId: "user_1",
          threadId: "thread_1",
          modelId: "flux-3-video",
          modelSpecId: "flux-3-video-v1",
          modelType: "video",
          submittedInput: targetSubmittedInput,
        }),
      );
    mocks.getGenerationDraftCacheByJobId.mockResolvedValueOnce(
      createDraftSourceJob().draftCache,
    );
    mocks.downloadObject.mockResolvedValueOnce({
      body: Readable.from([Buffer.from("draft-"), Buffer.from("cache")]),
      contentLength: 11,
      contentType: "application/octet-stream",
    });

    await generationService.createVideoTask(input);

    expect(mocks.downloadObject).toHaveBeenCalledWith({
      bucket: "generation-results",
      objectKey: "generations/jobs/source_1/draft-cache",
    });
    expect(mocks.createSignedGetUrlWithExpiration).not.toHaveBeenCalled();
    expect(mocks.createBflVideoTask).toHaveBeenCalledWith({
      spec: modelSpec.spec,
      input: {
        ...input,
        draftCacheBase64: "ZHJhZnQtY2FjaGU=",
      },
    });
  });

  it("retrieves and normalizes BFL polling results", async () => {
    const modelSpec = createPublishedBflModelSpec();
    const rawPayload = { id: "bfl-task-1", status: "Pending" };
    const normalized = {
      provider: "bfl" as const,
      providerTaskId: "bfl-task-1",
      providerModelId: "latest",
      status: "running" as const,
      videoUrl: null,
      usage: null,
      createdAt: null,
      updatedAt: null,
      providerError: null,
    };
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(modelSpec);
    mocks.retrieveBflVideoTask.mockResolvedValueOnce(rawPayload);
    mocks.normalizeBflVideoTaskResult.mockReturnValueOnce(normalized);

    await expect(
      generationService.pollVideoTask({
        modelId: "flux-3-video",
        modelSpecId: "flux-3-video-v1",
        providerTaskId: "bfl-task-1",
        pollingUrl: "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
      }),
    ).resolves.toMatchObject({
      kind: "result",
      result: normalized,
      rawPayload,
    });
    expect(mocks.retrieveBflVideoTask).toHaveBeenCalledWith(
      "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
    );
  });

  it("rejects provider task creation when the model spec has no adapter", async () => {
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedModelSpec({ adapter: null }),
    );

    await expect(
      generationService.createVideoTask(createVideoTaskInput()),
    ).rejects.toBeInstanceOf(UnsupportedGenerationModelError);
    expect(mocks.createVideoTask).not.toHaveBeenCalled();
  });

  it("keeps archived specs runnable for already-queued jobs", async () => {
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedModelSpec({
        status: "archived",
        spec: createSeedanceSpec({ status: "archived" }),
      }),
    );

    await expect(
      generationService.createVideoTask(createVideoTaskInput()),
    ).resolves.toMatchObject({ providerTaskId: "cgt-fast" });
    expect(mocks.createVideoTask).toHaveBeenCalledOnce();
  });

  it("wraps normalized provider callbacks in the generic callback contract", async () => {
    const rawPayload = { id: "cgt-fast", status: "succeeded" };

    await expect(
      generationService.normalizeVideoGenerationProviderCallback({
        modelId: "seedance-2.0-fast-video",
        modelSpecId: "seedance-2.0-fast-video-v1",
        expectedProviderTaskId: "cgt-fast",
        rawPayload,
        receivedAt: "2026-07-14T12:00:00.000Z",
      }),
    ).resolves.toEqual({
      kind: "result",
      result: expect.objectContaining({
        provider: "byteplus",
        providerTaskId: "cgt-fast",
        status: "succeeded",
      }),
      rawPayload,
      receivedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(mocks.normalizeVideoTaskResult).toHaveBeenCalledWith(rawPayload);
  });

  it("normalizes Kling callbacks using the bound provider model", async () => {
    const spec = createKlingSpec();
    const rawPayload = {
      task_id: "kling-task-1",
      task_status: "succeed",
    };
    mocks.getRunnableGenerationModelSpecById.mockResolvedValueOnce(
      createPublishedModelSpec({
        id: spec.id,
        modelId: "kling-v3-text-to-video",
        providerId: "kling",
        adapter: "kling_v3_text_to_video",
        spec,
      }),
    );

    await expect(
      generationService.normalizeVideoGenerationProviderCallback({
        modelId: "kling-v3-text-to-video",
        modelSpecId: spec.id,
        expectedProviderTaskId: "kling-task-1",
        rawPayload,
        receivedAt: "2026-07-14T12:00:00.000Z",
      }),
    ).resolves.toEqual({
      kind: "result",
      result: expect.objectContaining({
        provider: "kling",
        providerTaskId: "kling-task-1",
        status: "succeeded",
      }),
      rawPayload,
      receivedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(mocks.normalizeKlingVideoTaskResult).toHaveBeenCalledWith(
      rawPayload,
      "kling-v3",
    );
    expect(mocks.normalizeVideoTaskResult).not.toHaveBeenCalled();
  });

  it("converts provider callback parsing failures into malformed callbacks", async () => {
    const rawPayload = { unexpected: true };
    mocks.normalizeVideoTaskResult.mockImplementationOnce(() => {
      throw new Error("invalid provider payload");
    });

    await expect(
      generationService.normalizeVideoGenerationProviderCallback({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        expectedProviderTaskId: "cgt-fast",
        rawPayload,
        receivedAt: "2026-07-14T12:00:00.000Z",
      }),
    ).resolves.toEqual({
      kind: "malformed",
      terminalError: {
        source: "provider",
        code: "MALFORMED_PROVIDER_CALLBACK",
        message: "Provider callback payload could not be parsed",
      },
      rawPayload,
      receivedAt: "2026-07-14T12:00:00.000Z",
    });
  });

  it("rejects callbacks whose provider task id does not match the job", async () => {
    await expect(
      generationService.normalizeVideoGenerationProviderCallback({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        expectedProviderTaskId: "cgt-expected",
        rawPayload: { id: "cgt-fast" },
        receivedAt: "2026-07-14T12:00:00.000Z",
      }),
    ).rejects.toMatchObject({
      code: "PROVIDER_TASK_ID_MISMATCH",
      expectedProviderTaskId: "cgt-expected",
      receivedProviderTaskId: "cgt-fast",
    });
  });

  it("passes existing thread ids through to persistence", async () => {
    await generationService.createVideoGenerationSubmission({
      analyticsContext: { suppressed: false },
      userId: "user_1",
      input: createInput({
        threadId: "thread_1",
      }),
    });

    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread_1",
      }),
    );
    expect(mocks.touchOwnedThread).toHaveBeenCalledWith({
      userId: "user_1",
      threadId: "thread_1",
    });
    expect(mocks.createThread).not.toHaveBeenCalled();
  });

  it("signs stored video asset URLs into thread list results", async () => {
    mocks.listSubmissionsFromThread.mockResolvedValueOnce([
      createThreadSubmission({
        jobs: [
          {
            result: {
              assets: [
                {
                  kind: "video",
                  bucket: "remora-dev-media",
                  objectKey: "jobs/job_1/video.mp4",
                  contentType: "video/mp4",
                  contentLength: 1234,
                  etag: '"video-etag"',
                  checksumSha256: "video-sha256",
                  sourceProviderUrl: "https://provider.example/video.mp4",
                  url: null,
                  urlExpiresAt: null,
                },
              ],
            },
          },
        ],
      }),
    ]);

    await expect(
      generationService.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        jobs: [
          expect.objectContaining({
            result: expect.objectContaining({
              videoUrl: "https://signed.example/jobs/job_1/video.mp4",
              mediaUrlExpiresAt: "2026-06-05T00:17:00.000Z",
            }),
          }),
        ],
      }),
    ]);
    expect(mocks.listSubmissionsFromThread).toHaveBeenCalledWith({
      userId: "user_1",
      threadId: "thread_1",
    });
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "jobs/job_1/video.mp4",
    });
  });

  it("signs image assets without populating video compatibility fields", async () => {
    const baseSubmission = createThreadSubmission();
    mocks.listSubmissionsFromThread.mockResolvedValueOnce([
      {
        ...baseSubmission,
        modelId: "nano-banana-2",
        modelDisplayName: "Nano Banana 2",
        modelType: "image",
        modelSpecId: "nano-banana-2-v1",
        submittedInput: {
          prompt: "Glass flowers",
          resolution: "1K",
          aspectRatio: "1:1",
        },
        jobs: [
          {
            ...baseSubmission.jobs[0]!,
            result: {
              ...baseSubmission.jobs[0]!.result!,
              providerId: "google",
              providerTaskId: "interaction_123",
              providerModelId: "gemini-3.1-flash-image",
              videoUrl: null,
              assets: [
                {
                  kind: "image",
                  bucket: "remora-dev-media",
                  objectKey: "jobs/image_job_1/image",
                  contentType: "image/jpeg",
                  contentLength: 1234,
                  etag: '"image-etag"',
                  checksumSha256: "image-sha256",
                  sourceProviderUrl: null,
                  url: null,
                  urlExpiresAt: null,
                },
              ],
            },
          },
        ],
      },
    ] as never);

    const [submission] = await generationService.listSubmissionsFromThread({
      userId: "user_1",
      threadId: "thread_1",
    });
    const result = submission?.jobs[0]?.result;

    expect(result).toMatchObject({
      videoUrl: null,
      previewImageUrl: null,
      mediaUrlExpiresAt: null,
      assets: [
        expect.objectContaining({
          kind: "image",
          url: "https://signed.example/jobs/image_job_1/image",
          urlExpiresAt: "2026-06-05T00:17:00.000Z",
        }),
      ],
    });
  });

  it("signs stored preview image URLs into thread list results", async () => {
    mocks.createSignedGetUrlWithExpiration.mockImplementation(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: objectKey.endsWith("preview.jpg")
          ? "2026-06-05T00:16:00.000Z"
          : "2026-06-05T00:17:00.000Z",
      }),
    );
    mocks.listSubmissionsFromThread.mockResolvedValueOnce([
      createThreadSubmission({
        jobs: [
          {
            result: {
              assets: [
                {
                  kind: "video",
                  bucket: "remora-dev-media",
                  objectKey: "jobs/job_1/video.mp4",
                  contentType: "video/mp4",
                  contentLength: 1234,
                  etag: '"video-etag"',
                  checksumSha256: "video-sha256",
                  sourceProviderUrl: "https://provider.example/video.mp4",
                  url: null,
                  urlExpiresAt: null,
                },
              ],
              preview: {
                bucket: "remora-dev-media",
                objectKey: "jobs/job_1/preview.jpg",
                contentType: "image/jpeg",
                contentLength: 4321,
                etag: '"preview-etag"',
                checksumSha256: "preview-sha256",
                frameTimeMs: 1000,
              },
            },
          },
        ],
      }),
    ]);

    await expect(
      generationService.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        jobs: [
          expect.objectContaining({
            result: expect.objectContaining({
              videoUrl: "https://signed.example/jobs/job_1/video.mp4",
              previewImageUrl: "https://signed.example/jobs/job_1/preview.jpg",
              mediaUrlExpiresAt: "2026-06-05T00:16:00.000Z",
            }),
          }),
        ],
      }),
    ]);
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "jobs/job_1/video.mp4",
    });
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "jobs/job_1/preview.jpg",
    });
  });

  it("leaves pending jobs and results without asset rows unsigned", async () => {
    mocks.listSubmissionsFromThread.mockResolvedValueOnce([
      createThreadSubmission({
        jobs: [{ result: null }],
      }),
      createThreadSubmission({
        id: "submission_2",
        jobs: [
          {
            id: "job_2",
            result: {
              assets: [],
              videoUrl: "https://provider.example/video.mp4",
            },
          },
        ],
      }),
    ]);

    await expect(
      generationService.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "submission_1",
        jobs: [expect.objectContaining({ id: "job_1", result: null })],
      }),
      expect.objectContaining({
        id: "submission_2",
        jobs: [
          expect.objectContaining({
            id: "job_2",
            result: expect.objectContaining({
              videoUrl: "https://provider.example/video.mp4",
              mediaUrlExpiresAt: null,
            }),
          }),
        ],
      }),
    ]);
    expect(mocks.createSignedGetUrlWithExpiration).not.toHaveBeenCalled();
  });
});

function createInput(
  overrides: Partial<CreateVideoGenerationInput> = {},
): CreateVideoGenerationInput {
  return {
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    prompt: "Quiet sea",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };
}

function createImageInput(
  overrides: Partial<CreateImageGenerationInput> = {},
): CreateImageGenerationInput {
  return {
    modelId: "nano-banana-2",
    modelSpecId: "nano-banana-2-v1",
    prompt: "Glass flowers",
    resolution: "1K",
    aspectRatio: "1:1",
    requestedGenerations: 1,
    ...overrides,
  };
}

function createVideoTaskInput(
  overrides: Partial<CreateVideoTaskInput> = {},
): CreateVideoTaskInput {
  return {
    jobId: "job_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    attachmentMedia: [],
    callbackUrl:
      "https://backend.example/api/generation-callbacks/byteplus/job_1?token=test",
    ...overrides,
  };
}

function createImageTaskInput(
  overrides: Partial<CreateImageTaskInput> = {},
): CreateImageTaskInput {
  return {
    jobId: "image_job_1",
    modelId: "nano-banana-2",
    modelSpecId: "nano-banana-2-v1",
    submittedInput: {
      prompt: "Glass flowers",
      resolution: "1K",
      aspectRatio: "1:1",
    },
    attachmentMedia: [],
    ...overrides,
  };
}

function createGenerationService() {
  return new GenerationService(undefined, {
    analyticsService: { track: mocks.trackAnalytics },
    attachmentMediaService: {
      resolveSelectionForSubmission: mocks.resolveSelectionForSubmission,
    },
    bflService: {
      createVideoTask: mocks.createBflVideoTask,
      normalizeVideoTaskResult: mocks.normalizeBflVideoTaskResult,
      retrieveVideoTask: mocks.retrieveBflVideoTask,
    },
    bytePlusService: {
      createVideoTask: mocks.createVideoTask,
      normalizeVideoTaskResult: mocks.normalizeVideoTaskResult,
    },
    googleService: {
      generateImage: mocks.generateImage,
    },
    openAIService: {
      generateImage: mocks.generateOpenAIImage,
    },
    klingService: {
      createVideoTask: mocks.createKlingVideoTask,
      normalizeVideoTaskResult: mocks.normalizeKlingVideoTaskResult,
    },
    modelRatesService: {
      estimateGenerationCostForSingleJob:
        mocks.estimateGenerationCostForSingleJob,
    },
    storage: {
      createSignedGetUrlWithExpiration: mocks.createSignedGetUrlWithExpiration,
      downloadObject: mocks.downloadObject,
    },
    transactionManager: {
      transaction: mocks.transaction,
    } as unknown as TransactionManager,
  });
}

function createPublishedModelSpec(
  overrides: Partial<{
    id: string;
    modelId: string;
    providerId: string;
    modelType: "video";
    status: "published" | "archived";
    adapter:
      | "bfl_flux_3_video"
      | "byteplus_seedance_video"
      | "kling_v3_text_to_video"
      | null;
    rateLimitMode: "enforced" | "unlimited";
    spec: VideoModelSpec;
  }> = {},
) {
  return {
    id: "seedance-2.0-video-v1",
    modelId: "seedance-2.0-video",
    modelType: "video",
    providerId: "byteplus",
    status: "published",
    adapter: "byteplus_seedance_video",
    rateLimitMode: "enforced",
    spec: createSeedanceSpec(),
    ...overrides,
  };
}

function createPublishedBflModelSpec() {
  return createPublishedModelSpec({
    id: "flux-3-video-v1",
    modelId: "flux-3-video",
    providerId: "bfl",
    adapter: "bfl_flux_3_video",
    spec: createBflSpec(),
  });
}

function createPublishedImageModelSpec() {
  return {
    id: "nano-banana-2-v1",
    modelId: "nano-banana-2",
    modelType: "image" as const,
    providerId: "google",
    status: "published" as const,
    adapter: "google_gemini_interactions_image" as const,
    rateLimitMode: "enforced" as const,
    spec: createNanoBananaSpec(),
  };
}

function createPublishedOpenAIImageModelSpec() {
  return {
    id: "gpt-image-2-high-v1",
    modelId: "gpt-image-2-high",
    modelType: "image" as const,
    providerId: "openai",
    status: "published" as const,
    adapter: "openai_gpt_image_2" as const,
    rateLimitMode: "enforced" as const,
    spec: {
      ...createNanoBananaSpec(),
      id: "gpt-image-2-high",
      provider: "openai" as const,
      providerModelId: "gpt-image-2-2026-04-21",
      displayName: "GPT Image 2 High",
      endpoint: { method: "POST" as const, path: "/v1/images/generations" },
    },
  };
}

function createNanoBananaSpec(): ImageModelSpec {
  return {
    schemaVersion: 1,
    id: "nano-banana-2-v1",
    provider: "google",
    providerModelId: "gemini-3.1-flash-image",
    displayName: "Nano Banana 2",
    type: "image",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/interactions" },
    modelParameter: { path: ["model"], source: "spec" },
    fields: [
      createField({
        id: "prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: true,
        maxLength: 2_500,
      }),
      createField({
        id: "draft",
        valueKind: "boolean",
        defaultValue: false,
        options: [
          { label: "Full quality", value: false },
          { label: "Draft", value: true },
        ],
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        options: ["512", "1K", "2K", "4K"].map((value) => ({
          label: value,
          value,
        })),
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        options: ["1:1", "16:9"].map((value) => ({
          label: value,
          value,
        })),
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: ["prompt", "resolution", "aspectRatio"],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createSeedanceFastSpec(): VideoModelSpec {
  const spec = createSeedanceSpec({
    id: "seedance-2.0-fast-video",
    providerModelId: "dreamina-seedance-2-0-fast-260128",
    displayName: "Seedance 2.0 Fast",
  });

  return {
    ...spec,
    fields: spec.fields.map((field) =>
      field.id === "resolution"
        ? {
            ...field,
            options: field.options?.filter(
              (option) => option.value !== "1080p" && option.value !== "4k",
            ),
          }
        : field,
    ) as VideoModelSpec["fields"],
  };
}

function createBflSpec(): VideoModelSpec {
  const durations = Array.from({ length: 16 }, (_, index) => index + 5);

  return {
    schemaVersion: 1,
    id: "flux-3-video",
    provider: "bfl",
    providerModelId: "latest",
    displayName: "FLUX 3 Video (Preview)",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/flux-3-video" },
    modelParameter: { path: ["version"], source: "spec" },
    fields: [
      createField({
        id: "prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: true,
        maxLength: 10_000,
      }),
      createField({
        id: "images",
        componentKind: "mediaList",
        valueKind: "array",
        arrayMax: 10,
      }),
      createField({
        id: "videos",
        componentKind: "mediaList",
        valueKind: "array",
        arrayMax: 1,
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        defaultValue: "hd",
        options: ["hd", "fhd"].map((value) => ({ label: value, value })),
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        defaultValue: "auto",
        options: [
          "auto",
          "21:9",
          "2:1",
          "16:9",
          "4:3",
          "1:1",
          "3:4",
          "9:16",
        ].map((value) => ({ label: value, value })),
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        min: 5,
        max: 20,
        defaultValue: 5,
        options: durations.map((value) => ({ label: `${value}s`, value })),
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        defaultValue: true,
        options: [
          { label: "On", value: true },
          { label: "Off", value: false },
        ],
      }),
    ],
    groups: [
      {
        id: "generation",
        label: "Generation",
        fieldIds: [
          "prompt",
          "images",
          "videos",
          "draft",
          "resolution",
          "aspectRatio",
          "duration",
          "generateAudio",
        ],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createSeedanceSpec(
  overrides: Partial<VideoModelSpec> = {},
): VideoModelSpec {
  return {
    schemaVersion: 1,
    id: "seedance-2.0-video",
    provider: "byteplus",
    providerModelId: "dreamina-seedance-2-0-260128",
    displayName: "Seedance 2.0",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: {
      method: "POST",
      path: "/contents/generations/tasks",
    },
    modelParameter: {
      path: ["model"],
      source: "spec",
    },
    fields: [
      createField({
        id: "prompt",
        valueKind: "string",
        maxLength: 10,
      }),
      createField({
        id: "resolution",
        valueKind: "string",
        providerPath: ["resolution"],
        options: [
          { label: "480p", value: "480p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4k", value: "4k" },
        ],
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        providerPath: ["ratio"],
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
        ],
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        providerPath: ["duration"],
        min: -1,
        max: 15,
        options: [
          { label: "Adaptive", value: -1 },
          { label: "5s", value: 5 },
          { label: "10s", value: 10 },
        ],
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        providerPath: ["generate_audio"],
        options: [
          { label: "On", value: true },
          { label: "Off", value: false },
        ],
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: ["prompt"],
        advanced: false,
      },
    ],
    transforms: [{ kind: "seedanceContentArray" }],
    validationRules: ["seedance20ContentRules"],
    ...overrides,
  };
}

function createKlingSpec(): VideoModelSpec {
  const durations = Array.from({ length: 13 }, (_, index) => index + 3);

  return {
    schemaVersion: 1,
    id: "kling-v3-text-to-video-v2",
    provider: "kling",
    providerModelId: "kling-v3",
    displayName: "Kling 3.0 1080p (Pro)",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: { method: "POST", path: "/v1/videos/text2video" },
    modelParameter: { path: ["model_name"], source: "spec" },
    fields: [
      createField({
        id: "prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: true,
        maxLength: 2_500,
        providerPath: ["prompt"],
      }),
      createField({
        id: "resolution",
        componentKind: "hidden",
        valueKind: "string",
        defaultValue: "1080p",
        providerPath: ["mode"],
        options: [{ label: "1080p", value: "1080p" }],
        providerValueMap: [{ canonicalValue: "1080p", providerValue: "pro" }],
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        defaultValue: "16:9",
        providerPath: ["aspect_ratio"],
        options: ["16:9", "9:16", "1:1"].map((value) => ({
          label: value,
          value,
        })),
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        min: 3,
        max: 15,
        defaultValue: 5,
        providerPath: ["duration"],
        options: durations.map((value) => ({
          label: `${value}s`,
          value,
        })),
        providerValueMap: durations.map((value) => ({
          canonicalValue: value,
          providerValue: String(value),
        })),
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        defaultValue: false,
        providerPath: ["sound"],
        options: [
          { label: "Off", value: false },
          { label: "On", value: true },
        ],
        providerValueMap: [
          { canonicalValue: false, providerValue: "off" },
          { canonicalValue: true, providerValue: "on" },
        ],
      }),
      createField({
        id: "callbackUrl",
        componentKind: "hidden",
        valueKind: "string",
        providerPath: ["callback_url"],
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: [
          "prompt",
          "resolution",
          "aspectRatio",
          "duration",
          "generateAudio",
          "callbackUrl",
        ],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

function createField(
  overrides: Partial<GenerationFieldSpec>,
): GenerationFieldSpec {
  return {
    id: "prompt",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}

function createGenerationJobCostWithEstimate(
  overrides: Record<string, unknown> = {},
) {
  return {
    estimatedCostUsdMicros: 462_000,
    currencyCode: "USD",
    estimatedCostSnapshot: createGenerationJobEstimatedCostSnapshot(),
    ...overrides,
  };
}

function createGenerationJobEstimatedCostSnapshot() {
  return {
    schemaVersion: 1,
    jobFacts: {
      outputResolution: "720p",
      outputAspectRatio: "16:9",
      outputDurationSeconds: 5,
      nativeAudio: true,
      voiceControl: false,
      inputIncludesVideo: false,
      inputImageCount: 0,
      requestedGenerations: 1,
    },
    lineItems: [],
    baseCostUsdMicros: 420_000,
    surcharge: {
      pricingPolicyId: "global-generation-surcharge-2026-06-25",
      surchargeBasisPoints: 1000,
      surchargeUsdMicros: 42_000,
    },
    estimatedCostUsdMicros: 462_000,
  };
}

function createStoredVideoAttachment({
  durationSec,
}: {
  durationSec: number | null;
}) {
  return {
    id: "reference_video_1",
    userId: "user_1",
    kind: "video" as const,
    originalFileName: "motion.mp4",
    bucket: "attachments",
    objectKey: "user_1/reference_video_1/motion.mp4",
    contentType: "video/mp4",
    contentLength: 5,
    etag: "etag_1",
    checksumSha256: "checksum_1",
    metadata: {
      widthPx: 1280,
      heightPx: 720,
      durationSec,
      fps: 24,
    },
    fieldId: "videos" as const,
    role: "reference" as const,
    position: 0,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
  };
}

function createPersistedGenerationJobCost(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "estimate_1",
    jobId: "job_1",
    ...createGenerationJobCostWithEstimate(),
    finalCostUsdMicros: null,
    finalCostBasis: null,
    finalizedAt: null,
    providerCostUsdMicros: null,
    providerCostSnapshot: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job_1",
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "queued",
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: "callback-token-hash",
    providerId: "byteplus",
    providerTaskId: null,
    providerModelId: "dreamina-seedance-2-0-260128",
    modelType: "video",
    terminalError: null,
    terminalAt: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createImageJob(overrides: Record<string, unknown> = {}) {
  return createJob({
    id: "image_job_1",
    callbackTokenHash: null,
    providerId: "google",
    providerModelId: "gemini-3.1-flash-image",
    modelType: "image",
    ...overrides,
  });
}

function createSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: 1,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createFluxDraftSubmission(overrides: Record<string, unknown> = {}) {
  return createSubmission({
    modelId: "flux-3-video",
    modelSpecId: "flux-3-video-v1",
    submittedInput: {
      prompt: "A glass whale",
      resolution: "fhd",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: true,
    },
    requestedGenerations: 3,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    ...overrides,
  });
}

function createDraftSourceJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: "source_1",
    submissionIndex: 0,
    status: "succeeded" as const,
    draftCache: {
      bucket: "generation-results",
      objectKey: "generations/jobs/source_1/draft-cache",
      contentType: "application/octet-stream",
      contentLength: 4_096,
      etag: '"cache-etag"',
      checksumSha256: "cache-checksum",
      sourceProviderUrl: "https://delivery.bfl.ai/draft-cache",
    },
    ...overrides,
  };
}

function createImageSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "nano-banana-2",
    modelType: "image" as const,
    modelSpecId: "nano-banana-2-v1",
    submittedInput: {
      prompt: "Glass flowers",
      resolution: "1K",
      aspectRatio: "1:1",
    },
    requestedGenerations: 1,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createGenerationThreadRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread_1",
    projectId: null,
    userId: "user_1",
    name: "A quiet ocean studio",
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createThreadSubmission(
  overrides: Partial<
    Omit<VideoGenerationThreadSubmission, "jobs"> & {
      jobs: Array<
        Partial<
          Omit<VideoGenerationThreadSubmission["jobs"][number], "result">
        > & {
          result?: null | Partial<
            NonNullable<
              VideoGenerationThreadSubmission["jobs"][number]["result"]
            >
          >;
        }
      >;
    }
  > = {},
): VideoGenerationThreadSubmission {
  const {
    jobs: jobOverrides = [{}],
    modelDisplayName = "Seedance 2.0",
    ...submissionOverrides
  } = overrides;

  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName,
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: 1,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:01:00.000Z",
    updatedAt: "2026-06-05T00:02:00.000Z",
    jobs: jobOverrides.map((job, index) =>
      createThreadSubmissionJob(job, index),
    ),
    ...submissionOverrides,
  };
}

function createThreadSubmissionJob(
  overrides: Partial<
    Omit<VideoGenerationThreadSubmission["jobs"][number], "result">
  > & {
    result?: null | Partial<
      NonNullable<VideoGenerationThreadSubmission["jobs"][number]["result"]>
    >;
  } = {},
  index = 0,
): VideoGenerationThreadSubmission["jobs"][number] {
  const { result: resultOverrides, ...jobOverrides } = overrides;
  const result =
    resultOverrides === null
      ? null
      : {
          providerId: "byteplus",
          providerTaskId: "cgt-123",
          providerModelId: "dreamina-seedance-2-0-260128",
          providerStatus: "succeeded" as const,
          videoUrl: "https://provider.example/video.mp4",
          previewImageUrl: null,
          mediaUrlExpiresAt: null,
          assets: [],
          preview: null,
          providerError: null,
          receivedAt: "2026-06-05T00:02:00.000Z",
          createdAt: "2026-06-05T00:02:01.000Z",
          updatedAt: "2026-06-05T00:02:02.000Z",
          ...resultOverrides,
        };

  return {
    id: index === 0 ? "job_1" : `job_${index + 1}`,
    submissionId: "submission_1",
    submissionIndex: index,
    status: "succeeded",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: "2026-06-05T00:01:00.000Z",
    updatedAt: "2026-06-05T00:02:00.000Z",
    result,
    ...jobOverrides,
  };
}

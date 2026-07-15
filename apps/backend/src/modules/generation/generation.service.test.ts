import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TransactionManager } from "../../db/transaction-manager.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import { GenerationAttachmentMediaValidationError } from "../generation-attachment-media/generation-attachment-media.types.ts";
import { GenerationService } from "./generation.service.ts";
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/model.types.ts";
import type {
  CreateVideoGenerationInput,
  CreateVideoTaskInput,
  FinalizeUnsuccessfulGenerationJobInput,
  GenerationThreadSubmission,
} from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  createSignedGetUrlWithExpiration: vi.fn(),
  createVideoTask: vi.fn(),
  trackAnalytics: vi.fn(),
  createThread: vi.fn(),
  getPublishedGenerationModelSpecById: vi.fn(),
  getRunnableGenerationModelSpecById: vi.fn(),
  estimateGenerationCostForSingleJob: vi.fn(),
  insertGenerationSubmission: vi.fn(),
  createGenerationJobCostWithEstimate: vi.fn(),
  getGenerationJobById: vi.fn(),
  getGenerationJobCostByJobId: vi.fn(),
  listSubmissionsFromThread: vi.fn(),
  markGenerationJobFinalCostCalculationFailed: vi.fn(),
  markGenerationJobCancelled: vi.fn(),
  markGenerationJobExpired: vi.fn(),
  markGenerationJobFailed: vi.fn(),
  markGenerationJobSucceeded: vi.fn(),
  normalizeVideoTaskResult: vi.fn(),
  releaseGenerationJobCostReservation: vi.fn(),
  releaseJobConcurrencyLeases: vi.fn(),
  resolveSelectionForSubmission: vi.fn(),
  reserveGenerationJobCostEstimate: vi.fn(),
  touchOwnedThread: vi.fn(),
  transaction: vi.fn(),
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
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getPublishedGenerationModelSpecById:
      mocks.getPublishedGenerationModelSpecById,
    getRunnableGenerationModelSpecById:
      mocks.getRunnableGenerationModelSpecById,
    insertGenerationSubmission: mocks.insertGenerationSubmission,
    listSubmissionsFromThread: mocks.listSubmissionsFromThread,
  },
}));

describe("generation service", () => {
  let generationService: GenerationService;

  beforeEach(() => {
    mocks.createSignedGetUrlWithExpiration.mockReset();
    mocks.createVideoTask.mockReset();
    mocks.trackAnalytics.mockReset();
    mocks.createThread.mockReset();
    mocks.getPublishedGenerationModelSpecById.mockReset();
    mocks.getRunnableGenerationModelSpecById.mockReset();
    mocks.estimateGenerationCostForSingleJob.mockReset();
    mocks.insertGenerationSubmission.mockReset();
    mocks.createGenerationJobCostWithEstimate.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.getGenerationJobCostByJobId.mockReset();
    mocks.listSubmissionsFromThread.mockReset();
    mocks.markGenerationJobFinalCostCalculationFailed.mockReset();
    mocks.markGenerationJobCancelled.mockReset();
    mocks.markGenerationJobExpired.mockReset();
    mocks.markGenerationJobFailed.mockReset();
    mocks.markGenerationJobSucceeded.mockReset();
    mocks.normalizeVideoTaskResult.mockReset();
    mocks.releaseGenerationJobCostReservation.mockReset();
    mocks.releaseJobConcurrencyLeases.mockReset();
    mocks.resolveSelectionForSubmission.mockReset();
    mocks.reserveGenerationJobCostEstimate.mockReset();
    mocks.touchOwnedThread.mockReset();
    mocks.transaction.mockReset();
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
    mocks.listSubmissionsFromThread.mockResolvedValue([]);
    generationService = createGenerationService();
  });

  it("rejects unsupported or unpublished exact model specs", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
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
          callbackToken: expect.any(String),
        },
      ],
      createdThread: createGenerationThreadRecord({ name: "Quiet sea" }),
    });
    expect(result.jobs[0]?.callbackToken).not.toHaveLength(0);
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        threadId: "thread_1",
        input: createInput({
          prompt: "  Quiet sea  ",
        }),
        modelSpec: createPublishedModelSpec(),
        submittedInput: {
          prompt: "Quiet sea",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: [expect.stringMatching(/^[a-f0-9]{64}$/)],
      }),
    );
    expect(mocks.estimateGenerationCostForSingleJob).toHaveBeenCalledWith({
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
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
    expect(mocks.trackAnalytics).toHaveBeenCalledWith({
      type: "generation_submission_created",
      userId: "user_1",
      occurredAt: createSubmission().createdAt,
      submissionId: "submission_1",
      generation: {
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
    });
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
      userId: "user_1",
      input: createInput({
        requestedGenerations: 3,
      }),
    });

    expect(result.jobs).toHaveLength(3);
    expect(new Set(result.jobs.map((job) => job.callbackToken)).size).toBe(3);
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        input: createInput({
          requestedGenerations: 3,
        }),
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

  it("propagates reservation failures", async () => {
    mocks.reserveGenerationJobCostEstimate.mockRejectedValueOnce(
      new InsufficientCreditBalanceError({
        userId: "user_1",
        requiredAmountUsdMicros: 420_000,
      }),
    );

    await expect(
      generationService.createVideoGenerationSubmission({
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
        input: createInput({
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
        }),
        modelSpec: createPublishedModelSpec({
          id: "seedance-2.0-fast-video-v1",
          modelId: "seedance-2.0-fast-video",
          spec: createSeedanceFastSpec(),
        }),
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

  it("propagates attachment media validation failures without creating a submission", async () => {
    mocks.resolveSelectionForSubmission.mockRejectedValueOnce(
      new GenerationAttachmentMediaValidationError(
        "images",
        "attachment media cannot include duplicates",
      ),
    );

    await expect(
      generationService.createVideoGenerationSubmission({
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
      userId: "user_1",
      input: createInput({
        threadId: "thread_1",
      }),
    });

    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        threadId: "thread_1",
        input: expect.objectContaining({
          threadId: "thread_1",
        }),
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
    },
    attachmentMedia: [],
    callbackUrl:
      "https://backend.example/api/generation-callbacks/byteplus/job_1?token=test",
    ...overrides,
  };
}

function createGenerationService() {
  return new GenerationService(undefined, {
    analyticsService: { track: mocks.trackAnalytics },
    attachmentMediaService: {
      resolveSelectionForSubmission: mocks.resolveSelectionForSubmission,
    },
    bytePlusService: {
      createVideoTask: mocks.createVideoTask,
      normalizeVideoTaskResult: mocks.normalizeVideoTaskResult,
    },
    modelRatesService: {
      estimateGenerationCostForSingleJob:
        mocks.estimateGenerationCostForSingleJob,
    },
    storage: {
      createSignedGetUrlWithExpiration: mocks.createSignedGetUrlWithExpiration,
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
    status: "published" | "archived";
    adapter: "byteplus_seedance_video" | null;
    rateLimitMode: "enforced" | "unlimited";
    spec: VideoModelSpec;
  }> = {},
) {
  return {
    id: "seedance-2.0-video-v1",
    modelId: "seedance-2.0-video",
    providerId: "byteplus",
    status: "published",
    adapter: "byteplus_seedance_video",
    rateLimitMode: "enforced",
    spec: createSeedanceSpec(),
    ...overrides,
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

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
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
  } as VideoFieldSpec;
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
    terminalError: null,
    terminalAt: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
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
    Omit<GenerationThreadSubmission, "jobs"> & {
      jobs: Array<
        Partial<Omit<GenerationThreadSubmission["jobs"][number], "result">> & {
          result?: null | Partial<
            NonNullable<GenerationThreadSubmission["jobs"][number]["result"]>
          >;
        }
      >;
    }
  > = {},
): GenerationThreadSubmission {
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
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
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
    Omit<GenerationThreadSubmission["jobs"][number], "result">
  > & {
    result?: null | Partial<
      NonNullable<GenerationThreadSubmission["jobs"][number]["result"]>
    >;
  } = {},
  index = 0,
): GenerationThreadSubmission["jobs"][number] {
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

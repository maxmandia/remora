import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  FinalizeUnsuccessfulGenerationJobInput,
  GenerationThreadSubmission,
} from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  createSignedGetUrlWithExpiration: vi.fn(),
  getLatestPublishedGenerationModelSpec: vi.fn(),
  getPublishedGenerationModelSpecById: vi.fn(),
  estimateGenerationCostForSingleJob: vi.fn(),
  insertGenerationSubmission: vi.fn(),
  createGenerationJobCostWithEstimate: vi.fn(),
  getGenerationJobById: vi.fn(),
  getGenerationJobCostByJobId: vi.fn(),
  listSubmissionsFromThread: vi.fn(),
  markGenerationJobCancelled: vi.fn(),
  markGenerationJobExpired: vi.fn(),
  markGenerationJobFailed: vi.fn(),
  releaseGenerationJobCostReservation: vi.fn(),
  resolveSelectionForSubmission: vi.fn(),
  reserveGenerationJobCostEstimate: vi.fn(),
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
    getLatestPublishedGenerationModelSpec:
      mocks.getLatestPublishedGenerationModelSpec,
    getPublishedGenerationModelSpecById:
      mocks.getPublishedGenerationModelSpecById,
    insertGenerationSubmission: mocks.insertGenerationSubmission,
    listSubmissionsFromThread: mocks.listSubmissionsFromThread,
  },
}));

describe("generation service", () => {
  let generationService: GenerationService;

  beforeEach(() => {
    mocks.createSignedGetUrlWithExpiration.mockReset();
    mocks.getLatestPublishedGenerationModelSpec.mockReset();
    mocks.getPublishedGenerationModelSpecById.mockReset();
    mocks.estimateGenerationCostForSingleJob.mockReset();
    mocks.insertGenerationSubmission.mockReset();
    mocks.createGenerationJobCostWithEstimate.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.getGenerationJobCostByJobId.mockReset();
    mocks.listSubmissionsFromThread.mockReset();
    mocks.markGenerationJobCancelled.mockReset();
    mocks.markGenerationJobExpired.mockReset();
    mocks.markGenerationJobFailed.mockReset();
    mocks.releaseGenerationJobCostReservation.mockReset();
    mocks.resolveSelectionForSubmission.mockReset();
    mocks.reserveGenerationJobCostEstimate.mockReset();
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
          },
        } as unknown as TransactionManager),
    );
    mocks.createSignedGetUrlWithExpiration.mockImplementation(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
    mocks.getLatestPublishedGenerationModelSpec.mockImplementation(
      async (modelId: string) => {
        if (modelId === "seedance-2.0-fast-video") {
          return createPublishedModelSpec({
            id: "seedance-2.0-fast-video-v1",
            modelId,
            spec: createSeedanceFastSpec(),
          });
        }

        if (modelId === "seedance-2.0-video") {
          return createPublishedModelSpec();
        }

        return null;
      },
    );
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
        userId: "user_1",
      }),
    );
    mocks.getGenerationJobCostByJobId.mockResolvedValue(
      createPersistedGenerationJobCost(),
    );
    mocks.markGenerationJobCancelled.mockResolvedValue(
      createJob({
        status: "cancelled",
      }),
    );
    mocks.markGenerationJobExpired.mockResolvedValue(
      createJob({
        status: "expired",
      }),
    );
    mocks.markGenerationJobFailed.mockResolvedValue(
      createJob({
        status: "failed",
      }),
    );
    mocks.releaseGenerationJobCostReservation.mockResolvedValue({
      userId: "user_1",
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
      ledgerEntryId: "ledger_2",
    });
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

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects unsupported models before querying persistence", async () => {
    await expect(
      generationService.createVideoGenerationSubmission({
        userId: "user_1",
        input: createInput({
          modelId: "kling-v3-text-to-video",
        }),
      }),
    ).rejects.toBeInstanceOf(UnsupportedGenerationModelError);
    expect(mocks.getLatestPublishedGenerationModelSpec).not.toHaveBeenCalled();
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
    });
    expect(result.jobs[0]?.callbackToken).not.toHaveLength(0);
    expect(mocks.insertGenerationSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
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
    expect(mocks.reserveGenerationJobCostEstimate).toHaveBeenCalledWith(
      {
        userId: "user_1",
        generationSubmissionId: "submission_1",
        generationJobId: "job_1",
        generationJobCostId: "job_1_estimate",
        estimatedCostUsdMicros: 462_000,
      },
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
      const markedJob = createJob({ status: input.status });
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
      expect(mark()).toHaveBeenCalledWith(input);
    },
  );

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
    ).rejects.toThrow("Generation job cost was already finalized for job job_1");
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
    const fetchMock = vi.fn(async (_url: URL | string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "dreamina-seedance-2-0-fast-260128",
      });

      return new Response(JSON.stringify({ id: "cgt-fast" }), {
        status: 200,
      });
    });
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "ark-test-key");
    vi.stubEnv("BYTEPLUS_ARK_BASE_URL", "https://ark.example.test/api/v3");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generationService.createSeedanceVideoTask({
        modelId: "seedance-2.0-fast-video",
        modelSpecId: "seedance-2.0-fast-video-v1",
        prompt: "Quiet sea",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-fast",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    expect(mocks.getPublishedGenerationModelSpecById).toHaveBeenCalledWith({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
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
        input: expect.objectContaining({
          threadId: "thread_1",
        }),
      }),
    );
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

function createInput(overrides: Partial<CreateVideoGenerationInput> = {}) {
  return {
    modelId: "seedance-2.0-video",
    prompt: "Quiet sea",
    resolution: "720p",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };
}

function createGenerationService() {
  return new GenerationService(undefined, {
    attachmentMediaService: {
      resolveSelectionForSubmission: mocks.resolveSelectionForSubmission,
    },
    modelRatesService: {
      estimateGenerationCostForSingleJob:
        mocks.estimateGenerationCostForSingleJob,
    },
    storage: {
      createSignedGetUrlWithExpiration:
        mocks.createSignedGetUrlWithExpiration,
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
    spec: VideoModelSpec;
  }> = {},
) {
  return {
    id: "seedance-2.0-video-v1",
    modelId: "seedance-2.0-video",
    providerId: "byteplus",
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
  const { jobs: jobOverrides = [{}], ...submissionOverrides } = overrides;

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

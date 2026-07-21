import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationPreviewError } from "../modules/generation/generation-preview.service.ts";
import type {
  GenerationJobWithSubmissionContext,
  GenerationProviderTaskResult,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
import { GoogleProviderError } from "../modules/generation/providers/google/google.types.ts";
import type { StoredObjectReference } from "../modules/storage/object-storage.service.ts";
import type { CreateAndStoreImageActivityInput } from "./types.ts";

type ImportRemoteObjectInput = {
  objectKey: string;
  sourceUrl: string;
};

type UploadObjectInput = {
  objectKey: string;
  body: NodeJS.ReadableStream;
  contentLength: number | null;
  contentType: string | null;
  sourceUrl?: string | null;
};

const mocks = vi.hoisted(() => ({
  accrueGenerationJobProviderCost: vi.fn(),
  createImageTask: vi.fn(),
  createVideoTask: vi.fn(),
  finalizeUnsuccessfulGenerationJob: vi.fn(),
  markGenerationJobFinalCostCalculationFailed: vi.fn(),
  markGenerationJobSucceeded: vi.fn(),
  reserveProviderSubmissionCapacity: vi.fn(),
  settleGenerationJobCost: vi.fn(),
  getGenerationJobById: vi.fn(),
  createGenerationResultPreview: vi.fn(),
  importRemoteObject:
    vi.fn<(input: ImportRemoteObjectInput) => Promise<StoredObjectReference>>(),
  uploadObject:
    vi.fn<(input: UploadObjectInput) => Promise<StoredObjectReference>>(),
  prepareSignedAttachmentMediaForSubmission: vi.fn(),
  publishInternalEvent: vi.fn(),
  transaction: vi.fn(),
  upsertGenerationResult: vi.fn(),
}));

vi.mock("../modules/storage/object-storage.service.ts", () => ({
  ObjectStorageService: {
    joinObjectKey: (...segments: string[]) =>
      segments
        .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/"),
  },
  objectStorageService: {
    importRemoteObject: mocks.importRemoteObject,
    uploadObject: mocks.uploadObject,
  },
}));

vi.mock("../modules/generation/generation.repository.ts", () => ({
  generationRepository: {
    getGenerationJobById: mocks.getGenerationJobById,
    upsertGenerationResult: mocks.upsertGenerationResult,
  },
}));

vi.mock("../app.service.ts", () => ({
  transactionManager: {
    transaction: mocks.transaction,
  },
  generationAttachmentMediaService: {
    prepareSignedAttachmentMediaForSubmission:
      mocks.prepareSignedAttachmentMediaForSubmission,
  },
  generationService: {
    createImageTask: mocks.createImageTask,
    createVideoTask: mocks.createVideoTask,
    finalizeUnsuccessfulGenerationJob: mocks.finalizeUnsuccessfulGenerationJob,
    markGenerationJobFinalCostCalculationFailed:
      mocks.markGenerationJobFinalCostCalculationFailed,
    markGenerationJobSucceeded: mocks.markGenerationJobSucceeded,
  },
  modelRateLimitsService: {
    reserveProviderSubmissionCapacity: mocks.reserveProviderSubmissionCapacity,
  },
  generationCostFinalizationService: {
    accrueGenerationJobProviderCost: mocks.accrueGenerationJobProviderCost,
  },
  modelRatesService: {
    settleGenerationJobCost: mocks.settleGenerationJobCost,
  },
}));

vi.mock("../modules/generation/generation-preview.service.ts", () => {
  class GenerationPreviewError extends Error {
    readonly code: "FFMPEG_BINARY_MISSING" | "FRAME_EXTRACTION_FAILED";

    constructor({
      code,
      message,
    }: {
      code: GenerationPreviewError["code"];
      message: string;
    }) {
      super(message);
      this.name = "GenerationPreviewError";
      this.code = code;
    }
  }

  return {
    GenerationPreviewError,
    generationPreviewService: {
      createGenerationResultPreview: mocks.createGenerationResultPreview,
    },
  };
});

vi.mock("../modules/realtime/realtime.repository.ts", () => ({
  realtimeRepository: {
    publishInternalEvent: mocks.publishInternalEvent,
  },
}));

import {
  accrueGenerationProviderCostActivity,
  createAndStoreImageActivity,
  createGenerationResultPreviewActivity,
  createVideoTaskActivity,
  finalizeUnsuccessfulGenerationJobActivity,
  markGenerationJobFinalCostCalculationFailedActivity,
  markGenerationJobSucceededActivity,
  prepareGenerationAttachmentMediaActivity,
  publishGenerationJobSucceededRealtimeEventActivity,
  reserveProviderSubmissionCapacityActivity,
  saveGenerationMediaActivity,
  settleGenerationJobCostActivity,
  upsertGenerationResultActivity,
} from "./activities.ts";

describe("Temporal generation activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          generation: {
            upsertGenerationResult: mocks.upsertGenerationResult,
          },
        }),
    );
    mocks.importRemoteObject.mockImplementation(async (input) => {
      return {
        bucket: "remora-dev-media",
        objectKey: input.objectKey,
        contentType: "video/mp4",
        contentLength: 1024,
        etag: '"video-etag"',
        checksumSha256: "video-checksum",
      };
    });
    mocks.uploadObject.mockImplementation(async (input) => {
      return {
        bucket: "remora-dev-media",
        objectKey: input.objectKey,
        contentType: input.contentType,
        contentLength: input.contentLength,
        etag: '"image-etag"',
        checksumSha256: "image-checksum",
      };
    });
    mocks.createGenerationResultPreview.mockResolvedValue(
      createStoredPreview(),
    );
    mocks.prepareSignedAttachmentMediaForSubmission.mockResolvedValue([]);
    mocks.markGenerationJobSucceeded.mockResolvedValue(
      createJob({ status: "succeeded" }),
    );
    mocks.markGenerationJobFinalCostCalculationFailed.mockResolvedValue(
      createJob({ status: "final_cost_calculation_failure" }),
    );
    mocks.createVideoTask.mockResolvedValue({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
    });
    mocks.createImageTask.mockResolvedValue(createImageTaskResult());
    mocks.accrueGenerationJobProviderCost.mockResolvedValue(
      createGoogleProviderCost(),
    );
    mocks.settleGenerationJobCost.mockResolvedValue(
      createBytePlusProviderCost(),
    );
    mocks.reserveProviderSubmissionCapacity.mockResolvedValue({
      status: "reserved",
      reservedAt: new Date("2026-07-07T12:00:00.000Z"),
    });
  });

  it("creates video tasks through the generation service", async () => {
    const input = {
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
      callbackUrl: "https://api.example.test/callback",
    };

    await expect(createVideoTaskActivity(input)).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-123",
      providerModelId: "dreamina-seedance-2-0-260128",
    });
    expect(mocks.createVideoTask).toHaveBeenCalledWith(input);
  });

  it("creates an image once and uploads the decoded bytes without crossing the workflow boundary", async () => {
    const input = createImageTaskInput();
    const result = await createAndStoreImageActivity(input);

    expect(result).toEqual({
      callback: createImageProviderCallback(),
      storedAsset: createStoredAsset({
        kind: "image",
        objectKey: "generations/jobs/job_image_1/image",
        contentType: "image/jpeg",
        contentLength: 4,
        etag: '"image-etag"',
        checksumSha256: "image-checksum",
        sourceProviderUrl: null,
      }),
      storageError: null,
    });
    expect(mocks.createImageTask).toHaveBeenCalledTimes(1);
    expect(mocks.createImageTask).toHaveBeenCalledWith(input);
    expect(mocks.uploadObject).toHaveBeenCalledTimes(1);
    expect(mocks.uploadObject).toHaveBeenCalledWith({
      objectKey: "generations/jobs/job_image_1/image",
      body: expect.anything(),
      contentLength: 4,
      contentType: "image/jpeg",
      sourceUrl: null,
    });
    expect("image" in (result as unknown as Record<string, unknown>)).toBe(
      false,
    );
  });

  it("preserves safe Google rejection details at the Temporal boundary", async () => {
    mocks.createImageTask.mockRejectedValue(
      new GoogleProviderError(
        "Google image request was rejected: Billing is required (HTTP 403, code PERMISSION_DENIED)",
        {
          code: "PERMISSION_DENIED",
          statusCode: 403,
          providerMessage: "Billing is required",
        },
      ),
    );

    await expect(
      createAndStoreImageActivity(createImageTaskInput()),
    ).rejects.toMatchObject({
      name: "ApplicationFailure",
      message:
        "Google image request was rejected: Billing is required (HTTP 403, code PERMISSION_DENIED)",
      type: "PERMISSION_DENIED",
      nonRetryable: true,
      details: [{ statusCode: 403 }],
    });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("retries only the image upload and never repeats a successful provider request", async () => {
    mocks.uploadObject
      .mockRejectedValueOnce(new Error("R2 temporarily unavailable"))
      .mockRejectedValueOnce(new Error("R2 still unavailable"));

    await expect(
      createAndStoreImageActivity(createImageTaskInput()),
    ).resolves.toMatchObject({
      storedAsset: {
        kind: "image",
        objectKey: "generations/jobs/job_image_1/image",
      },
      storageError: null,
    });
    expect(mocks.createImageTask).toHaveBeenCalledTimes(1);
    expect(mocks.uploadObject).toHaveBeenCalledTimes(3);
  });

  it("returns sanitized provider metadata when all image upload retries fail", async () => {
    mocks.uploadObject.mockRejectedValue(new Error("R2 unavailable"));

    await expect(
      createAndStoreImageActivity(createImageTaskInput()),
    ).resolves.toEqual({
      callback: createImageProviderCallback(),
      storedAsset: null,
      storageError: {
        source: "internal",
        code: "GENERATION_MEDIA_STORAGE_FAILED",
        message: "Generated media could not be copied into durable storage",
      },
    });
    expect(mocks.createImageTask).toHaveBeenCalledTimes(1);
    expect(mocks.uploadObject).toHaveBeenCalledTimes(3);
  });

  it("reserves provider capacity through the model rate limits service", async () => {
    const input = {
      jobId: "job_1",
      modelSpecId: "seedance-2.0-video-v1",
      providerId: "byteplus",
      facts: { outputResolution: "720p" },
    };

    await expect(
      reserveProviderSubmissionCapacityActivity(input),
    ).resolves.toEqual({
      status: "reserved",
      reservedAt: new Date("2026-07-07T12:00:00.000Z"),
    });
    expect(mocks.reserveProviderSubmissionCapacity).toHaveBeenCalledWith(input);
  });

  it("imports succeeded provider media and returns stored asset references", async () => {
    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: "https://assets.example/video.mp4",
      }),
    ).resolves.toEqual([
      createStoredAsset({
        objectKey: "generations/jobs/job_1/video.mp4",
      }),
    ]);
    expect(mocks.importRemoteObject).toHaveBeenCalledTimes(1);
    expect(mocks.importRemoteObject).toHaveBeenCalledWith({
      sourceUrl: "https://assets.example/video.mp4",
      objectKey: "generations/jobs/job_1/video.mp4",
    });
  });

  it("fails succeeded media import when the provider omitted the required video URL", async () => {
    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: null,
      }),
    ).rejects.toThrow(
      "Succeeded provider callback did not include a video URL",
    );
    expect(mocks.importRemoteObject).not.toHaveBeenCalled();
  });

  it("passes stored asset references through result persistence", async () => {
    const storedAsset = createStoredAsset();
    const storedPreview = createStoredPreview();
    const callback = createProviderCallback();
    mocks.upsertGenerationResult.mockResolvedValueOnce({ id: "result_1" });

    await upsertGenerationResultActivity({
      jobId: "job_1",
      callback,
      storedAssets: [storedAsset],
      storedPreview,
    });

    expect(mocks.upsertGenerationResult).toHaveBeenCalledWith({
      jobId: "job_1",
      result: callback.result,
      rawPayload: callback.rawPayload,
      receivedAt: new Date("2026-06-05T00:00:00.000Z"),
      storedAssets: [storedAsset],
      storedPreview,
    });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("delegates generation job cost settlement to the model rates service", async () => {
    const callback = createProviderCallback();

    await settleGenerationJobCostActivity({
      jobId: "job_1",
      callback,
    });

    expect(mocks.settleGenerationJobCost).toHaveBeenCalledWith({
      jobId: "job_1",
      callback,
    });
  });

  it("delegates provider-spend accrual to generation cost finalization", async () => {
    const callback = createImageProviderCallback();

    await accrueGenerationProviderCostActivity({
      jobId: "job_image_1",
      callback,
    });

    expect(mocks.accrueGenerationJobProviderCost).toHaveBeenCalledWith({
      jobId: "job_image_1",
      callback,
    });
    expect(mocks.settleGenerationJobCost).not.toHaveBeenCalled();
  });

  it("delegates unsuccessful job finalization to the generation service", async () => {
    await finalizeUnsuccessfulGenerationJobActivity({
      jobId: "job_1",
      status: "failed",
      terminalError: {
        source: "provider",
        code: "ProviderTaskError",
        message: "Provider task failed",
      },
    });

    expect(mocks.finalizeUnsuccessfulGenerationJob).toHaveBeenCalledWith({
      jobId: "job_1",
      status: "failed",
      terminalError: {
        source: "provider",
        code: "ProviderTaskError",
        message: "Provider task failed",
      },
    });
  });

  it("delegates succeeded job marking to the generation service", async () => {
    await markGenerationJobSucceededActivity({
      jobId: "job_1",
    });

    expect(mocks.markGenerationJobSucceeded).toHaveBeenCalledWith({
      jobId: "job_1",
    });
  });

  it("delegates final cost calculation failures to the generation service", async () => {
    await markGenerationJobFinalCostCalculationFailedActivity({
      jobId: "job_1",
      terminalError: {
        source: "internal",
        code: "FINAL_COST_CALCULATION_FAILED",
        message: "Model rates unavailable",
      },
    });

    expect(
      mocks.markGenerationJobFinalCostCalculationFailed,
    ).toHaveBeenCalledWith({
      jobId: "job_1",
      terminalError: {
        source: "internal",
        code: "FINAL_COST_CALCULATION_FAILED",
        message: "Model rates unavailable",
      },
    });
  });

  it("creates generation result previews from stored videos", async () => {
    const video = createStoredAsset();

    await expect(
      createGenerationResultPreviewActivity({
        jobId: "job_1",
        video,
      }),
    ).resolves.toEqual(createStoredPreview());
    expect(mocks.createGenerationResultPreview).toHaveBeenCalledWith({
      jobId: "job_1",
      video,
    });
  });

  it("makes a missing ffmpeg executable non-retryable", async () => {
    mocks.createGenerationResultPreview.mockRejectedValueOnce(
      new GenerationPreviewError({
        code: "FFMPEG_BINARY_MISSING",
        message: "ffmpeg executable was not found on PATH: ffmpeg",
      }),
    );

    await expect(
      createGenerationResultPreviewActivity({
        jobId: "job_1",
        video: createStoredAsset(),
      }),
    ).rejects.toMatchObject({
      nonRetryable: true,
      type: "FFMPEG_BINARY_MISSING",
    });
  });

  it("leaves ordinary preview extraction failures retryable", async () => {
    const extractionError = new GenerationPreviewError({
      code: "FRAME_EXTRACTION_FAILED",
      message: "ffmpeg could not extract a preview frame from the video",
    });
    mocks.createGenerationResultPreview.mockRejectedValueOnce(extractionError);

    await expect(
      createGenerationResultPreviewActivity({
        jobId: "job_1",
        video: createStoredAsset(),
      }),
    ).rejects.toBe(extractionError);
  });

  it("prepares provider-neutral signed attachment media", async () => {
    mocks.prepareSignedAttachmentMediaForSubmission.mockResolvedValueOnce([
      {
        fieldId: "images",
        role: "firstFrame",
        url: "https://signed.example/first.png",
      },
      {
        fieldId: "images",
        role: "lastFrame",
        url: "https://signed.example/last.png",
      },
    ]);

    await expect(
      prepareGenerationAttachmentMediaActivity({
        submissionId: "submission_1",
      }),
    ).resolves.toEqual([
      {
        fieldId: "images",
        role: "firstFrame",
        url: "https://signed.example/first.png",
      },
      {
        fieldId: "images",
        role: "lastFrame",
        url: "https://signed.example/last.png",
      },
    ]);
    expect(
      mocks.prepareSignedAttachmentMediaForSubmission,
    ).toHaveBeenCalledWith({
      submissionId: "submission_1",
    });
  });

  it("publishes generation succeeded realtime events for succeeded jobs", async () => {
    mocks.getGenerationJobById.mockResolvedValueOnce(
      createJob({ status: "succeeded" }),
    );

    await publishGenerationJobSucceededRealtimeEventActivity({
      jobId: "job_1",
    });

    expect(mocks.publishInternalEvent).toHaveBeenCalledWith({
      id: "generation.job.succeeded:job_1",
      type: "generation.job.succeeded",
      occurredAt: expect.any(String),
      userId: "user_1",
      payload: {
        jobId: "job_1",
        threadId: "thread_1",
      },
    });
  });
});

function createImageTaskInput(): CreateAndStoreImageActivityInput {
  return {
    jobId: "job_image_1",
    modelId: "nano-banana-2",
    modelSpecId: "nano-banana-2-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "1K",
      aspectRatio: "1:1",
    },
    attachmentMedia: [
      {
        fieldId: "images",
        role: "reference",
        url: "https://signed.example/reference.png",
        contentType: "image/png",
        contentLength: 2048,
      },
    ],
  };
}

function createImageTaskResult() {
  return {
    provider: "google" as const,
    providerTaskId: "interaction_123",
    providerModelId: "gemini-3.1-flash-image",
    image: {
      data: Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
      contentType: "image/jpeg" as const,
      contentLength: 4,
    },
    usage: {
      inputTokens: 100,
      outputTextTokens: 20,
      outputImageTokens: 1_120,
      thoughtTokens: 10,
      totalTokens: 1_250,
    },
    rawPayload: {
      id: "interaction_123",
      status: "completed",
      outputImageCount: 1,
    },
    receivedAt: "2026-07-07T12:01:00.000Z",
  };
}

function createImageProviderCallback() {
  return {
    kind: "result" as const,
    result: {
      provider: "google" as const,
      providerTaskId: "interaction_123",
      providerModelId: "gemini-3.1-flash-image",
      status: "succeeded" as const,
      videoUrl: null,
      usage: {
        completionTokens: null,
        totalTokens: 1_250,
        inputTokens: 100,
        outputTextTokens: 20,
        outputImageTokens: 1_120,
        thoughtTokens: 10,
      },
      createdAt: null,
      updatedAt: null,
      providerError: null,
    },
    rawPayload: {
      id: "interaction_123",
      status: "completed",
      outputImageCount: 1,
    },
    receivedAt: "2026-07-07T12:01:00.000Z",
  };
}

function createBytePlusProviderCost() {
  return {
    providerCostUsdMicros: 864_192,
    providerCostSnapshot: {
      provider: "byteplus",
    },
  };
}

function createGoogleProviderCost() {
  return {
    providerCostUsdMicros: 67_000,
    providerCostSnapshot: {
      provider: "google",
      incompleteUsage: false,
    },
  };
}

function createProviderCallback(
  overrides: Partial<GenerationProviderTaskResult> = {},
) {
  const result = {
    provider: "byteplus" as const,
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    status: "succeeded" as const,
    videoUrl: "https://assets.example/video.mp4",
    usage: null,
    createdAt: 1780770000,
    updatedAt: 1780770060,
    providerError: null,
    ...overrides,
  };

  return {
    kind: "result" as const,
    result,
    rawPayload: {
      id: result.providerTaskId,
      status: result.status,
      content: {
        video_url: result.videoUrl,
      },
    },
    receivedAt: "2026-06-05T00:00:00.000Z",
  };
}

function createStoredAsset(
  overrides: Partial<StoredGenerationResultAssetReference> = {},
): StoredGenerationResultAssetReference {
  return {
    kind: "video",
    bucket: "remora-dev-media",
    objectKey: "jobs/job_1/video.mp4",
    contentType: "video/mp4",
    contentLength: 1024,
    etag: '"video-etag"',
    checksumSha256: "video-checksum",
    sourceProviderUrl: "https://assets.example/video.mp4",
    ...overrides,
  };
}

function createStoredPreview(
  overrides: Partial<StoredGenerationResultPreviewReference> = {},
): StoredGenerationResultPreviewReference {
  return {
    bucket: "remora-dev-media",
    objectKey: "jobs/job_1/preview.jpg",
    contentType: "image/jpeg",
    contentLength: 4321,
    etag: '"preview-etag"',
    checksumSha256: "preview-sha256",
    frameTimeMs: 1000,
    ...overrides,
  };
}

function createJob(
  overrides: Partial<
    Extract<GenerationJobWithSubmissionContext, { modelType: "video" }>
  > = {},
): GenerationJobWithSubmissionContext {
  return {
    id: "job_1",
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "queued",
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: "callback-token-hash",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    terminalAt: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: 1,
    attachmentMedia: [],
    ...overrides,
  };
}

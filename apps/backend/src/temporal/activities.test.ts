import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationPreviewError } from "../modules/generation/generation-preview.service.ts";
import type {
  GenerationJobWithSubmissionContext,
  GenerationProviderTaskResult,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
import { GoogleProviderError } from "../modules/generation/providers/google/google.types.ts";
import { BflProviderError } from "../modules/generation/providers/bfl/bfl.types.ts";
import { OpenAIProviderError } from "../modules/generation/providers/openai/openai.types.ts";
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
  createModel3dTask: vi.fn(),
  createVideoTask: vi.fn(),
  finalizeUnsuccessfulGenerationJob: vi.fn(),
  markGenerationJobFinalCostCalculationFailed: vi.fn(),
  markGenerationJobSucceeded: vi.fn(),
  pollVideoTask: vi.fn(),
  pollModel3dTask: vi.fn(),
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
    createModel3dTask: mocks.createModel3dTask,
    createVideoTask: mocks.createVideoTask,
    finalizeUnsuccessfulGenerationJob: mocks.finalizeUnsuccessfulGenerationJob,
    markGenerationJobFinalCostCalculationFailed:
      mocks.markGenerationJobFinalCostCalculationFailed,
    markGenerationJobSucceeded: mocks.markGenerationJobSucceeded,
    pollVideoTask: mocks.pollVideoTask,
    pollModel3dTask: mocks.pollModel3dTask,
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
  createModel3dTaskActivity,
  createVideoTaskActivity,
  finalizeUnsuccessfulGenerationJobActivity,
  markGenerationJobFinalCostCalculationFailedActivity,
  markGenerationJobSucceededActivity,
  pollVideoTaskActivity,
  pollModel3dTaskActivity,
  prepareGenerationAttachmentMediaActivity,
  publishGenerationJobFailedRealtimeEventActivity,
  publishGenerationJobSucceededRealtimeEventActivity,
  reserveProviderSubmissionCapacityActivity,
  saveGenerationMediaActivity,
  saveGenerationModel3dActivity,
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

  it("makes BFL authentication and validation polling failures non-retryable", async () => {
    mocks.pollVideoTask.mockRejectedValue(
      new BflProviderError({
        code: "invalid_request",
        message: "BFL rejected the polling request",
        providerMessage: "Invalid task identifier",
        retryable: false,
        statusCode: 422,
      }),
    );

    await expect(
      pollVideoTaskActivity({
        modelId: "flux-3-video",
        modelSpecId: "flux-3-video-v1",
        providerTaskId: "bfl-task-1",
        pollingUrl: "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
      }),
    ).rejects.toMatchObject({
      name: "ApplicationFailure",
      type: "invalid_request",
      nonRetryable: true,
      details: [
        {
          statusCode: 422,
          providerMessage: "Invalid task identifier",
        },
      ],
    });
  });

  it("leaves retryable BFL polling failures retryable", async () => {
    const error = new BflProviderError({
      code: "rate_limit",
      message: "BFL polling was rate limited",
      providerMessage: null,
      retryable: true,
      statusCode: 429,
    });
    mocks.pollVideoTask.mockRejectedValue(error);

    await expect(
      pollVideoTaskActivity({
        modelId: "flux-3-video",
        modelSpecId: "flux-3-video-v1",
        providerTaskId: "bfl-task-1",
        pollingUrl: "https://api.bfl.ai/v1/get_result?id=bfl-task-1",
      }),
    ).rejects.toBe(error);
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
        draft: false,
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
          interactionStatus: "completed",
          diagnostics: {
            interactionId: "interaction_123",
            interactionStatus: "completed",
            providerCode: "PERMISSION_DENIED",
            providerMessage: "Billing is required",
            stepTypes: ["model_output"],
            contentTypes: ["text"],
            imageCount: 0,
          },
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
      details: [
        {
          statusCode: 403,
          providerMessage: "Billing is required",
          diagnostics: {
            interactionId: "interaction_123",
            interactionStatus: "completed",
            providerCode: "PERMISSION_DENIED",
            providerMessage: "Billing is required",
            stepTypes: ["model_output"],
            contentTypes: ["text"],
            imageCount: 0,
          },
        },
      ],
    });
    expect(mocks.createImageTask).toHaveBeenCalledOnce();
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("makes non-retryable OpenAI rejections terminal at the Temporal boundary", async () => {
    mocks.createImageTask.mockRejectedValue(
      new OpenAIProviderError("OpenAI image request was rejected", {
        code: "content_policy_violation",
        retryable: false,
        statusCode: 400,
        requestId: "request-1",
        providerMessage: "The request was rejected by safety policy",
      }),
    );

    await expect(
      createAndStoreImageActivity(createImageTaskInput()),
    ).rejects.toMatchObject({
      name: "ApplicationFailure",
      type: "content_policy_violation",
      nonRetryable: true,
      details: [
        {
          code: "content_policy_violation",
          statusCode: 400,
          requestId: "request-1",
          retryable: false,
          providerMessage: "The request was rejected by safety policy",
        },
      ],
    });
    expect(mocks.uploadObject).not.toHaveBeenCalled();
  });

  it("leaves transient OpenAI failures retryable", async () => {
    const error = new OpenAIProviderError("OpenAI image request failed", {
      code: "rate_limit_exceeded",
      retryable: true,
      statusCode: 429,
    });
    mocks.createImageTask.mockRejectedValue(error);

    await expect(
      createAndStoreImageActivity(createImageTaskInput()),
    ).rejects.toBe(error);
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
    ).resolves.toEqual({
      storedAssets: [
        createStoredAsset({
          objectKey: "generations/jobs/job_1/video.mp4",
        }),
      ],
      storedDraftCache: null,
    });
    expect(mocks.importRemoteObject).toHaveBeenCalledTimes(1);
    expect(mocks.importRemoteObject).toHaveBeenCalledWith({
      sourceUrl: "https://assets.example/video.mp4",
      objectKey: "generations/jobs/job_1/video.mp4",
    });
  });

  it("imports a draft cache at the deterministic job key", async () => {
    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: "https://assets.example/video.mp4",
        draftCacheUrl: "https://assets.example/draft-cache",
      }),
    ).resolves.toMatchObject({
      storedDraftCache: {
        bucket: "remora-dev-media",
        objectKey: "generations/jobs/job_1/draft-cache",
        sourceProviderUrl: "https://assets.example/draft-cache",
      },
    });
    expect(mocks.importRemoteObject).toHaveBeenNthCalledWith(2, {
      sourceUrl: "https://assets.example/draft-cache",
      objectKey: "generations/jobs/job_1/draft-cache",
    });
  });

  it("fails required-output storage when the draft cache import fails", async () => {
    mocks.importRemoteObject
      .mockResolvedValueOnce(createStoredObject())
      .mockRejectedValueOnce(new Error("cache unavailable"));

    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: "https://assets.example/video.mp4",
        draftCacheUrl: "https://assets.example/draft-cache",
      }),
    ).rejects.toThrow("cache unavailable");
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

  it("delegates Tripo task creation and polling", async () => {
    const task = {
      provider: "tripo" as const,
      providerTaskId: "task-1",
      providerModelId: "v3.1-20260211",
      pollingUrl: null,
    };
    const callback = createTripoProviderCallback();
    mocks.createModel3dTask.mockResolvedValueOnce(task);
    mocks.pollModel3dTask.mockResolvedValueOnce(callback);
    const createInput = {
      jobId: "job_model_1",
      modelId: "tripo-h3-1-text-to-3d",
      modelSpecId: "tripo-h3-1-text-to-3d-v1",
      submittedInput: {
        prompt: "A ceramic fox",
        textureLevel: "standard" as const,
        faceLimit: null,
        geometryQuality: "standard" as const,
      },
      attachmentMedia: [],
    };

    await expect(createModel3dTaskActivity(createInput)).resolves.toEqual(task);
    await expect(
      pollModel3dTaskActivity({
        modelId: createInput.modelId,
        modelSpecId: createInput.modelSpecId,
        providerTaskId: task.providerTaskId,
      }),
    ).resolves.toEqual(callback);
    expect(mocks.createModel3dTask).toHaveBeenCalledWith(createInput);
    expect(mocks.pollModel3dTask).toHaveBeenCalledWith({
      modelId: createInput.modelId,
      modelSpecId: createInput.modelSpecId,
      providerTaskId: task.providerTaskId,
    });
  });

  it("stores the GLB and rendered image immediately", async () => {
    mocks.importRemoteObject
      .mockResolvedValueOnce({
        bucket: "remora-dev-media",
        objectKey: "generations/jobs/job_model_1/model.glb",
        contentType: "model/gltf-binary",
        contentLength: 4_096,
        etag: '"model-etag"',
        checksumSha256: "model-sha256",
      })
      .mockResolvedValueOnce({
        bucket: "remora-dev-media",
        objectKey: "generations/jobs/job_model_1/image",
        contentType: "image/png",
        contentLength: 1_024,
        etag: '"image-etag"',
        checksumSha256: "image-sha256",
      });

    await expect(
      saveGenerationModel3dActivity({
        jobId: "job_model_1",
        modelUrl: "https://assets.example/model.glb",
        renderedImageUrl: "https://assets.example/preview.png",
      }),
    ).resolves.toEqual({
      storedAssets: [
        expect.objectContaining({
          kind: "model3d",
          objectKey: "generations/jobs/job_model_1/model.glb",
        }),
        expect.objectContaining({
          kind: "image",
          objectKey: "generations/jobs/job_model_1/image",
        }),
      ],
    });
    expect(mocks.importRemoteObject).toHaveBeenNthCalledWith(1, {
      sourceUrl: "https://assets.example/model.glb",
      objectKey: "generations/jobs/job_model_1/model.glb",
    });
    expect(mocks.importRemoteObject).toHaveBeenNthCalledWith(2, {
      sourceUrl: "https://assets.example/preview.png",
      objectKey: "generations/jobs/job_model_1/image",
    });
  });

  it("keeps a stored GLB when optional preview import fails", async () => {
    mocks.importRemoteObject
      .mockResolvedValueOnce({
        bucket: "remora-dev-media",
        objectKey: "generations/jobs/job_model_1/model.glb",
        contentType: "model/gltf-binary",
        contentLength: 4_096,
        etag: '"model-etag"',
        checksumSha256: "model-sha256",
      })
      .mockRejectedValueOnce(new Error("preview URL expired"));

    await expect(
      saveGenerationModel3dActivity({
        jobId: "job_model_1",
        modelUrl: "https://assets.example/model.glb",
        renderedImageUrl: "https://assets.example/preview.png",
      }),
    ).resolves.toEqual({
      storedAssets: [expect.objectContaining({ kind: "model3d" })],
    });
  });

  it("fails when the mandatory GLB cannot be stored", async () => {
    mocks.importRemoteObject.mockRejectedValueOnce(
      new Error("model URL expired"),
    );

    await expect(
      saveGenerationModel3dActivity({
        jobId: "job_model_1",
        modelUrl: "https://assets.example/model.glb",
        renderedImageUrl: "https://assets.example/preview.png",
      }),
    ).rejects.toThrow("model URL expired");
    expect(mocks.importRemoteObject).toHaveBeenCalledOnce();
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

  it("publishes generation failed realtime events for failed jobs", async () => {
    mocks.getGenerationJobById.mockResolvedValueOnce(
      createJob({ status: "failed" }),
    );

    await publishGenerationJobFailedRealtimeEventActivity({
      jobId: "job_1",
    });

    expect(mocks.publishInternalEvent).toHaveBeenCalledWith({
      id: "generation.job.failed:job_1",
      type: "generation.job.failed",
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
      draftCacheUrl: null,
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

function createTripoProviderCallback() {
  return {
    kind: "result" as const,
    result: {
      provider: "tripo" as const,
      providerTaskId: "task-1",
      providerModelId: "v3.1-20260211",
      status: "succeeded" as const,
      videoUrl: null,
      modelUrl: "https://assets.example/model.glb",
      renderedImageUrl: "https://assets.example/preview.png",
      draftCacheUrl: null,
      usage: null,
      createdAt: null,
      updatedAt: null,
      creditsConsumed: 30,
      providerError: null,
    },
    rawPayload: { code: 0, data: { task_id: "task-1", status: "success" } },
    receivedAt: "2026-08-21T12:01:00.000Z",
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
    draftCacheUrl: null,
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

function createStoredObject(): StoredObjectReference {
  return {
    bucket: "remora-dev-media",
    objectKey: "generations/jobs/job_1/video.mp4",
    contentType: "video/mp4",
    contentLength: 1024,
    etag: '"video-etag"',
    checksumSha256: "video-checksum",
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
      draft: false,
    },
    requestedGenerations: 1,
    attachmentMedia: [],
    ...overrides,
  };
}

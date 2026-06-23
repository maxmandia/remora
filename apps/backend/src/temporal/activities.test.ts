import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  GenerationJobWithSubmissionContext,
  RetrieveSeedanceVideoTaskResult,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "../modules/generation/generation.types.ts";
import type { StoredObjectReference } from "../modules/storage/object-storage.service.ts";

type ImportRemoteObjectInput = {
  objectKey: string;
  sourceUrl: string;
};

const mocks = vi.hoisted(() => ({
  getGenerationJobById: vi.fn(),
  createGenerationResultPreview: vi.fn(),
  importRemoteObject:
    vi.fn<(input: ImportRemoteObjectInput) => Promise<StoredObjectReference>>(),
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
  },
}));

vi.mock("../modules/generation/generation.repository.ts", () => ({
  generationRepository: {
    getGenerationJobById: mocks.getGenerationJobById,
    upsertGenerationResult: mocks.upsertGenerationResult,
  },
}));

vi.mock("../db/transaction-manager.ts", () => ({
  transactionManager: {
    transaction: mocks.transaction,
  },
}));

vi.mock("../modules/generation/generation-preview.service.ts", () => ({
  generationPreviewService: {
    createGenerationResultPreview: mocks.createGenerationResultPreview,
  },
}));

vi.mock(
  "../modules/generation-attachment-media/generation-attachment-media.service.ts",
  () => ({
    generationAttachmentMediaService: {
      prepareSignedAttachmentMediaForSubmission:
        mocks.prepareSignedAttachmentMediaForSubmission,
    },
  }),
);

vi.mock("../modules/realtime/realtime.repository.ts", () => ({
  realtimeRepository: {
    publishInternalEvent: mocks.publishInternalEvent,
  },
}));

import {
  createGenerationResultPreviewActivity,
  prepareAttachmentMediaForProviderRequestActivity,
  publishGenerationJobSucceededRealtimeEventActivity,
  saveGenerationMediaActivity,
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
    mocks.createGenerationResultPreview.mockResolvedValue(
      createStoredPreview(),
    );
    mocks.prepareSignedAttachmentMediaForSubmission.mockResolvedValue([]);
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

  it("prepares signed attachment media with Seedance provider roles", async () => {
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
      prepareAttachmentMediaForProviderRequestActivity({
        submissionId: "submission_1",
      }),
    ).resolves.toEqual({
      images: [
        {
          url: "https://signed.example/first.png",
          role: "first_frame",
        },
        {
          url: "https://signed.example/last.png",
          role: "last_frame",
        },
      ],
      videos: [],
      audios: [],
    });
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

function createProviderCallback(
  overrides: Partial<RetrieveSeedanceVideoTaskResult> = {},
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
  overrides: Partial<GenerationJobWithSubmissionContext> = {},
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
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: 1,
    ...overrides,
  };
}

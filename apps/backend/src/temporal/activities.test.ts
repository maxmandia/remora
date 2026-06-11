import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  RetrieveSeedanceVideoTaskResult,
  StoredGenerationResultAssetReference,
} from "../modules/generation/generation.types.ts";
import type {
  StoredObjectReference,
} from "../modules/storage/object-storage.service.ts";

type ImportRemoteObjectInput = {
  objectKey: string;
  sourceUrl: string;
};

const mocks = vi.hoisted(() => ({
  importRemoteObject: vi.fn<
    (input: ImportRemoteObjectInput) => Promise<StoredObjectReference>
  >(),
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
    upsertGenerationResult: mocks.upsertGenerationResult,
  },
}));

import {
  saveGenerationMediaActivity,
  upsertGenerationResultActivity,
} from "./activities.ts";

describe("Temporal generation activities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.importRemoteObject.mockImplementation(async (input) => {
      const isLastFrame = input.sourceUrl.includes("last-frame");
      const contentType = isLastFrame ? "image/png" : "video/mp4";
      const contentLength = isLastFrame ? 2048 : 1024;

      return {
        bucket: "remora-dev-media",
        objectKey: input.objectKey,
        contentType,
        contentLength,
        etag: isLastFrame ? '"last-frame-etag"' : '"video-etag"',
        checksumSha256: isLastFrame
          ? "last-frame-checksum"
          : "video-checksum",
      };
    });
  });

  it("imports succeeded provider media and returns stored asset references", async () => {
    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: "https://assets.example/video.mp4",
        lastFrameUrl: "https://assets.example/last-frame.png",
      }),
    ).resolves.toEqual([
      createStoredAsset({
        objectKey: "generations/jobs/job_1/video.mp4",
      }),
      createStoredAsset({
        kind: "last_frame",
        objectKey: "generations/jobs/job_1/last-frame.jpg",
        contentType: "image/png",
        contentLength: 2048,
        etag: '"last-frame-etag"',
        checksumSha256: "last-frame-checksum",
        sourceProviderUrl: "https://assets.example/last-frame.png",
      }),
    ]);
    expect(mocks.importRemoteObject).toHaveBeenCalledTimes(2);
    expect(mocks.importRemoteObject).toHaveBeenNthCalledWith(
      1,
      {
        sourceUrl: "https://assets.example/video.mp4",
        objectKey: "generations/jobs/job_1/video.mp4",
      },
    );
    expect(mocks.importRemoteObject).toHaveBeenNthCalledWith(
      2,
      {
        sourceUrl: "https://assets.example/last-frame.png",
        objectKey: "generations/jobs/job_1/last-frame.jpg",
      },
    );
  });

  it("fails succeeded media import when the provider omitted the required video URL", async () => {
    await expect(
      saveGenerationMediaActivity({
        jobId: "job_1",
        videoUrl: null,
        lastFrameUrl: null,
      }),
    ).rejects.toThrow("Succeeded provider callback did not include a video URL");
    expect(mocks.importRemoteObject).not.toHaveBeenCalled();
  });

  it("passes stored asset references through result persistence", async () => {
    const storedAsset = createStoredAsset();
    const callback = createProviderCallback();
    mocks.upsertGenerationResult.mockResolvedValueOnce({ id: "result_1" });

    await upsertGenerationResultActivity({
      jobId: "job_1",
      callback,
      storedAssets: [storedAsset],
    });

    expect(mocks.upsertGenerationResult).toHaveBeenCalledWith({
      jobId: "job_1",
      result: callback.result,
      rawPayload: callback.rawPayload,
      receivedAt: new Date("2026-06-05T00:00:00.000Z"),
      storedAssets: [storedAsset],
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
    lastFrameUrl: null,
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

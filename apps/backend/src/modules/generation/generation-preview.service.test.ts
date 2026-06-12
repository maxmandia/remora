import { writeFile } from "node:fs/promises";
import type { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  GenerationPreviewError,
  GenerationPreviewService,
  type PreviewFrameExtractor,
  type PreviewStorage,
} from "./generation-preview.service.ts";
import type { StoredGenerationResultAssetReference } from "./generation.types.ts";

const previewBytes = Buffer.from("fake-jpeg");

describe("generation preview service", () => {
  let storage: {
    createSignedGetUrl: ReturnType<
      typeof vi.fn<PreviewStorage["createSignedGetUrl"]>
    >;
    uploadObject: ReturnType<typeof vi.fn<PreviewStorage["uploadObject"]>>;
  };

  beforeEach(() => {
    storage = {
      createSignedGetUrl: vi.fn<PreviewStorage["createSignedGetUrl"]>(
        async () => "https://signed.example/video.mp4",
      ),
      uploadObject: vi.fn<PreviewStorage["uploadObject"]>(async (input) => {
        await drain(input.body);

        return {
          bucket: "remora-dev-media",
          objectKey: "generations/jobs/job_1/preview.jpg",
          contentType: "image/jpeg",
          contentLength: previewBytes.length,
          etag: '"preview-etag"',
          checksumSha256: "preview-sha256",
        };
      }),
    };
  });

  it("extracts and uploads a one-second preview frame", async () => {
    const extractFrame = vi.fn<PreviewFrameExtractor>(
      async ({ outputPath }) => {
        await writeFile(outputPath, previewBytes);
      },
    );
    const service = new GenerationPreviewService(storage, {
      ffmpegPath: "/usr/local/bin/ffmpeg",
      extractFrame,
    });

    await expect(
      service.createGenerationResultPreview({
        jobId: "job_1",
        video: createStoredVideo(),
      }),
    ).resolves.toEqual({
      bucket: "remora-dev-media",
      objectKey: "generations/jobs/job_1/preview.jpg",
      contentType: "image/jpeg",
      contentLength: previewBytes.length,
      etag: '"preview-etag"',
      checksumSha256: "preview-sha256",
      frameTimeMs: 1000,
    });
    expect(storage.createSignedGetUrl).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "generations/jobs/job_1/video.mp4",
    });
    expect(extractFrame).toHaveBeenCalledWith(
      expect.objectContaining({
        ffmpegPath: "/usr/local/bin/ffmpeg",
        inputUrl: "https://signed.example/video.mp4",
        frameTimeMs: 1000,
      }),
    );
    expect(storage.uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: "generations/jobs/job_1/preview.jpg",
        contentLength: previewBytes.length,
        contentType: "image/jpeg",
        sourceUrl: "https://signed.example/video.mp4",
      }),
    );
  });

  it("falls back to a near-start frame when the one-second frame fails", async () => {
    const extractFrame = vi.fn<PreviewFrameExtractor>(
      async ({ frameTimeMs, outputPath }) => {
        if (frameTimeMs === 1000) {
          throw new Error("seek failed");
        }

        await writeFile(outputPath, previewBytes);
      },
    );
    const service = new GenerationPreviewService(storage, {
      ffmpegPath: "/usr/local/bin/ffmpeg",
      extractFrame,
    });

    await expect(
      service.createGenerationResultPreview({
        jobId: "job_1",
        video: createStoredVideo(),
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        frameTimeMs: 100,
      }),
    );
    expect(extractFrame).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ frameTimeMs: 1000 }),
    );
    expect(extractFrame).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ frameTimeMs: 100 }),
    );
  });

  it("fails when ffmpeg-static does not provide a binary path", async () => {
    const service = new GenerationPreviewService(storage, {
      ffmpegPath: null,
      extractFrame: vi.fn(),
    });

    await expect(
      service.createGenerationResultPreview({
        jobId: "job_1",
        video: createStoredVideo(),
      }),
    ).rejects.toMatchObject({
      code: "FFMPEG_BINARY_MISSING",
    } satisfies Partial<GenerationPreviewError>);
    expect(storage.createSignedGetUrl).not.toHaveBeenCalled();
  });
});

function createStoredVideo(
  overrides: Partial<StoredGenerationResultAssetReference> = {},
): StoredGenerationResultAssetReference {
  return {
    kind: "video",
    bucket: "remora-dev-media",
    objectKey: "generations/jobs/job_1/video.mp4",
    contentType: "video/mp4",
    contentLength: 1024,
    etag: '"video-etag"',
    checksumSha256: "video-sha256",
    sourceProviderUrl: "https://assets.example/video.mp4",
    ...overrides,
  };
}

function drain(stream: Readable) {
  return new Promise<void>((resolve, reject) => {
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.resume();
  });
}

import { EventEmitter } from "node:events";
import { writeFile } from "node:fs/promises";
import { PassThrough, type Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

import {
  extractPreviewFrameWithFfmpeg,
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
    spawnMock.mockReset();
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
    const service = new GenerationPreviewService(storage, { extractFrame });

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
        ffmpegPath: "ffmpeg",
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

  it("does not try the fallback frame when ffmpeg is missing", async () => {
    const child = createChildProcess();
    spawnMock.mockImplementationOnce(() => {
      queueMicrotask(() => {
        child.emit(
          "error",
          Object.assign(new Error("spawn ffmpeg ENOENT"), { code: "ENOENT" }),
        );
      });

      return child;
    });
    const service = new GenerationPreviewService(storage);

    await expect(
      service.createGenerationResultPreview({
        jobId: "job_1",
        video: createStoredVideo(),
      }),
    ).rejects.toMatchObject({
      code: "FFMPEG_BINARY_MISSING",
      message: "ffmpeg executable was not found on PATH: ffmpeg",
    } satisfies Partial<GenerationPreviewError>);
    expect(spawnMock).toHaveBeenCalledOnce();
    expect(spawnMock).toHaveBeenCalledWith(
      "ffmpeg",
      expect.arrayContaining(["-ss", "1"]),
      expect.any(Object),
    );
  });

  it("reports the terminating signal when ffmpeg closes without stderr", async () => {
    const child = createChildProcess();
    spawnMock.mockReturnValueOnce(child);
    const extraction = extractPreviewFrameWithFfmpeg({
      ffmpegPath: "ffmpeg",
      inputUrl: "https://signed.example/video.mp4",
      outputPath: "/tmp/preview.jpg",
      frameTimeMs: 1000,
    });

    child.emit("close", null, "SIGSEGV");

    await expect(extraction).rejects.toMatchObject({
      code: "FRAME_EXTRACTION_FAILED",
      message: "ffmpeg preview extraction terminated by signal SIGSEGV",
    } satisfies Partial<GenerationPreviewError>);
  });
});

function createChildProcess() {
  return Object.assign(new EventEmitter(), {
    stderr: new PassThrough(),
    kill: vi.fn(),
  });
}

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

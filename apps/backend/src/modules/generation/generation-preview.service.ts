import ffmpegStaticPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Readable } from "node:stream";

import {
  objectStorageService,
  type StoredObjectReference,
} from "../storage/object-storage.service.ts";
import type {
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "./generation.types.ts";
import { createGenerationResultPreviewObjectKey } from "./generation.utils.ts";

const previewFrameTimesMs = [1000, 100] as const;
const previewContentType = "image/jpeg";
const previewMaxWidth = 512;
const ffmpegTimeoutMs = 30_000;

export type PreviewStorage = {
  createSignedGetUrl(reference: {
    bucket: string;
    objectKey: string;
  }): Promise<string>;
  uploadObject(input: {
    objectKey: string;
    body: Readable;
    contentLength: number | null;
    contentType: string | null;
    sourceUrl?: string | null;
  }): Promise<StoredObjectReference>;
};

export type PreviewFrameExtractor = (input: {
  ffmpegPath: string;
  inputUrl: string;
  outputPath: string;
  frameTimeMs: number;
}) => Promise<void>;

export class GenerationPreviewError extends Error {
  readonly code: "FFMPEG_BINARY_MISSING" | "FRAME_EXTRACTION_FAILED";

  constructor({
    code,
    message,
    cause,
  }: {
    code: GenerationPreviewError["code"];
    message: string;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "GenerationPreviewError";
    this.code = code;
  }
}

export class GenerationPreviewService {
  private readonly ffmpegPath: string | null;
  private readonly extractFrame: PreviewFrameExtractor;

  constructor(
    private readonly storage: PreviewStorage = objectStorageService,
    options: {
      ffmpegPath?: string | null;
      extractFrame?: PreviewFrameExtractor;
    } = {},
  ) {
    this.ffmpegPath = Object.hasOwn(options, "ffmpegPath")
      ? (options.ffmpegPath ?? null)
      : ffmpegStaticPath;
    this.extractFrame = options.extractFrame ?? extractPreviewFrameWithFfmpeg;
  }

  async createGenerationResultPreview({
    jobId,
    video,
  }: {
    jobId: string;
    video: StoredGenerationResultAssetReference;
  }): Promise<StoredGenerationResultPreviewReference> {
    if (!this.ffmpegPath) {
      throw new GenerationPreviewError({
        code: "FFMPEG_BINARY_MISSING",
        message: "ffmpeg-static did not provide an ffmpeg binary path",
      });
    }

    const signedVideoUrl = await this.storage.createSignedGetUrl({
      bucket: video.bucket,
      objectKey: video.objectKey,
    });
    const workDir = await mkdtemp(path.join(tmpdir(), "remora-preview-"));
    const outputPath = path.join(workDir, "preview.jpg");

    try {
      const frameTimeMs = await this.extractFirstAvailableFrame({
        inputUrl: signedVideoUrl,
        outputPath,
      });
      const outputStats = await stat(outputPath);
      const storedObject = await this.storage.uploadObject({
        objectKey: createGenerationResultPreviewObjectKey({ jobId }),
        body: createReadStream(outputPath),
        contentLength: outputStats.size,
        contentType: previewContentType,
        sourceUrl: signedVideoUrl,
      });

      return {
        bucket: storedObject.bucket,
        objectKey: storedObject.objectKey,
        contentType: storedObject.contentType,
        contentLength: storedObject.contentLength,
        etag: storedObject.etag,
        checksumSha256: storedObject.checksumSha256,
        frameTimeMs,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async extractFirstAvailableFrame({
    inputUrl,
    outputPath,
  }: {
    inputUrl: string;
    outputPath: string;
  }) {
    let lastError: unknown;

    for (const frameTimeMs of previewFrameTimesMs) {
      try {
        await this.extractFrame({
          ffmpegPath: this.ffmpegPath!,
          inputUrl,
          outputPath,
          frameTimeMs,
        });

        return frameTimeMs;
      } catch (error) {
        lastError = error;
      }
    }

    throw new GenerationPreviewError({
      code: "FRAME_EXTRACTION_FAILED",
      message: "ffmpeg could not extract a preview frame from the video",
      cause: lastError,
    });
  }
}

export async function extractPreviewFrameWithFfmpeg({
  ffmpegPath,
  inputUrl,
  outputPath,
  frameTimeMs,
}: {
  ffmpegPath: string;
  inputUrl: string;
  outputPath: string;
  frameTimeMs: number;
}) {
  await runFfmpeg(ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    (frameTimeMs / 1000).toString(),
    "-i",
    inputUrl,
    "-frames:v",
    "1",
    "-vf",
    `scale=w=min(${previewMaxWidth}\\,iw):h=-2`,
    "-q:v",
    "2",
    "-y",
    outputPath,
  ]);
}

function runFfmpeg(ffmpegPath: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegPath, args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    const stderrChunks: string[] = [];
    let settled = false;
    const timeout = setTimeout(() => {
      settle(() => {
        child.kill("SIGKILL");
        reject(
          new GenerationPreviewError({
            code: "FRAME_EXTRACTION_FAILED",
            message: "ffmpeg preview extraction timed out",
          }),
        );
      });
    }, ffmpegTimeoutMs);

    timeout.unref?.();

    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    child.once("error", (cause) => {
      settle(() => {
        reject(
          new GenerationPreviewError({
            code: "FRAME_EXTRACTION_FAILED",
            message: "ffmpeg preview extraction process failed to start",
            cause,
          }),
        );
      });
    });

    child.once("close", (code) => {
      settle(() => {
        if (code === 0) {
          resolve();
          return;
        }

        const stderr = stderrChunks.join("").trim();

        reject(
          new GenerationPreviewError({
            code: "FRAME_EXTRACTION_FAILED",
            message: stderr
              ? `ffmpeg preview extraction failed: ${stderr}`
              : `ffmpeg preview extraction failed with exit code ${code}`,
          }),
        );
      });
    });

    function settle(callback: () => void) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      callback();
    }
  });
}

export const generationPreviewService = new GenerationPreviewService();

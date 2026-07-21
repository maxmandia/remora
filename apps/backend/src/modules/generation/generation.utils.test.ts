import { describe, expect, it } from "vitest";

import { generationResultAssetKind } from "./schema/table.ts";
import {
  createGenerationResultAssetObjectKey,
  createGenerationResultPreviewObjectKey,
  parseGenerationSubmissionInput,
  toStoredGenerationResultAssetReference,
} from "./generation.utils.ts";
import { generationResultAssetKinds } from "./generation.types.ts";

describe("generation utils", () => {
  it("uses the database enum values as the result asset kind source of truth", () => {
    expect(generationResultAssetKind.enumValues).toEqual(
      generationResultAssetKinds,
    );
    expect(generationResultAssetKinds).toEqual(["video", "image"]);
  });

  it("parses and normalizes legacy video submitted input", () => {
    expect(
      parseGenerationSubmissionInput("video", {
        prompt: "  Quiet sea  ",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).toEqual({
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    });
  });

  it("parses image submitted input without adding a modality tag", () => {
    expect(
      parseGenerationSubmissionInput("image", {
        prompt: "  Quiet sea  ",
        resolution: "2k",
        aspectRatio: "1:1",
      }),
    ).toEqual({
      prompt: "Quiet sea",
      resolution: "2k",
      aspectRatio: "1:1",
    });
  });

  it("rejects submitted input that does not match its model type", () => {
    expect(() =>
      parseGenerationSubmissionInput("video", {
        prompt: "Quiet sea",
        resolution: "2k",
        aspectRatio: "1:1",
      }),
    ).toThrow("Invalid video generation submitted input");
    expect(() =>
      parseGenerationSubmissionInput("image", {
        prompt: "Quiet sea",
        resolution: "2k",
        aspectRatio: "1:1",
        duration: 5,
        generateAudio: false,
      }),
    ).toThrow("Invalid image generation submitted input");
  });

  it("creates video result asset keys with the deterministic video filename", () => {
    expect(
      createGenerationResultAssetObjectKey({
        jobId: "job_123",
        kind: "video",
      }),
    ).toBe("generations/jobs/job_123/video.mp4");
  });

  it("creates format-neutral image result asset keys", () => {
    expect(
      createGenerationResultAssetObjectKey({
        jobId: "job_123",
        kind: "image",
      }),
    ).toBe("generations/jobs/job_123/image");
  });

  it("creates preview result keys with the deterministic preview filename", () => {
    expect(
      createGenerationResultPreviewObjectKey({
        jobId: "job_123",
      }),
    ).toBe("generations/jobs/job_123/preview.jpg");
  });

  it("maps stored objects to stored generation result asset references", () => {
    expect(
      toStoredGenerationResultAssetReference({
        kind: "video",
        sourceProviderUrl: "https://assets.example/video.mp4",
        storedObject: {
          bucket: "remora-dev-media",
          objectKey: "generations/jobs/job_123/video.mp4",
          contentType: "video/mp4",
          contentLength: 1024,
          etag: '"video-etag"',
          checksumSha256: "video-checksum",
        },
      }),
    ).toEqual({
      kind: "video",
      bucket: "remora-dev-media",
      objectKey: "generations/jobs/job_123/video.mp4",
      contentType: "video/mp4",
      contentLength: 1024,
      etag: '"video-etag"',
      checksumSha256: "video-checksum",
      sourceProviderUrl: "https://assets.example/video.mp4",
    });
  });
});

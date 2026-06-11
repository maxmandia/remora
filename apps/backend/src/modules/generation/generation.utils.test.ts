import { describe, expect, it } from "vitest";

import {
  createGenerationResultAssetObjectKey,
  toStoredGenerationResultAssetReference,
} from "./generation.utils.ts";

describe("generation utils", () => {
  it("creates video result asset keys with the deterministic video filename", () => {
    expect(
      createGenerationResultAssetObjectKey({
        jobId: "job_123",
        kind: "video",
      }),
    ).toBe("generations/jobs/job_123/video.mp4");
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

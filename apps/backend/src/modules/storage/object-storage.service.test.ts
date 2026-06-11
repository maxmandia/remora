import { GetObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  ObjectStorageError,
  ObjectStorageService,
} from "./object-storage.service.ts";

type StorageServiceOptions = NonNullable<
  ConstructorParameters<typeof ObjectStorageService>[0]
>;
type PutObject = NonNullable<StorageServiceOptions["putObject"]>;
type SignedUrlFactory = NonNullable<StorageServiceOptions["signedUrlFactory"]>;

const r2Env = {
  R2_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key-id",
  R2_SECRET_ACCESS_KEY: "secret-access-key",
  R2_BUCKET_NAME: "remora-generations",
  R2_SIGNED_URL_TTL_SECONDS: 300,
};

describe("object storage service", () => {
  it("configures the default S3 client for Cloudflare R2", async () => {
    const signedUrlFactory = vi.fn<SignedUrlFactory>(async ({ client }) => {
      expect(await client.config.region()).toBe("auto");
      expect(await client.config.endpoint?.()).toMatchObject({
        protocol: "https:",
        hostname: "account-id.r2.cloudflarestorage.com",
        path: "/",
      });

      return "https://signed.example/object";
    });
    const service = new ObjectStorageService({
      env: r2Env,
      signedUrlFactory,
    });

    await expect(
      service.createSignedGetUrl({
        bucket: "remora-generations",
        objectKey: "generated-media/object",
      }),
    ).resolves.toBe("https://signed.example/object");
    expect(signedUrlFactory).toHaveBeenCalledTimes(1);
  });

  it("imports remote objects with content metadata", async () => {
    const sourceUrl = "https://provider.example/media/video.mp4?token=secret";
    const fetcher = vi.fn(async () =>
      createMediaResponse("video-bytes", {
        contentLength: "11",
        contentType: "video/mp4",
      }),
    );
    const putObject = vi.fn<PutObject>(async () => ({
      ChecksumSHA256: "video-checksum",
      ETag: '"video-etag"',
    }));
    const service = new ObjectStorageService({
      env: r2Env,
      fetcher,
      putObject,
    });

    await expect(
      service.importRemoteObject({
        objectKey: "generated-media/jobs/job_123/video.mp4",
        sourceUrl,
      }),
    ).resolves.toEqual({
      bucket: "remora-generations",
      objectKey: "generated-media/jobs/job_123/video.mp4",
      contentType: "video/mp4",
      contentLength: 11,
      etag: '"video-etag"',
      checksumSha256: "video-checksum",
    });
    expect(fetcher).toHaveBeenCalledWith(sourceUrl);
    expect(putObject).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          Bucket: "remora-generations",
          Key: "generated-media/jobs/job_123/video.mp4",
          ContentLength: 11,
          ContentType: "video/mp4",
        }),
      }),
    );
  });

  it("throws a typed error when remote object download fails", async () => {
    const sourceUrl = "https://provider.example/media/video.mp4";
    const fetcher = vi.fn(
      async () => new Response("not found", { status: 404 }),
    );
    const putObject = vi.fn<PutObject>();
    const service = new ObjectStorageService({
      env: r2Env,
      fetcher,
      putObject,
    });
    const importRemoteObject = service.importRemoteObject({
      objectKey: "generated-media/jobs/job_123/video.mp4",
      sourceUrl,
    });

    await expect(importRemoteObject).rejects.toMatchObject({
      name: "ObjectStorageError",
      code: "REMOTE_OBJECT_DOWNLOAD_FAILED",
      sourceUrl,
      statusCode: 404,
    });
    await expect(importRemoteObject).rejects.toBeInstanceOf(
      ObjectStorageError,
    );
    expect(putObject).not.toHaveBeenCalled();
  });

  it("throws a typed error when remote object has no response body", async () => {
    const sourceUrl = "https://provider.example/media/video.mp4";
    const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
    const service = new ObjectStorageService({
      env: r2Env,
      fetcher,
      putObject: vi.fn<PutObject>(),
    });

    await expect(
      service.importRemoteObject({
        objectKey: "generated-media/jobs/job_123/video.mp4",
        sourceUrl,
      }),
    ).rejects.toMatchObject({
      name: "ObjectStorageError",
      code: "REMOTE_OBJECT_RESPONSE_BODY_MISSING",
      sourceUrl,
      statusCode: 200,
    });
  });

  it("wraps upload failures in a typed storage error", async () => {
    const sourceUrl = "https://provider.example/media/video.mp4";
    const putObject = vi.fn<PutObject>(async () => {
      throw new Error("r2 is unavailable");
    });
    const service = new ObjectStorageService({
      env: r2Env,
      fetcher: vi.fn(async () =>
        createMediaResponse("video-bytes", {
          contentType: "video/mp4",
        }),
      ),
      putObject,
    });

    await expect(
      service.importRemoteObject({
        objectKey: "generated-media/jobs/job_123/video.mp4",
        sourceUrl,
      }),
    ).rejects.toMatchObject({
      name: "ObjectStorageError",
      code: "OBJECT_UPLOAD_FAILED",
      objectKey: "generated-media/jobs/job_123/video.mp4",
      sourceUrl,
    });
  });

  it("generates signed GET URLs with the configured TTL", async () => {
    const signedUrlFactory = vi.fn<SignedUrlFactory>(
      async ({ command, expiresIn }) => {
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect(
          (command as GetObjectCommand & { input: unknown }).input,
        ).toEqual({
          Bucket: "remora-generations",
          Key: "generated-media/jobs/job_123/video.mp4",
        });
        expect(expiresIn).toBe(300);

        return "https://signed.example/video.mp4";
      },
    );
    const service = new ObjectStorageService({
      env: r2Env,
      signedUrlFactory,
    });

    await expect(
      service.createSignedGetUrl({
        bucket: "remora-generations",
        objectKey: "generated-media/jobs/job_123/video.mp4",
      }),
    ).resolves.toBe("https://signed.example/video.mp4");
    expect(signedUrlFactory).toHaveBeenCalledTimes(1);
  });

  it("returns signed GET URLs with their expiration timestamp", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-05T00:00:00.000Z"));
    const signedUrlFactory = vi.fn<SignedUrlFactory>(
      async () => "https://signed.example/video.mp4",
    );
    const service = new ObjectStorageService({
      env: r2Env,
      signedUrlFactory,
    });

    try {
      await expect(
        service.createSignedGetUrlWithExpiration({
          bucket: "remora-generations",
          objectKey: "generated-media/jobs/job_123/video.mp4",
        }),
      ).resolves.toEqual({
        url: "https://signed.example/video.mp4",
        expiresAt: "2026-06-05T00:05:00.000Z",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("wraps signed URL failures in a typed storage error", async () => {
    const service = new ObjectStorageService({
      env: r2Env,
      signedUrlFactory: vi.fn<SignedUrlFactory>(async () => {
        throw new Error("cannot sign");
      }),
    });

    await expect(
      service.createSignedGetUrl({
        bucket: "remora-generations",
        objectKey: "generated-media/jobs/job_123/video.mp4",
      }),
    ).rejects.toMatchObject({
      name: "ObjectStorageError",
      code: "OBJECT_SIGNED_URL_FAILED",
      objectKey: "generated-media/jobs/job_123/video.mp4",
    });
  });
});

function createMediaResponse(
  body: ConstructorParameters<typeof Response>[0],
  {
    contentLength,
    contentType,
  }: {
    contentLength?: string;
    contentType?: string;
  } = {},
) {
  const headers = new Headers();

  if (contentLength) {
    headers.set("Content-Length", contentLength);
  }

  if (contentType) {
    headers.set("Content-Type", contentType);
  }

  return new Response(body, {
    status: 200,
    headers,
  });
}

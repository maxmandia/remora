import multipart from "@fastify/multipart";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { maxGenerationAttachmentMediaUploadBytes } from "@remora/domain/generation-attachment-media/dto";

const mocks = vi.hoisted(() => ({
  getSessionFromHeaders: vi.fn(),
  uploadGenerationAttachmentMedia: vi.fn(),
}));

vi.mock("../../app.service.ts", () => ({
  generationAttachmentMediaService: {
    uploadGenerationAttachmentMedia: mocks.uploadGenerationAttachmentMedia,
  },
}));

vi.mock("../auth/auth.ts", () => ({
  getSessionFromHeaders: mocks.getSessionFromHeaders,
}));

import { registerGenerationAttachmentMediaUploadRoutes } from "./generation-attachment-media.router.ts";

describe("generation attachment media upload routes", () => {
  let server: FastifyInstance;

  beforeEach(async () => {
    mocks.getSessionFromHeaders.mockReset();
    mocks.getSessionFromHeaders.mockResolvedValue({
      user: { id: "user_1" },
    });
    mocks.uploadGenerationAttachmentMedia.mockReset();
    mocks.uploadGenerationAttachmentMedia.mockImplementation(
      async ({ body }) => {
        for await (const _chunk of body) {
          // Consume the multipart stream so its configured limit is enforced.
        }

        return {
          id: "attachment_media_1",
          kind: "image",
          originalFileName: "reference.png",
          contentType: "image/png",
          contentLength: 5,
          metadata: {
            widthPx: 1,
            heightPx: 1,
            durationSec: null,
            fps: null,
          },
        };
      },
    );
    server = Fastify();
    await server.register(multipart, {
      limits: {
        fileSize: 5,
        files: 1,
      },
    });
    await registerGenerationAttachmentMediaUploadRoutes(server);
  });

  afterEach(async () => {
    await server.close();
  });

  it("defines the canonical upload ceiling as 100 MiB", () => {
    expect(maxGenerationAttachmentMediaUploadBytes).toBe(104_857_600);
  });

  it("returns a stable 413 response when multipart rejects a large file", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/generation/attachment-media",
      headers: {
        "content-type": "multipart/form-data; boundary=remora-boundary",
      },
      payload: createMultipartPayload(Buffer.from("123456"), {
        boundary: "remora-boundary",
      }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: "ATTACHMENT_MEDIA_FILE_TOO_LARGE",
      message: "Attachment media files must be at most 104857600 bytes",
    });
  });

  it("continues to accept files at the configured boundary", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/api/generation/attachment-media",
      headers: {
        "content-type": "multipart/form-data; boundary=remora-boundary",
      },
      payload: createMultipartPayload(Buffer.from("12345"), {
        boundary: "remora-boundary",
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "attachment_media_1",
      kind: "image",
    });
  });
});

function createMultipartPayload(
  file: Buffer,
  { boundary }: { boundary: string },
) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nimage\r\n`,
    ),
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference.png"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    file,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

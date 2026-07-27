/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GenerationAttachmentMediaUploadError,
  uploadGenerationAttachmentMediaFile,
} from "./generation-attachment-media-file-uploader";

describe("uploadGenerationAttachmentMediaFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uploads one file with authenticated browser FormData", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({
        id: "attachment_media_1",
        kind: "image",
        originalFileName: "reference.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image"], "reference.png", {
      type: "image/png",
    });

    await expect(
      uploadGenerationAttachmentMediaFile({ kind: "image", file }),
    ).resolves.toMatchObject({
      id: "attachment_media_1",
      kind: "image",
    });

    const [url, options] = fetchMock.mock.calls[0]!;

    expect(options).toBeDefined();

    if (!options) {
      throw new Error("Expected fetch options");
    }

    const formData = options.body as FormData;

    expect(url.toString()).toBe(
      "http://localhost:4000/api/generation/attachment-media",
    );
    expect(options).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(options).not.toHaveProperty("headers");
    expect(formData.get("kind")).toBe("image");
    expect(formData.get("file")).toEqual(file);
  });

  it("preserves backend status and message for upload failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: "Unauthorized",
            message: "Your session has expired",
          },
          { status: 401 },
        ),
      ),
    );

    const upload = uploadGenerationAttachmentMediaFile({
      kind: "image",
      file: new File(["image"], "reference.png", { type: "image/png" }),
    });

    await expect(upload).rejects.toEqual(
      expect.objectContaining({
        name: "GenerationAttachmentMediaUploadError",
        message: "Your session has expired",
        status: 401,
      }),
    );
    await expect(upload).rejects.toBeInstanceOf(
      GenerationAttachmentMediaUploadError,
    );
  });

  it("uses a stable fallback for non-JSON failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("upstream unavailable", { status: 503 })),
    );

    await expect(
      uploadGenerationAttachmentMediaFile({
        kind: "video",
        file: new File(["video"], "motion.mp4", { type: "video/mp4" }),
      }),
    ).rejects.toMatchObject({
      message: "Attachment upload failed with 503",
      status: 503,
    });
  });
});

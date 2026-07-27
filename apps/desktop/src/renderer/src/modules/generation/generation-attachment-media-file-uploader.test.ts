/** @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadGenerationAttachmentMediaFile } from "./generation-attachment-media-file-uploader.ts";

const upload = vi.fn();

describe("uploadGenerationAttachmentMediaFile", () => {
  beforeEach(() => {
    upload.mockReset();
    upload.mockResolvedValue({
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
    });
    Object.defineProperty(window, "remoraAttachmentMedia", {
      configurable: true,
      value: { upload },
    });
  });

  it("serializes one browser file through the desktop IPC bridge", async () => {
    const file = new File(["image"], "reference.png", {
      type: "image/png",
    });

    await expect(
      uploadGenerationAttachmentMediaFile({ kind: "image", file }),
    ).resolves.toMatchObject({
      id: "attachment_media_1",
      kind: "image",
    });
    expect(upload).toHaveBeenCalledWith({
      kind: "image",
      fileName: "reference.png",
      contentType: "image/png",
      data: expect.any(ArrayBuffer),
    });
    expect(
      new TextDecoder().decode(upload.mock.calls[0]?.[0].data as ArrayBuffer),
    ).toBe("image");
  });
});

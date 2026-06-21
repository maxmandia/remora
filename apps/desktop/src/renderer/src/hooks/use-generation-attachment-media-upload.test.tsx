/**
 * @vitest-environment jsdom
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationAttachmentMediaItem } from "../lib/generation/attachment-media.ts";
import { useGenerationAttachmentMediaUpload } from "./use-generation-attachment-media-upload.ts";

const upload = vi.fn();

describe("useGenerationAttachmentMediaUpload", () => {
  beforeEach(() => {
    upload.mockReset();
    upload
      .mockResolvedValueOnce({
        id: "reference_image_1",
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
      })
      .mockResolvedValueOnce({
        id: "reference_video_1",
        kind: "video",
        originalFileName: "motion.mp4",
        contentType: "video/mp4",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: 5,
          fps: 24,
        },
      });

    Object.defineProperty(window, "remoraAttachmentMedia", {
      configurable: true,
      value: {
        upload,
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("uploads selected attachment media and returns grouped ids", async () => {
    const { result } = renderHook(() => useGenerationAttachmentMediaUpload());

    let uploaded: Awaited<
      ReturnType<typeof result.current.uploadAttachmentMedia>
    >;

    await act(async () => {
      uploaded = await result.current.uploadAttachmentMedia({
        images: [
          item(
            new File(["image"], "reference.png", {
              type: "image/png",
            }),
          ),
        ],
        videos: [
          item(
            new File(["video"], "motion.mp4", {
              type: "video/mp4",
            }),
          ),
        ],
        audios: [],
      });
    });

    expect(uploaded!).toEqual({
      images: [{ id: "reference_image_1", role: "reference" }],
      videos: [{ id: "reference_video_1", role: "reference" }],
    });

    expect(upload).toHaveBeenNthCalledWith(1, {
      kind: "image",
      fileName: "reference.png",
      contentType: "image/png",
      data: expect.any(ArrayBuffer),
    });
    expect(upload).toHaveBeenNthCalledWith(2, {
      kind: "video",
      fileName: "motion.mp4",
      contentType: "video/mp4",
      data: expect.any(ArrayBuffer),
    });
  });

  it("tracks the pending flag across the upload lifecycle", async () => {
    let releaseUpload: (() => void) | null = null;
    upload.mockReset();
    upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseUpload = () =>
            resolve({
              id: "reference_image_1",
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
        }),
    );

    const { result } = renderHook(() => useGenerationAttachmentMediaUpload());

    expect(result.current.isAttachmentMediaUploadPending).toBe(false);

    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadAttachmentMedia({
        images: [
          item(
            new File(["image"], "reference.png", {
              type: "image/png",
            }),
          ),
        ],
        videos: [],
        audios: [],
      });
    });

    expect(result.current.isAttachmentMediaUploadPending).toBe(true);

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      releaseUpload?.();
      await uploadPromise;
    });

    expect(result.current.isAttachmentMediaUploadPending).toBe(false);
  });

  it("preserves frame roles in uploaded ids", async () => {
    upload.mockReset();
    upload
      .mockResolvedValueOnce({
        id: "first_frame_1",
        kind: "image",
        originalFileName: "first.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
      })
      .mockResolvedValueOnce({
        id: "last_frame_1",
        kind: "image",
        originalFileName: "last.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
      });
    const { result } = renderHook(() => useGenerationAttachmentMediaUpload());

    let uploaded: Awaited<
      ReturnType<typeof result.current.uploadAttachmentMedia>
    >;

    await act(async () => {
      uploaded = await result.current.uploadAttachmentMedia({
        images: [
          item(
            new File(["first"], "first.png", { type: "image/png" }),
            "firstFrame",
          ),
          item(
            new File(["last"], "last.png", { type: "image/png" }),
            "lastFrame",
          ),
        ],
        videos: [],
        audios: [],
      });
    });

    expect(uploaded!).toEqual({
      images: [
        { id: "first_frame_1", role: "firstFrame" },
        { id: "last_frame_1", role: "lastFrame" },
      ],
    });
  });
});

function item(
  file: File,
  role: GenerationAttachmentMediaItem["role"] = "reference",
): GenerationAttachmentMediaItem {
  return { file, role };
}

/**
 * @vitest-environment jsdom
 */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationReferenceMediaUpload } from "./use-generation-reference-media-upload.ts";

const upload = vi.fn();

describe("useGenerationReferenceMediaUpload", () => {
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

    Object.defineProperty(window, "remoraReferenceMedia", {
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

  it("uploads selected reference media and returns grouped ids", async () => {
    const { result } = renderHook(() => useGenerationReferenceMediaUpload());

    let uploaded: Awaited<
      ReturnType<typeof result.current.uploadReferenceMedia>
    >;

    await act(async () => {
      uploaded = await result.current.uploadReferenceMedia({
        images: [
          new File(["image"], "reference.png", {
            type: "image/png",
          }),
        ],
        videos: [
          new File(["video"], "motion.mp4", {
            type: "video/mp4",
          }),
        ],
        audios: [],
      });
    });

    expect(uploaded!).toEqual({
      images: ["reference_image_1"],
      videos: ["reference_video_1"],
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

    const { result } = renderHook(() => useGenerationReferenceMediaUpload());

    expect(result.current.isReferenceMediaUploadPending).toBe(false);

    let uploadPromise: Promise<unknown>;

    act(() => {
      uploadPromise = result.current.uploadReferenceMedia({
        images: [
          new File(["image"], "reference.png", {
            type: "image/png",
          }),
        ],
        videos: [],
        audios: [],
      });
    });

    expect(result.current.isReferenceMediaUploadPending).toBe(true);

    await waitFor(() => {
      expect(upload).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      releaseUpload?.();
      await uploadPromise;
    });

    expect(result.current.isReferenceMediaUploadPending).toBe(false);
  });
});

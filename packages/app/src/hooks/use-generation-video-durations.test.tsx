/** @vitest-environment jsdom */

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationAttachmentMediaItem } from "../lib/generation/attachment-media.ts";
import { useGenerationVideoDurations } from "./use-generation-video-durations.ts";

describe("useGenerationVideoDurations", () => {
  const createdVideos: HTMLVideoElement[] = [];
  const createObjectURL = vi.fn();
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    createdVideos.length = 0;
    createObjectURL.mockReset();
    createObjectURL.mockReturnValue("blob:video:1");
    revokeObjectURL.mockReset();

    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const createElement = document.createElement.bind(document);

    vi.spyOn(document, "createElement").mockImplementation(((
      tagName: string,
      options?: ElementCreationOptions,
    ) => {
      const element = createElement(tagName, options);

      if (tagName === "video") {
        createdVideos.push(element as HTMLVideoElement);
      }

      return element;
    }) as typeof document.createElement);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reads duration metadata and revokes the object URL", async () => {
    const file = createVideoFile();
    const items = [createItem(file)];
    const { result } = renderHook(() => useGenerationVideoDurations(items));

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(createdVideos).toHaveLength(1);
    });

    Object.defineProperty(createdVideos[0], "duration", {
      configurable: true,
      value: 2.5,
    });
    act(() => {
      createdVideos[0]?.onloadedmetadata?.(new Event("loadedmetadata"));
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.durationSecByFile.get(file)).toBe(2.5);
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video:1");
  });

  it("returns an unavailable duration when local metadata cannot be read", async () => {
    const file = createVideoFile();
    const items = [createItem(file)];
    const { result } = renderHook(() => useGenerationVideoDurations(items));

    await waitFor(() => {
      expect(createdVideos).toHaveLength(1);
    });
    act(() => {
      createdVideos[0]?.onerror?.(new Event("error"));
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });
    expect(result.current.durationSecByFile.get(file)).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video:1");
  });

  it("cancels an outstanding probe and revokes its object URL", async () => {
    const file = createVideoFile();
    const items = [createItem(file)];
    const { unmount } = renderHook(() => useGenerationVideoDurations(items));

    await waitFor(() => {
      expect(createdVideos).toHaveLength(1);
    });
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:video:1");
  });
});

function createVideoFile() {
  return new File(["video"], "motion.mp4", { type: "video/mp4" });
}

function createItem(file: File): GenerationAttachmentMediaItem {
  return {
    file,
    role: "reference",
  };
}

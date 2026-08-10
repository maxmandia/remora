// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import {
  createEmptyGenerationAttachmentMediaValue,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import type { GenerationWorkspacePreset } from "../lib/generation/generation-workspace-search.ts";
import {
  loadGenerationWorkspaceReferenceMedia,
  useGenerationWorkspaceReferenceMedia,
} from "./use-generation-workspace-reference-media.ts";

describe("loadGenerationWorkspaceReferenceMedia", () => {
  it("loads images and videos atomically in prompt-token order", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      const type = url.endsWith(".png") ? "image/png" : "video/mp4";

      return new Response(new Blob([url], { type }), {
        headers: { "Content-Type": type },
      });
    }) as typeof fetch;

    const value = await loadGenerationWorkspaceReferenceMedia({
      fetcher,
      referenceMedia: {
        images: ["https://assets.example/image1.png"],
        videos: [
          "https://assets.example/video1.mp4",
          "https://assets.example/video2.mp4",
        ],
      },
    });

    expect(value.images.map(({ file, role }) => [file.name, role])).toEqual([
      ["image1.png", "reference"],
    ]);
    expect(value.videos.map(({ file, role }) => [file.name, role])).toEqual([
      ["video1.mp4", "reference"],
      ["video2.mp4", "reference"],
    ]);
    expect(value.audios).toEqual([]);
  });

  it("rejects the whole preset when any reference fails", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      return url.endsWith("video2.mp4")
        ? new Response(null, { status: 404 })
        : new Response(new Blob([url], { type: "video/mp4" }), {
            headers: { "Content-Type": "video/mp4" },
          });
    }) as typeof fetch;

    await expect(
      loadGenerationWorkspaceReferenceMedia({
        fetcher,
        referenceMedia: {
          videos: [
            "https://assets.example/video1.mp4",
            "https://assets.example/video2.mp4",
          ],
        },
      }),
    ).rejects.toThrow("Could not load video 2 (404).");
  });
});

describe("useGenerationWorkspaceReferenceMedia", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("aborts a stale preset and applies only the replacement", async () => {
    let firstRequestAborted = false;
    const fetcher = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (url.includes("first.png")) {
          return new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              firstRequestAborted = true;
              reject(new DOMException("Aborted", "AbortError"));
            });
          });
        }

        return Promise.resolve(
          new Response(new Blob([url], { type: "image/png" }), {
            headers: { "Content-Type": "image/png" },
          }),
        );
      },
    );
    vi.stubGlobal("fetch", fetcher);

    const firstPreset = createPreset("https://assets.example/first.png");
    const secondPreset = createPreset("https://assets.example/second.png");
    const { result, rerender } = renderHook(
      ({ preset }: { preset: GenerationWorkspacePreset }) => {
        const [value, setValue] = useState(
          createEmptyGenerationAttachmentMediaValue,
        );
        const state = useGenerationWorkspaceReferenceMedia({
          enabled: true,
          preset,
          setValue,
        });

        return { state, value };
      },
      { initialProps: { preset: firstPreset } },
    );

    rerender({ preset: secondPreset });

    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    expect(firstRequestAborted).toBe(true);
    expect(result.current.value.images).toHaveLength(1);
    expect(result.current.value.images[0]?.file.name).toBe("second.png");
  });

  it("replaces previously applied preset files without removing user files", async () => {
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);

      return new Response(new Blob([url], { type: "image/png" }), {
        headers: { "Content-Type": "image/png" },
      });
    });
    vi.stubGlobal("fetch", fetcher);

    const userFile = new File(["user"], "user.png", { type: "image/png" });
    const firstPreset = createPreset("https://assets.example/first.png");
    const secondPreset = createPreset("https://assets.example/second.png");
    const { result, rerender } = renderHook(
      ({ preset }: { preset: GenerationWorkspacePreset }) => {
        const [value, setValue] = useState<GenerationAttachmentMediaValue>(
          () => ({
            ...createEmptyGenerationAttachmentMediaValue(),
            images: [{ file: userFile, role: "reference" }],
          }),
        );
        const state = useGenerationWorkspaceReferenceMedia({
          enabled: true,
          preset,
          setValue,
        });

        return { state, value };
      },
      { initialProps: { preset: firstPreset } },
    );

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.value.images.map(({ file }) => file.name)).toEqual([
      "first.png",
      "user.png",
    ]);

    rerender({ preset: secondPreset });

    await waitFor(() =>
      expect(result.current.value.images.map(({ file }) => file.name)).toEqual([
        "second.png",
        "user.png",
      ]),
    );
  });

  it("exposes a retry state after an atomic load failure", async () => {
    const preset = createPreset("https://assets.example/image1.png");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(new Blob(["image"], { type: "image/png" }), {
          headers: { "Content-Type": "image/png" },
        }),
      );
    vi.stubGlobal("fetch", fetcher);

    const { result } = renderHook(() => {
      const [value, setValue] = useState(
        createEmptyGenerationAttachmentMediaValue,
      );
      const state = useGenerationWorkspaceReferenceMedia({
        enabled: true,
        preset,
        setValue,
      });

      return { state, value };
    });

    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(result.current.value.images).toEqual([]);

    act(() => result.current.state.retry());

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.value.images[0]?.file.name).toBe("image1.png");
  });
});

function createPreset(imageUrl: string): GenerationWorkspacePreset {
  return {
    duration: 30,
    modelId: "seedance-2.5-video",
    prompt: "Use @image1",
    referenceMedia: { images: [imageUrl] },
    resolution: "720p",
  };
}

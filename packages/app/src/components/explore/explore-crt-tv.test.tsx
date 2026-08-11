/** @vitest-environment jsdom */

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExploreCrtTv } from "./explore-crt-tv.tsx";

const rendererMocks = vi.hoisted(() => {
  const callbacks: { onError?: () => void; onReady?: () => void } = {};

  return {
    callbacks,
    createRuntime: vi.fn(
      ({ onError, onReady }: { onError: () => void; onReady: () => void }) => {
        callbacks.onError = onError;
        callbacks.onReady = onReady;

        return {
          dispose: vi.fn(),
          setReducedMotion: vi.fn(),
          setVideoSource: vi.fn(),
        };
      },
    ),
  };
});

vi.mock("../../lib/explore/explore-crt-tv-renderer.ts", () => ({
  createExploreCrtRuntime: rendererMocks.createRuntime,
}));

describe("ExploreCrtTv", () => {
  afterEach(() => {
    cleanup();
    rendererMocks.callbacks.onError = undefined;
    rendererMocks.callbacks.onReady = undefined;
    rendererMocks.createRuntime.mockClear();
    vi.unstubAllGlobals();
  });

  it("shows a spinner instead of the poster until the scene is ready", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});

    const { container } = render(
      <ExploreCrtTv videoUrl="https://example.com/inspiration.mp4" />,
    );

    await waitFor(() => {
      expect(rendererMocks.createRuntime).toHaveBeenCalledTimes(1);
    });

    const canvas = screen.getByLabelText("Film creative inspiration");

    expect(canvas.getAttribute("data-render-state")).toBe("loading");
    expect(canvas.className).toContain("opacity-0");
    expect(
      container.querySelector('[data-slot="explore-crt-spinner"] .animate-spin'),
    ).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });

  it("reveals the canvas and removes the spinner once the video is ready", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});

    const { container } = render(
      <ExploreCrtTv videoUrl="https://example.com/inspiration.mp4" />,
    );

    await waitFor(() => {
      expect(rendererMocks.createRuntime).toHaveBeenCalledTimes(1);
    });

    act(() => rendererMocks.callbacks.onReady?.());

    const canvas = screen.getByLabelText("Film creative inspiration");

    expect(canvas.getAttribute("data-render-state")).toBe("ready");
    expect(canvas.className).toContain("opacity-100");
    expect(canvas.className).toContain("transition-opacity");
    expect(
      container.querySelector('[data-slot="explore-crt-spinner"]'),
    ).toBeNull();
  });

  it("shows the poster when the runtime fails", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});

    const { container } = render(
      <ExploreCrtTv videoUrl="https://example.com/inspiration.mp4" />,
    );

    await waitFor(() => {
      expect(rendererMocks.createRuntime).toHaveBeenCalledTimes(1);
    });

    act(() => rendererMocks.callbacks.onError?.());

    const canvas = screen.getByLabelText("Film creative inspiration");
    const poster = container.querySelector("img");

    expect(canvas.getAttribute("data-render-state")).toBe("fallback");
    expect(poster?.getAttribute("src")).toContain("explore-crt-tv.webp");
    expect(
      container.querySelector('[data-slot="explore-crt-spinner"]'),
    ).toBeNull();
  });
});

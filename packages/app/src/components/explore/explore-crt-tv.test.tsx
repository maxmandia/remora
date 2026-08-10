/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExploreCrtTv } from "./explore-crt-tv.tsx";

const rendererMocks = vi.hoisted(() => ({
  createRuntime: vi.fn(({ onReady }: { onReady: () => void }) => {
    onReady();

    return {
      dispose: vi.fn(),
      setReducedMotion: vi.fn(),
      setVideoSource: vi.fn(),
    };
  }),
}));

vi.mock("../../lib/explore/explore-crt-tv-renderer.ts", () => ({
  createExploreCrtRuntime: rendererMocks.createRuntime,
}));

describe("ExploreCrtTv", () => {
  afterEach(() => {
    cleanup();
    rendererMocks.createRuntime.mockClear();
    vi.unstubAllGlobals();
  });

  it("crossfades from the poster after the 3D scene is ready", async () => {
    vi.stubGlobal("WebGLRenderingContext", class WebGLRenderingContext {});

    const { container } = render(
      <ExploreCrtTv videoUrl="https://example.com/inspiration.mp4" />,
    );
    const canvas = screen.getByLabelText("Film creative inspiration");
    const poster = container.querySelector("img");

    await waitFor(() => {
      expect(canvas.getAttribute("data-render-state")).toBe("ready");
    });

    expect(canvas.className).toContain("opacity-100");
    expect(canvas.className).toContain("transition-opacity");
    expect(poster?.className).toContain("opacity-0");
    expect(poster?.className).toContain("transition-opacity");
    expect(poster?.getAttribute("src")).toContain("explore-crt-tv.webp");
  });
});

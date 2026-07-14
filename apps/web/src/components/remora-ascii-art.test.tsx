/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RemoraAsciiArt } from "./remora-ascii-art";

type AnimationFrameHarness = {
  cancelAnimationFrame: ReturnType<typeof vi.fn>;
  frames: Map<number, FrameRequestCallback>;
  requestAnimationFrame: ReturnType<typeof vi.fn>;
  runNextFrame: (time?: number) => void;
};

describe("RemoraAsciiArt", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: false,
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("preserves the accessible ASCII artwork as interactive symbols", () => {
    const { container } = render(<RemoraAsciiArt />);
    const artwork = screen.getByRole("img", {
      name: "ASCII art of the Remora fish mascot",
    });
    const rows = container.querySelectorAll("pre > span.block");

    expect(artwork).toBeTruthy();
    expect(rows).toHaveLength(28);
    expect(rows[0]?.textContent?.trim()).toBe("..........................");
    expect(rows[27]?.textContent?.trim()).toBe("####***++==----------.");
    expect(
      container.querySelectorAll('[data-slot="remora-ascii-symbol"]'),
    ).toHaveLength(1508);
  });

  it("moves nearby symbols, continues hover drift, and resets on leave", () => {
    const animation = stubAnimationFrames();
    const { container } = render(<RemoraAsciiArt />);
    const artwork = screen.getByRole("img", {
      name: "ASCII art of the Remora fish mascot",
    });
    const symbols = container.querySelectorAll<HTMLSpanElement>(
      '[data-slot="remora-ascii-symbol"]',
    );
    const nearbySymbol = symbols[0];
    const distantSymbol = symbols[1];

    mockBounds(artwork, { height: 100, width: 100 });
    mockBounds(nearbySymbol, {
      height: 10,
      left: 55,
      top: 45,
      width: 10,
    });
    mockBounds(distantSymbol, {
      height: 10,
      left: 90,
      top: 90,
      width: 10,
    });

    fireEvent.pointerEnter(artwork, {
      clientX: 50,
      clientY: 50,
      pointerType: "mouse",
    });
    animation.runNextFrame(560);

    expect(nearbySymbol?.style.transform).toMatch(/^translate\([1-9]/);
    expect(distantSymbol?.style.transform).toBe("");
    expect(animation.frames).toHaveLength(1);

    fireEvent.pointerLeave(artwork, { pointerType: "mouse" });

    expect(nearbySymbol?.style.transform).toBe("");
    expect(animation.frames).toHaveLength(0);
    expect(animation.cancelAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("does not activate the effect for touch pointers", () => {
    const animation = stubAnimationFrames();

    render(<RemoraAsciiArt />);

    const artwork = screen.getByRole("img", {
      name: "ASCII art of the Remora fish mascot",
    });

    fireEvent.pointerEnter(artwork, {
      clientX: 50,
      clientY: 50,
      pointerType: "touch",
    });
    fireEvent.pointerMove(artwork, {
      clientX: 56,
      clientY: 48,
      pointerType: "touch",
    });

    expect(animation.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it("applies one reduced-motion response without continuous drift", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        addEventListener: vi.fn(),
        matches: true,
        removeEventListener: vi.fn(),
      })),
    );
    const animation = stubAnimationFrames();
    const { container } = render(<RemoraAsciiArt />);
    const artwork = screen.getByRole("img", {
      name: "ASCII art of the Remora fish mascot",
    });
    const nearbySymbol = container.querySelector<HTMLSpanElement>(
      '[data-slot="remora-ascii-symbol"]',
    );

    mockBounds(artwork, { height: 100, width: 100 });
    mockBounds(nearbySymbol, {
      height: 10,
      left: 55,
      top: 45,
      width: 10,
    });

    fireEvent.pointerEnter(artwork, {
      clientX: 50,
      clientY: 50,
      pointerType: "mouse",
    });
    animation.runNextFrame(560);

    expect(nearbySymbol?.style.transform).toMatch(
      /^translate\(2\.569px, 0\.000px\)$/,
    );
    expect(animation.frames).toHaveLength(0);
    expect(animation.requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it("invalidates measured geometry and cleans up frames in StrictMode", () => {
    let resizeCallback: ResizeObserverCallback = () => undefined;
    const disconnect = vi.fn();

    vi.stubGlobal(
      "ResizeObserver",
      class ResizeObserverMock {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        disconnect = disconnect;
        observe = vi.fn();
        unobserve = vi.fn();
      },
    );
    const animation = stubAnimationFrames();
    const { container, unmount } = render(
      <StrictMode>
        <RemoraAsciiArt />
      </StrictMode>,
    );
    const artwork = screen.getByRole("img", {
      name: "ASCII art of the Remora fish mascot",
    });
    const nearbySymbol = container.querySelector<HTMLSpanElement>(
      '[data-slot="remora-ascii-symbol"]',
    );

    mockBounds(artwork, { height: 100, width: 100 });
    mockBounds(nearbySymbol, {
      height: 10,
      left: 55,
      top: 45,
      width: 10,
    });

    fireEvent.pointerEnter(artwork, {
      clientX: 50,
      clientY: 50,
      pointerType: "mouse",
    });
    animation.runNextFrame(560);

    const initialTransform = nearbySymbol?.style.transform;

    mockBounds(nearbySymbol, {
      height: 10,
      left: 65,
      top: 45,
      width: 10,
    });
    resizeCallback([], {} as ResizeObserver);
    animation.runNextFrame(580);

    expect(nearbySymbol?.style.transform).not.toBe(initialTransform);

    unmount();

    expect(animation.frames).toHaveLength(0);
    expect(disconnect).toHaveBeenCalled();
  });
});

function stubAnimationFrames(): AnimationFrameHarness {
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrameId = 1;
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;

    nextFrameId += 1;
    frames.set(frameId, callback);

    return frameId;
  });
  const cancelAnimationFrame = vi.fn((frameId: number) => {
    frames.delete(frameId);
  });

  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

  return {
    cancelAnimationFrame,
    frames,
    requestAnimationFrame,
    runNextFrame(time = 0) {
      const nextFrame = frames.entries().next().value as
        | [number, FrameRequestCallback]
        | undefined;

      expect(nextFrame).toBeDefined();

      if (!nextFrame) {
        return;
      }

      frames.delete(nextFrame[0]);
      nextFrame[1](time);
    },
  };
}

function mockBounds(
  element: Element | null | undefined,
  bounds: Partial<DOMRect>,
) {
  if (!element) {
    throw new Error("Expected an element to mock bounds for");
  }

  const left = bounds.left ?? 0;
  const top = bounds.top ?? 0;
  const width = bounds.width ?? 0;
  const height = bounds.height ?? 0;

  element.getBoundingClientRect = () => ({
    bottom: bounds.bottom ?? top + height,
    height,
    left,
    right: bounds.right ?? left + width,
    top,
    width,
    x: bounds.x ?? left,
    y: bounds.y ?? top,
    toJSON: () => ({}),
  });
}

/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";

describe("DotFieldSkeleton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders an accessible loading status with a 9 by 9 dot field", () => {
    const { container } = render(<DotFieldSkeleton />);

    expect(screen.getByRole("status", { name: "Generating" })).toBeTruthy();
    expect(
      container.querySelectorAll('[data-slot="dot-field-skeleton-dot"]'),
    ).toHaveLength(81);
  });

  it("supports pointer interaction without relying on animation timing", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;

        nextFrameId += 1;
        animationFrames.set(frameId, callback);

        return frameId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        animationFrames.delete(frameId);
      }),
    );

    const { container } = render(<DotFieldSkeleton />);

    const skeleton = screen.getByRole("status", { name: "Generating" });
    const firstDot = container.querySelector<HTMLSpanElement>(
      '[data-slot="dot-field-skeleton-dot"]',
    );

    skeleton.getBoundingClientRect = () => ({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const initialTransform = firstDot?.style.transform;

    expect(() => {
      fireEvent.pointerEnter(skeleton, {
        buttons: 0,
        clientX: 50,
        clientY: 50,
      });
      fireEvent.pointerMove(skeleton, {
        buttons: 1,
        clientX: 56,
        clientY: 48,
      });
      fireEvent.pointerDown(skeleton, {
        buttons: 1,
        clientX: 56,
        clientY: 48,
        pointerId: 1,
      });
    }).not.toThrow();

    animationFrames.values().next().value?.(560);

    expect(firstDot?.style.transform).not.toBe(initialTransform);

    expect(() => {
      fireEvent.pointerUp(skeleton, {
        buttons: 0,
        clientX: 56,
        clientY: 48,
        pointerId: 1,
      });
      fireEvent.pointerLeave(skeleton, {
        buttons: 0,
        clientX: 104,
        clientY: 50,
      });
    }).not.toThrow();
  });

  it("keeps animating after StrictMode remounts effects", () => {
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 1;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      const frameId = nextFrameId;

      nextFrameId += 1;
      animationFrames.set(frameId, callback);

      return frameId;
    });
    const cancelAnimationFrame = vi.fn((frameId: number) => {
      animationFrames.delete(frameId);
    });

    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

    const { container } = render(
      <StrictMode>
        <DotFieldSkeleton />
      </StrictMode>,
    );

    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(cancelAnimationFrame).toHaveBeenCalledTimes(1);
    expect(animationFrames).toHaveLength(1);

    const frame = animationFrames.values().next().value;
    const firstDot = container.querySelector<HTMLSpanElement>(
      '[data-slot="dot-field-skeleton-dot"]',
    );

    expect(frame).toBeDefined();
    expect(firstDot).not.toBeNull();

    frame?.(560);

    expect(firstDot?.style.transform).toBe(
      "translate(calc(-50% + 0.000px), calc(-50% + 0.000px))",
    );
    expect(firstDot?.style.backgroundColor).toMatch(/^rgb\(/);
    expect(firstDot?.style.backgroundColor).not.toBe("rgb(118, 118, 118)");
    expect(firstDot?.style.boxShadow).toBe("");
    expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
  });
});

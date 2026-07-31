/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { neutralWizardMotionTarget } from "../../lib/generation/wizard-head.ts";
import { WizardHead, type WizardHeadMotionHandle } from "./wizard-head.tsx";

describe("WizardHead", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders every independently animated physics group", () => {
    installMatchMedia(false);

    const { container } = render(<WizardHead />);
    const riseLayer = container.querySelector('[data-physics-layer="rise"]');
    const physicsParts = Array.from(
      container.querySelectorAll<SVGGElement>("[data-physics-part]"),
      (element) => element.dataset.physicsPart,
    );

    expect(riseLayer).not.toBeNull();
    expect(physicsParts).toEqual([
      "beard",
      "head",
      "eyes",
      "moustache",
      "hat-brim",
      "hat-crown",
      "hat-charm",
    ]);
  });

  it("activates inside the proximity field and resets outside it", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const { container } = render(<WizardHead />);
    const wizard = container.querySelector<SVGSVGElement>(
      '[data-slot="wizard-head"]',
    );

    expect(wizard).not.toBeNull();

    if (!wizard) {
      return;
    }

    wizard.getBoundingClientRect = () => createRect(0, 0, 48, 48);

    act(() => {
      fireEvent.pointerMove(window, {
        clientX: 60,
        clientY: 24,
        pointerType: "mouse",
      });
      animationFrames.flush();
    });

    expect(wizard.dataset.proximityActive).toBe("true");

    act(() => {
      fireEvent.pointerMove(window, {
        clientX: 200,
        clientY: 200,
        pointerType: "mouse",
      });
      animationFrames.flush();
    });

    expect(wizard.dataset.proximityActive).toBe("false");
  });

  it("keeps reduced-motion interactions static", () => {
    installMatchMedia(true);
    const animationFrames = installAnimationFrames();
    const { container } = render(<WizardHead />);
    const wizard = container.querySelector<SVGSVGElement>(
      '[data-slot="wizard-head"]',
    );

    expect(wizard).not.toBeNull();

    if (!wizard) {
      return;
    }

    wizard.getBoundingClientRect = () => createRect(0, 0, 48, 48);

    act(() => {
      fireEvent.pointerMove(window, {
        clientX: 60,
        clientY: 24,
        pointerType: "mouse",
      });
      animationFrames.flush();
    });

    expect(wizard.dataset.proximityActive).toBe("false");
  });

  it("keeps touch interactions static", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const { container } = render(<WizardHead />);
    const wizard = container.querySelector<SVGSVGElement>(
      '[data-slot="wizard-head"]',
    );

    expect(wizard).not.toBeNull();

    if (!wizard) {
      return;
    }

    wizard.getBoundingClientRect = () => createRect(0, 0, 48, 48);

    act(() => {
      fireEvent.pointerMove(window, {
        clientX: 60,
        clientY: 24,
        pointerType: "touch",
      });
      animationFrames.flush();
    });

    expect(wizard.dataset.proximityActive).toBe("false");
  });

  it("ignores pointer proximity when not interactive", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const addEventListener = vi.spyOn(window, "addEventListener");
    const { container } = render(<WizardHead interactive={false} />);
    const wizard = container.querySelector<SVGSVGElement>(
      '[data-slot="wizard-head"]',
    );
    const pointerMoveRegistration = addEventListener.mock.calls.find(
      ([type]) => type === "pointermove",
    );

    expect(wizard).not.toBeNull();
    expect(pointerMoveRegistration).toBeUndefined();

    if (!wizard) {
      return;
    }

    wizard.getBoundingClientRect = () => createRect(0, 0, 48, 48);

    act(() => {
      fireEvent.pointerMove(window, {
        clientX: 60,
        clientY: 24,
        pointerType: "mouse",
      });
      animationFrames.flush();
    });

    expect(wizard.dataset.proximityActive).toBe("false");
  });

  it("exposes an imperative motion handle", () => {
    installMatchMedia(false);
    const handleRef = { current: null as WizardHeadMotionHandle | null };

    render(<WizardHead interactive={false} motionHandleRef={handleRef} />);

    expect(handleRef.current).not.toBeNull();
    expect(() =>
      handleRef.current?.applyMotionTarget({
        ...neutralWizardMotionTarget,
        crownY: 2,
        headY: 1,
      }),
    ).not.toThrow();
  });

  it("removes pointer listeners and pending frames when unmounted", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const addEventListener = vi.spyOn(window, "addEventListener");
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { container, unmount } = render(<WizardHead />);
    const wizard = container.querySelector<SVGSVGElement>(
      '[data-slot="wizard-head"]',
    );
    const pointerMoveRegistration = addEventListener.mock.calls.find(
      ([type]) => type === "pointermove",
    );

    expect(pointerMoveRegistration).toBeDefined();

    if (!wizard || !pointerMoveRegistration) {
      return;
    }

    wizard.getBoundingClientRect = () => createRect(0, 0, 48, 48);
    fireEvent.pointerMove(window, {
      clientX: 60,
      clientY: 24,
      pointerType: "mouse",
    });

    expect(animationFrames.pending()).toBeGreaterThan(0);

    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      "pointermove",
      pointerMoveRegistration[1],
    );
    expect(animationFrames.cancel).toHaveBeenCalled();
  });
});

function installAnimationFrames() {
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => {
    const frameId = nextFrameId;

    nextFrameId += 1;
    frames.set(frameId, callback);

    return frameId;
  });
  const cancel = vi.fn((frameId: number) => {
    frames.delete(frameId);
  });

  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  return {
    cancel,
    flush() {
      const pendingFrames = Array.from(frames.values());

      frames.clear();

      pendingFrames.forEach((callback) => callback(16));
    },
    pending: () => frames.size,
  };
}

function installMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      removeEventListener: vi.fn(),
    })),
  );
}

function createRect(
  left: number,
  top: number,
  width: number,
  height: number,
): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

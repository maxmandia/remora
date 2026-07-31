/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WizardEntranceOverlay } from "./wizard-entrance-overlay.tsx";

describe("WizardEntranceOverlay", () => {
  afterEach(() => {
    cleanup();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("completes immediately without rendering under reduced motion", () => {
    installMatchMedia(true);
    const onComplete = vi.fn();

    const { container } = render(
      <WizardEntranceOverlay
        logoRef={{ current: null }}
        placement="centered"
        stageRef={{ current: null }}
        onComplete={onComplete}
      />,
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-slot="wizard-entrance-overlay"]'),
    ).toBeNull();
  });

  it("completes immediately without rendering when the stage is docked", () => {
    installMatchMedia(false);
    const onComplete = vi.fn();

    const { container } = render(
      <WizardEntranceOverlay
        logoRef={{ current: null }}
        placement="docked"
        stageRef={{ current: null }}
        onComplete={onComplete}
      />,
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-slot="wizard-entrance-overlay"]'),
    ).toBeNull();
  });

  it("bails out when the measured geometry is degenerate", () => {
    installMatchMedia(false);
    installAnimationFrames();
    const { logo, stage } = installStageDom();
    const onComplete = vi.fn();

    const { container } = render(
      <WizardEntranceOverlay
        logoRef={{ current: logo }}
        placement="centered"
        stageRef={{ current: stage }}
        onComplete={onComplete}
      />,
    );

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-slot="wizard-entrance-overlay"]'),
    ).toBeNull();
  });

  it("runs the entrance and completes once the timeline finishes", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const { logo, slot, stage } = installStageDom();

    vi.spyOn(performance, "now").mockReturnValue(0);
    stage.getBoundingClientRect = () => createRect(0, 0, 1200, 900);
    logo.getBoundingClientRect = () => createRect(436, 282, 328, 82);
    slot.getBoundingClientRect = () => createRect(1016, 408, 48, 48);

    const onComplete = vi.fn();
    const { container } = render(
      <WizardEntranceOverlay
        logoRef={{ current: logo }}
        placement="centered"
        stageRef={{ current: stage }}
        onComplete={onComplete}
      />,
    );

    act(() => {
      animationFrames.flush(16);
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-slot="wizard-entrance-overlay"]'),
    ).not.toBeNull();

    act(() => {
      animationFrames.flush(10_000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("finishes early when the window resizes beyond tolerance", () => {
    installMatchMedia(false);
    const animationFrames = installAnimationFrames();
    const { logo, slot, stage } = installStageDom();

    vi.spyOn(performance, "now").mockReturnValue(0);
    stage.getBoundingClientRect = () => createRect(0, 0, 1200, 900);
    logo.getBoundingClientRect = () => createRect(436, 282, 328, 82);
    slot.getBoundingClientRect = () => createRect(1016, 408, 48, 48);

    const onComplete = vi.fn();

    render(
      <WizardEntranceOverlay
        logoRef={{ current: logo }}
        placement="centered"
        stageRef={{ current: stage }}
        onComplete={onComplete}
      />,
    );

    act(() => {
      animationFrames.flush(16);
    });

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      window.innerWidth += 400;
      window.dispatchEvent(new Event("resize"));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

function installStageDom() {
  const stage = document.createElement("div");
  const logo = document.createElement("img");
  const slot = document.createElement("button");

  slot.dataset.slot = "generation-command-wizard";
  Object.defineProperty(logo, "complete", { value: true });
  Object.defineProperty(logo, "naturalWidth", { value: 372 });
  stage.append(logo, slot);
  document.body.append(stage);

  return { logo, slot, stage };
}

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
    flush(frameTime: number) {
      const pendingFrames = Array.from(frames.values());

      frames.clear();

      pendingFrames.forEach((callback) => callback(frameTime));
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

/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WizardHandwrittenCallout } from "./wizard-handwritten-callout.tsx";

const mocks = vi.hoisted(() => ({
  prefersReducedMotion: { current: false },
}));

vi.mock("../../hooks/use-prefers-reduced-motion.ts", () => ({
  usePrefersReducedMotion: () => mocks.prefersReducedMotion.current,
}));

describe("WizardHandwrittenCallout", () => {
  afterEach(() => {
    cleanup();
    mocks.prefersReducedMotion.current = false;
    vi.useRealTimers();
  });

  it("renders the fixed instruction as accessible text and decorative strokes", () => {
    const { container } = render(
      <WizardHandwrittenCallout visible onDismiss={vi.fn()} />,
    );

    expect(screen.getByRole("status").textContent).toBe(
      "Click the wizard to help build prompts",
    );
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(
      container.querySelectorAll("[data-glyph-index]").length,
    ).toBeGreaterThan(32);
    expect(
      container.querySelectorAll('[data-slot="wizard-handwritten-arrow"]'),
    ).toHaveLength(2);
    expect(
      container
        .querySelector(
          '[data-slot="wizard-handwritten-arrow"][data-direction="left"]',
        )
        ?.getAttribute("class"),
    ).toContain("top-[4.75rem]");
    expect(
      container
        .querySelector(
          '[data-slot="wizard-handwritten-arrow"][data-direction="right"]',
        )
        ?.getAttribute("class"),
    ).toContain("left-1/2");
  });

  it("does not render the instruction while hidden", () => {
    render(<WizardHandwrittenCallout visible={false} onDismiss={vi.fn()} />);

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("requests dismissal after the draw and hold period", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();

    render(<WizardHandwrittenCallout visible onDismiss={onDismiss} />);

    act(() => vi.advanceTimersByTime(2599));
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("clears its dismissal timer when unmounted", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const rendered = render(
      <WizardHandwrittenCallout visible onDismiss={onDismiss} />,
    );

    rendered.unmount();
    act(() => vi.advanceTimersByTime(2600));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("renders completed lettering without motion when reduced motion is preferred", () => {
    mocks.prefersReducedMotion.current = true;
    const { container } = render(
      <WizardHandwrittenCallout visible onDismiss={vi.fn()} />,
    );
    const callout = container.querySelector<HTMLElement>(
      '[data-slot="wizard-handwritten-callout"]',
    );

    expect(callout?.getAttribute("data-motion")).toBe("reduced");
    expect(
      container.querySelectorAll('[style*="stroke-dasharray"]').length,
    ).toBe(0);
  });
});

/** @vitest-environment jsdom */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ExplorePage,
  exploreVhsWheelCenterScrollTop,
  exploreVhsWheelStepDistancePx,
  getExploreVhsSelectedTapeStep,
  getExploreVhsWheelRotationDelta,
} from "./explore-page.tsx";
import {
  exploreVhsTapeCount,
  exploreVhsTapeStepDegrees,
  getExploreVhsFocusedTapeIndex,
  getExploreVhsWheelRotation,
} from "./explore-vhs-wheel.tsx";

describe("ExplorePage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders ten evenly spaced decorative VHS tapes", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const wheel = container.querySelector('[data-slot="explore-vhs-wheel"]');
    const tapes = Array.from(
      container.querySelectorAll('[data-slot="explore-vhs-tape"]'),
    );
    const images = tapes.map((tape) => tape.querySelector("img"));

    expect(wheel?.hasAttribute("aria-hidden")).toBe(false);
    expect(wheel?.className).toContain("top-1/2 left-0");
    expect(main?.className).toContain(
      "[--explore-vhs-wheel-radius:clamp(10.5rem,31dvh,20rem)]",
    );
    expect(tapes).toHaveLength(exploreVhsTapeCount);
    expect(
      tapes.map((tape) => Number(tape.getAttribute("data-angle"))),
    ).toEqual(
      Array.from(
        { length: exploreVhsTapeCount },
        (_, index) => index * exploreVhsTapeStepDegrees,
      ),
    );
    expect(images.every((image) => image?.getAttribute("alt") === "")).toBe(
      true,
    );
    expect(
      images.every((image) => image?.getAttribute("draggable") === "false"),
    ).toBe(true);
    expect(images[0]?.getAttribute("src")).toContain(
      "explore-vhs-cassette.webp",
    );
    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(
      screen.getAllByRole("button", { name: /Center VHS tape/ }),
    ).toHaveLength(exploreVhsTapeCount);
  });

  it("maps unbounded wheel steps to exact tape detents", () => {
    expect(getExploreVhsWheelRotation(0)).toBe(0);
    expect(getExploreVhsWheelRotation(1)).toBe(36);
    expect(getExploreVhsWheelRotation(10)).toBe(360);
    expect(getExploreVhsWheelRotation(11)).toBe(396);
    expect(getExploreVhsWheelRotation(-1)).toBe(-36);
    expect(getExploreVhsFocusedTapeIndex(0)).toBe(0);
    expect(getExploreVhsFocusedTapeIndex(1)).toBe(9);
    expect(getExploreVhsFocusedTapeIndex(10)).toBe(0);
    expect(getExploreVhsFocusedTapeIndex(-1)).toBe(1);
    expect(getExploreVhsWheelRotationDelta(8)).toBe(1.5);
    expect(getExploreVhsWheelRotationDelta(192)).toBe(36);
    expect(getExploreVhsWheelRotationDelta(-96)).toBe(-18);
    expect(getExploreVhsSelectedTapeStep(0, 1)).toBe(-1);
    expect(getExploreVhsSelectedTapeStep(0, 9)).toBe(1);
    expect(getExploreVhsSelectedTapeStep(396, 0)).toBe(10);
    expect(getExploreVhsSelectedTapeStep(-36, 9)).toBe(1);
  });

  it("tracks native scrolling continuously and snaps only when scrolling ends", () => {
    vi.useFakeTimers();

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const wheel = container.querySelector('[data-slot="explore-vhs-wheel"]');

    if (!main || !wheel) {
      throw new Error("Expected the Explore wheel surface");
    }

    main.scrollTop =
      exploreVhsWheelCenterScrollTop + exploreVhsWheelStepDistancePx / 2;
    fireEvent.scroll(main);

    expect(wheel.getAttribute("data-rotation")).toBe("18");
    expect(wheel.getAttribute("data-target-rotation")).toBe("0");

    act(() => vi.advanceTimersByTime(5_000));
    expect(wheel.getAttribute("data-rotation")).toBe("18");
    expect(wheel.getAttribute("data-target-rotation")).toBe("0");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("36");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("9");
    act(() => vi.advanceTimersByTime(16));

    main.scrollTop =
      exploreVhsWheelCenterScrollTop + exploreVhsWheelStepDistancePx * 10;
    fireEvent.scroll(main);
    expect(wheel.getAttribute("data-rotation")).toBe("396");
    expect(wheel.getAttribute("data-target-rotation")).toBe("36");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("396");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("9");
    act(() => vi.advanceTimersByTime(16));

    main.scrollTop =
      exploreVhsWheelCenterScrollTop - exploreVhsWheelStepDistancePx;
    fireEvent.scroll(main);
    expect(wheel.getAttribute("data-rotation")).toBe("360");
    expect(wheel.getAttribute("data-target-rotation")).toBe("396");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("360");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("0");
  });

  it("uses a fluid native snap to advance after a very small scroll", () => {
    vi.useFakeTimers();

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const wheel = container.querySelector('[data-slot="explore-vhs-wheel"]');

    if (!main || !wheel) {
      throw new Error("Expected the Explore wheel surface");
    }

    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === "number") {
        main.scrollTop = top;
      }
    });

    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    main.scrollTop = exploreVhsWheelCenterScrollTop + 8;
    fireEvent.scroll(main);

    expect(wheel.getAttribute("data-rotation")).toBe("1.5");
    expect(wheel.getAttribute("data-target-rotation")).toBe("0");

    fireScrollEnd(main);
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: exploreVhsWheelCenterScrollTop + exploreVhsWheelStepDistancePx,
    });
    expect(wheel.getAttribute("data-target-rotation")).toBe("0");

    fireEvent.scroll(main);
    expect(wheel.getAttribute("data-rotation")).toBe("36");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("36");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("9");
  });

  it("preserves large native scroll gestures across multiple tapes", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const wheel = container.querySelector('[data-slot="explore-vhs-wheel"]');

    if (!main || !wheel) {
      throw new Error("Expected the Explore wheel surface");
    }

    main.scrollTop =
      exploreVhsWheelCenterScrollTop + exploreVhsWheelStepDistancePx * 4;
    fireEvent.scroll(main);

    expect(wheel.getAttribute("data-rotation")).toBe("144");
    expect(wheel.getAttribute("data-target-rotation")).toBe("0");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("144");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("6");
  });

  it("centers a clicked tape using the shortest rotation", () => {
    vi.useFakeTimers();

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const wheel = container.querySelector('[data-slot="explore-vhs-wheel"]');
    const selectedTape = container.querySelector(
      '[data-slot="explore-vhs-tape"][data-angle="36"]',
    );

    if (!main || !wheel || !selectedTape) {
      throw new Error("Expected the Explore wheel surface");
    }

    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === "number") {
        main.scrollTop = top;
      }
    });

    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    fireEvent.click(screen.getByRole("button", { name: "Center VHS tape 2" }));

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: exploreVhsWheelCenterScrollTop - exploreVhsWheelStepDistancePx,
    });

    fireEvent.scroll(main);
    expect(wheel.getAttribute("data-rotation")).toBe("-36");

    fireScrollEnd(main);
    expect(wheel.getAttribute("data-target-rotation")).toBe("-36");
    expect(wheel.getAttribute("data-focused-tape-index")).toBe("1");
    expect(selectedTape.getAttribute("data-focused")).toBe("true");
  });

  it("leaves the wheel static for reduced motion", () => {
    installMatchMedia(true);

    const { container } = render(
      <ExplorePage
        category="film"
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );
    const main = container.querySelector<HTMLElement>("main");
    const frame = container.querySelector<HTMLElement>(
      '[data-slot="explore-vhs-frame"]',
    );
    const wheel = container.querySelector<HTMLElement>(
      '[data-slot="explore-vhs-wheel"]',
    );

    if (!main) {
      throw new Error("Expected the Explore surface");
    }

    main.scrollTop =
      exploreVhsWheelCenterScrollTop + exploreVhsWheelStepDistancePx;
    fireEvent.scroll(main);

    expect(frame?.getAttribute("data-motion")).toBe("reduced");
    expect(main?.style.height).toBe(frame?.style.height);
    expect(wheel?.getAttribute("data-target-rotation")).toBe("0");
  });

  it("returns to the workspace from the header action", () => {
    const onBack = vi.fn();

    render(
      <ExplorePage
        onBack={onBack}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to create" }));

    expect(onBack).toHaveBeenCalledOnce();
  });
});

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

function fireScrollEnd(element: Element) {
  fireEvent(element, new Event("scrollend"));
}

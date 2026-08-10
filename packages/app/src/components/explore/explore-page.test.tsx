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
  exploreArtworks,
  exploreAdsVhsTapes,
  exploreVhsTapes,
} from "../../lib/explore/explore.ts";
import {
  ExplorePage,
  exploreVhsCenterScrollTop,
  exploreVhsStepDistancePx,
  getExploreVhsSelectedTapeStep,
} from "./explore-page.tsx";
import {
  exploreVhsTapeCount,
  getExploreVhsFocusedTapeIndex,
  getExploreVhsTapeOffset,
} from "./explore-vhs-stack.tsx";

describe("ExplorePage", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("renders the decorative VHS tapes stacked around the centered tape", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const scene = container.querySelector('[data-slot="explore-scene"]');
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');
    const tapes = Array.from(
      container.querySelectorAll('[data-slot="explore-vhs-tape"]'),
    );
    const images = tapes.map((tape) => tape.querySelector("img"));

    expect(stack?.hasAttribute("aria-hidden")).toBe(false);
    expect(stack?.className).toContain("top-1/2");
    expect(main?.getAttribute("data-theme")).toBe("light");
    expect(main?.className).toContain("bg-background");
    expect(main?.className).toContain("--explore-crt-tv-size");
    expect(main?.className).toContain("--explore-scene-edge");
    expect(main?.className).toContain("--explore-vhs-tape-width");
    expect(main?.className).toContain("--explore-vhs-tape-gap");
    expect(scene?.className).toContain("max-w-[90rem]");
    expect(scene?.contains(stack)).toBe(true);
    expect(
      scene?.contains(container.querySelector('[data-slot="explore-crt-tv"]')),
    ).toBe(true);
    expect(tapes).toHaveLength(exploreVhsTapeCount);
    expect(
      tapes.map((tape) => Number(tape.getAttribute("data-offset"))),
    ).toEqual(
      exploreVhsTapes.map((_, tapeIndex) =>
        getExploreVhsTapeOffset(0, tapeIndex),
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
    expect(
      screen.getByRole("img", { name: "Film creative inspiration" }),
    ).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Center / })).toHaveLength(
      exploreVhsTapeCount,
    );

    const caption = container.querySelector(
      '[data-slot="explore-vhs-tape-caption"]',
    );

    expect(caption?.getAttribute("data-settled")).toBe("true");
    expect(caption?.textContent).toContain(exploreVhsTapes[0].title);
    expect(caption?.textContent).toContain(exploreVhsTapes[0].description);
    expect(screen.queryByText(exploreVhsTapes[1].title)).toBeNull();
  });

  it("tries the focused prompt by its stable tape key", () => {
    const onTryPrompt = vi.fn();
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={onTryPrompt}
      />,
    );
    const main = container.querySelector("main");

    if (!main) {
      throw new Error("Expected the Explore surface");
    }

    fireEvent.click(screen.getByRole("button", { name: "Try prompt" }));

    expect(onTryPrompt).toHaveBeenLastCalledWith(exploreVhsTapes[0].key);

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx;
    fireEvent.scroll(main);
    fireScrollEnd(main);
    fireEvent.click(screen.getByRole("button", { name: "Try prompt" }));

    expect(onTryPrompt).toHaveBeenLastCalledWith(exploreVhsTapes[1].key);
  });

  it("hides the caption while the stack moves and reveals the settled tape", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const caption = container.querySelector(
      '[data-slot="explore-vhs-tape-caption"]',
    );

    if (!main || !caption) {
      throw new Error("Expected the Explore tape stack surface");
    }

    expect(caption.getAttribute("data-settled")).toBe("true");
    expect(caption.textContent).toContain(exploreVhsTapes[0].title);

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx / 2;
    fireEvent.scroll(main);

    expect(caption.getAttribute("data-settled")).toBe("false");

    fireScrollEnd(main);

    expect(caption.getAttribute("data-settled")).toBe("true");
    expect(caption.textContent).toContain(exploreVhsTapes[1].title);
    expect(caption.textContent).toContain(exploreVhsTapes[1].description);
    expect(screen.queryByText(exploreVhsTapes[0].title)).toBeNull();
  });

  it("plays the focused tape's video on the fixed CRT canvas", () => {
    const { container } = render(
      <ExplorePage
        category="film"
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const tv = container.querySelector('[data-slot="explore-crt-tv"]');
    const canvas = screen.getByLabelText<HTMLCanvasElement>(
      "Film creative inspiration",
    );
    const frame = tv?.querySelector("img");

    if (!main) {
      throw new Error("Expected the Explore surface");
    }

    expect(tv?.getAttribute("data-category")).toBe("film");
    expect(canvas.getAttribute("data-render-state")).toBe("fallback");
    expect(canvas.getAttribute("data-video-url")).toBe(
      exploreVhsTapes[0].videoUrl,
    );
    expect(frame?.getAttribute("src")).toContain("explore-crt-tv.webp");
    expect(frame?.getAttribute("alt")).toBe("");

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx;
    fireEvent.scroll(main);

    expect(canvas.getAttribute("data-video-url")).toBe(
      exploreVhsTapes[0].videoUrl,
    );

    fireScrollEnd(main);

    expect(canvas.getAttribute("data-video-url")).toBe(
      exploreVhsTapes[1].videoUrl,
    );
  });

  it("uses the Ads tapes and prompts for the Ads category", () => {
    const onTryPrompt = vi.fn();
    const { container } = render(
      <ExplorePage
        category="ads"
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={onTryPrompt}
      />,
    );
    const canvas = screen.getByLabelText<HTMLCanvasElement>(
      "Ads creative inspiration",
    );

    expect(
      container.querySelectorAll('[data-slot="explore-vhs-tape"]'),
    ).toHaveLength(exploreAdsVhsTapes.length);
    expect(canvas.getAttribute("data-video-url")).toBe(
      exploreAdsVhsTapes[0].videoUrl,
    );
    expect(screen.getByText(exploreAdsVhsTapes[0].title)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try prompt" }));

    expect(onTryPrompt).toHaveBeenCalledWith(exploreAdsVhsTapes[0].key);
  });

  it("renders Cloudflare artwork in gilded frames for the Art category", () => {
    const onBack = vi.fn();
    const onTryPrompt = vi.fn();
    const { container } = render(
      <ExplorePage
        category="art"
        onBack={onBack}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={onTryPrompt}
      />,
    );
    const page = container.querySelector<HTMLElement>(
      '[data-slot="explore-art-page"]',
    );

    expect(page?.tagName).toBe("MAIN");
    expect(page?.className).toContain("overflow-y-auto");
    expect(page?.getAttribute("data-theme")).toBe("light");
    expect(
      container.querySelectorAll('[data-slot="explore-artwork"]'),
    ).toHaveLength(exploreArtworks.length);
    expect(
      container.querySelectorAll('[data-slot="explore-art-frame"]'),
    ).toHaveLength(exploreArtworks.length);
    expect(
      container.querySelectorAll('[data-slot="explore-art-frame"] [data-side]'),
    ).toHaveLength(exploreArtworks.length * 4);
    expect(container.querySelector("[data-corner]")).toBeNull();
    expect(
      screen
        .getByRole("img", { name: exploreArtworks[0].alt })
        .getAttribute("src"),
    ).toBe(exploreArtworks[0].imageUrl);
    expect(screen.getByText(exploreArtworks[0].title)).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Try prompt: ${exploreArtworks[0].title}`,
      }),
    );
    expect(onTryPrompt).toHaveBeenCalledWith(exploreArtworks[0].key);
    expect(
      container.querySelector('[data-slot="explore-vhs-frame"]'),
    ).toBeNull();
    expect(container.querySelector('[data-slot="explore-crt-tv"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(onBack).toHaveBeenCalledOnce();
  });

  it("maps unbounded steps to wrapped tape offsets and focus", () => {
    expect(getExploreVhsFocusedTapeIndex(0)).toBe(0);
    expect(getExploreVhsFocusedTapeIndex(1)).toBe(1);
    expect(getExploreVhsFocusedTapeIndex(exploreVhsTapeCount)).toBe(0);
    expect(getExploreVhsFocusedTapeIndex(-1)).toBe(exploreVhsTapeCount - 1);
    expect(getExploreVhsTapeOffset(0, 0)).toBe(0);
    expect(getExploreVhsTapeOffset(0, 1)).toBe(1);
    expect(getExploreVhsTapeOffset(0, exploreVhsTapeCount - 1)).toBe(-1);
    expect(getExploreVhsTapeOffset(0.5, 0)).toBe(-0.5);
    expect(getExploreVhsTapeOffset(0.5, 1)).toBe(0.5);
    expect(getExploreVhsTapeOffset(exploreVhsTapeCount, 0)).toBe(0);
    expect(getExploreVhsTapeOffset(-exploreVhsTapeCount + 0.5, 0)).toBe(-0.5);
    expect(getExploreVhsSelectedTapeStep(0, 1)).toBe(1);
    expect(getExploreVhsSelectedTapeStep(0, exploreVhsTapeCount - 1)).toBe(-1);
    expect(getExploreVhsSelectedTapeStep(exploreVhsTapeCount * 4 - 1, 0)).toBe(
      exploreVhsTapeCount * 4,
    );
    expect(getExploreVhsSelectedTapeStep(-1, exploreVhsTapeCount - 1)).toBe(-1);
  });

  it("tracks native scrolling continuously and snaps only when scrolling ends", () => {
    vi.useFakeTimers();

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');

    if (!main || !stack) {
      throw new Error("Expected the Explore tape stack surface");
    }

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx / 2;
    fireEvent.scroll(main);

    expect(stack.getAttribute("data-step")).toBe("0.5");
    expect(stack.getAttribute("data-target-step")).toBe("0");

    act(() => vi.advanceTimersByTime(5_000));
    expect(stack.getAttribute("data-step")).toBe("0.5");
    expect(stack.getAttribute("data-target-step")).toBe("0");

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe("1");
    expect(stack.getAttribute("data-focused-tape-index")).toBe("1");
    act(() => vi.advanceTimersByTime(16));

    main.scrollTop =
      exploreVhsCenterScrollTop +
      exploreVhsStepDistancePx * exploreVhsTapeCount;
    fireEvent.scroll(main);
    expect(stack.getAttribute("data-step")).toBe(
      String(exploreVhsTapeCount + 1),
    );
    expect(stack.getAttribute("data-target-step")).toBe("1");

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe(
      String(exploreVhsTapeCount + 1),
    );
    expect(stack.getAttribute("data-focused-tape-index")).toBe("1");
    act(() => vi.advanceTimersByTime(16));

    main.scrollTop = exploreVhsCenterScrollTop - exploreVhsStepDistancePx;
    fireEvent.scroll(main);
    expect(stack.getAttribute("data-step")).toBe(String(exploreVhsTapeCount));
    expect(stack.getAttribute("data-target-step")).toBe(
      String(exploreVhsTapeCount + 1),
    );

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe(
      String(exploreVhsTapeCount),
    );
    expect(stack.getAttribute("data-focused-tape-index")).toBe("0");
  });

  it("uses a fluid native snap to advance after a very small scroll", () => {
    vi.useFakeTimers();

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');

    if (!main || !stack) {
      throw new Error("Expected the Explore tape stack surface");
    }

    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === "number") {
        main.scrollTop = top;
      }
    });

    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    main.scrollTop = exploreVhsCenterScrollTop + 48;
    fireEvent.scroll(main);

    expect(stack.getAttribute("data-step")).toBe(
      String(48 / exploreVhsStepDistancePx),
    );
    expect(stack.getAttribute("data-target-step")).toBe("0");

    fireScrollEnd(main);
    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: exploreVhsCenterScrollTop + exploreVhsStepDistancePx,
    });
    expect(stack.getAttribute("data-target-step")).toBe("0");

    fireEvent.scroll(main);
    expect(stack.getAttribute("data-step")).toBe("1");

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe("1");
    expect(stack.getAttribute("data-focused-tape-index")).toBe("1");
  });

  it("preserves large native scroll gestures across multiple tapes", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');

    if (!main || !stack) {
      throw new Error("Expected the Explore tape stack surface");
    }

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx * 4;
    fireEvent.scroll(main);

    expect(stack.getAttribute("data-step")).toBe("4");
    expect(stack.getAttribute("data-target-step")).toBe("0");

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe("4");
    expect(stack.getAttribute("data-focused-tape-index")).toBe("4");
  });

  it("advances one tape for a short swipe", () => {
    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');

    if (!main || !stack) {
      throw new Error("Expected the Explore tape stack surface");
    }

    main.scrollTop = exploreVhsCenterScrollTop + 288;
    fireEvent.scroll(main);
    fireScrollEnd(main);

    expect(stack.getAttribute("data-target-step")).toBe("1");
    expect(stack.getAttribute("data-focused-tape-index")).toBe("1");
  });

  it("centers a clicked tape using the shortest scroll direction", () => {
    vi.useFakeTimers();
    const lastTapeIndex = exploreVhsTapes.length - 1;

    const { container } = render(
      <ExplorePage
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector("main");
    const stack = container.querySelector('[data-slot="explore-vhs-stack"]');
    const selectedTape = container.querySelector(
      `[data-slot="explore-vhs-tape"][data-tape-index="${lastTapeIndex}"]`,
    );

    if (!main || !stack || !selectedTape) {
      throw new Error("Expected the Explore tape stack surface");
    }

    const scrollTo = vi.fn(({ top }: ScrollToOptions) => {
      if (typeof top === "number") {
        main.scrollTop = top;
      }
    });

    main.scrollTo = scrollTo as unknown as typeof main.scrollTo;
    fireEvent.click(
      screen.getByRole("button", {
        name: `Center ${exploreVhsTapes[lastTapeIndex].title}`,
      }),
    );

    expect(scrollTo).toHaveBeenCalledWith({
      behavior: "smooth",
      top: exploreVhsCenterScrollTop - exploreVhsStepDistancePx,
    });

    fireEvent.scroll(main);
    expect(stack.getAttribute("data-step")).toBe("-1");

    fireScrollEnd(main);
    expect(stack.getAttribute("data-target-step")).toBe("-1");
    expect(stack.getAttribute("data-focused-tape-index")).toBe(
      String(lastTapeIndex),
    );
    expect(selectedTape.getAttribute("data-focused")).toBe("true");
    expect(selectedTape.getAttribute("data-offset")).toBe("0");
  });

  it("leaves the tape stack static for reduced motion", () => {
    installMatchMedia(true);

    const { container } = render(
      <ExplorePage
        category="film"
        onBack={() => undefined}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );
    const main = container.querySelector<HTMLElement>("main");
    const frame = container.querySelector<HTMLElement>(
      '[data-slot="explore-vhs-frame"]',
    );
    const stack = container.querySelector<HTMLElement>(
      '[data-slot="explore-vhs-stack"]',
    );

    if (!main) {
      throw new Error("Expected the Explore surface");
    }

    main.scrollTop = exploreVhsCenterScrollTop + exploreVhsStepDistancePx;
    fireEvent.scroll(main);

    expect(frame?.getAttribute("data-motion")).toBe("reduced");
    expect(main?.style.height).toBe(frame?.style.height);
    expect(stack?.getAttribute("data-target-step")).toBe("0");
  });

  it("invokes onBack from the header action", () => {
    const onBack = vi.fn();

    render(
      <ExplorePage
        onBack={onBack}
        onSelectCategory={() => undefined}
        onStartCreating={() => undefined}
        onTryPrompt={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

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

/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LandingCursorStage } from "./landing-cursor-stage";

describe("LandingCursorStage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        disconnect() {}
        observe() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is hidden from assistive technology and ignores pointer events", () => {
    stubReducedMotion(false);

    const { container } = render(<LandingCursorStage />);
    const stage = container.firstElementChild;

    expect(stage?.getAttribute("aria-hidden")).toBe("true");
    expect(stage?.className).toContain("pointer-events-none");
    expect(stage?.className).toContain("gap-y-3");
    expect(stage?.className).toContain("sm:gap-y-20");
    expect(
      [...(stage?.children ?? [])].every((section) =>
        section.className.includes("overflow-hidden"),
      ),
    ).toBe(true);
  });

  it("renders a section with boxes, artwork, and video for each of the eight mice", () => {
    stubReducedMotion(false);

    const { container } = render(<LandingCursorStage />);
    const cursorImages = [
      ...container.querySelectorAll('[data-slot="landing-cursor"]'),
    ];
    const artworkImages = [
      ...container.querySelectorAll('[data-slot="landing-artwork"]'),
    ];
    const videos = [
      ...container.querySelectorAll('[data-slot="landing-video"]'),
    ];

    expect(cursorImages).toHaveLength(8);
    expect(artworkImages).toHaveLength(8);
    expect(videos).toHaveLength(8);
    expect(
      container.querySelectorAll('[data-slot="landing-media-box"]'),
    ).toHaveLength(8);
    expect(
      container.querySelectorAll('[data-slot="landing-video-prompt-box"]'),
    ).toHaveLength(8);
    expect(cursorImages.map((image) => image.getAttribute("src"))).toEqual([
      "/mice/mouse-baby-blue.svg",
      "/mice/mouse-red.svg",
      "/mice/mouse-green.svg",
      "/mice/mouse-pink.svg",
      "/mice/mouse-orange.svg",
      "/mice/mouse-purple.svg",
      "/mice/mouse-blue.svg",
      "/mice/mouse-yellow.svg",
    ]);

    const names = [
      "neon-shark",
      "fox-windstorm",
      "dandelion-kitten",
      "detective-fox",
      "ostrich-editorial",
      "android-grief",
      "prehistoric-family",
      "loving-grace",
    ];
    expect(artworkImages.map((image) => image.getAttribute("src"))).toEqual(
      names.map((name) => `/src/assets/landing/${name}.webp`),
    );
    expect(videos.map((video) => video.getAttribute("src"))).toEqual(
      names.map((name) => `/src/assets/landing/${name}.mp4`),
    );
    expect(videos.map((video) => video.getAttribute("poster"))).toEqual(
      artworkImages.map((image) => image.getAttribute("src")),
    );

    for (const video of videos) {
      expect(video.getAttribute("preload")).toBe("none");
      expect(video.hasAttribute("controls")).toBe(false);
      expect(video.hasAttribute("loop")).toBe(true);
      expect(video.hasAttribute("playsinline")).toBe(true);
    }
  });

  it("renders visible previews and agents before JavaScript starts", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LandingCursorStage />);
    const boxes = container.querySelectorAll<HTMLElement>(
      '[data-slot="landing-media-box"]',
    );
    const previews = container.querySelectorAll<HTMLElement>(
      '[data-slot="landing-artwork"], [data-slot="landing-cursor"]',
    );

    expect(boxes).toHaveLength(8);
    expect(previews).toHaveLength(16);
    for (const box of boxes) {
      expect(box.style.visibility).not.toBe("hidden");
      expect(box.getAttribute("style")).toContain("width:");
      expect(box.getAttribute("style")).toContain("height:");
      expect(box.style.transform).not.toBe("");
    }
    for (const preview of previews) {
      expect(preview.classList.contains("opacity-0")).toBe(false);
      expect(preview.style.opacity).not.toBe("0");
    }
  });

  it("starts two cursors at the beginning and staggers the other six", () => {
    stubReducedMotion(false);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

    const animationFrames: FrameRequestCallback[] = [];

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback);
        return animationFrames.length;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { container } = render(<LandingCursorStage />);

    act(() => {
      animationFrames[0]?.(0);
    });

    const mediaBoxes = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-slot="landing-media-box"]',
      ),
    ];
    const beginningIndices = mediaBoxes.flatMap((box, index) =>
      box.style.visibility === "hidden" ? [index] : [],
    );

    expect(beginningIndices).toHaveLength(2);
    expect([
      [0, 7],
      [1, 6],
      [2, 5],
      [3, 4],
    ]).toContainEqual(beginningIndices);
    expect(
      mediaBoxes.filter((box) => box.style.visibility === "visible"),
    ).toHaveLength(6);
  });

  it("advances every cursor without showing duplicate media", () => {
    stubReducedMotion(false);
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();

    let nextAnimationFrame: FrameRequestCallback | undefined;

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        nextAnimationFrame = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());

    const { container } = render(<LandingCursorStage />);
    const artworkImages = [
      ...container.querySelectorAll<HTMLImageElement>(
        '[data-slot="landing-artwork"]',
      ),
    ];
    const initialSources = artworkImages.map((image) =>
      image.getAttribute("src"),
    );
    const videos = [
      ...container.querySelectorAll<HTMLVideoElement>(
        '[data-slot="landing-video"]',
      ),
    ];
    const changed = artworkImages.map(() => false);
    let showedDuplicateMedia = false;

    act(() => {
      for (let frameIndex = 0; frameIndex < 1_000; frameIndex += 1) {
        const callback = nextAnimationFrame;

        if (!callback) {
          break;
        }

        nextAnimationFrame = undefined;
        callback(frameIndex * 100);

        artworkImages.forEach((image, index) => {
          if (image.getAttribute("src") !== initialSources[index]) {
            changed[index] = true;
          }
        });

        const visibleMediaSources = [...artworkImages, ...videos].flatMap(
          (media) => {
            const source = media.getAttribute("src");

            return Number.parseFloat(media.style.opacity) > 0 && source
              ? [source]
              : [];
          },
        );

        if (new Set(visibleMediaSources).size !== visibleMediaSources.length) {
          showedDuplicateMedia = true;
        }

        if (changed.every(Boolean)) {
          break;
        }
      }
    });

    expect(changed).toEqual([true, true, true, true, true, true, true, true]);
    expect(showedDuplicateMedia).toBe(false);
  });

  it("applies the fully composed frame when reduced motion is preferred", () => {
    stubReducedMotion(true);

    const { container } = render(<LandingCursorStage />);
    const cursorImages = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-slot="landing-cursor"]',
      ),
    ];
    const mediaBoxes = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-slot="landing-media-box"]',
      ),
    ];
    const promptBoxes = [
      ...container.querySelectorAll<HTMLElement>(
        '[data-slot="landing-video-prompt-box"]',
      ),
    ];

    expect(cursorImages).toHaveLength(8);

    for (const cursorImage of cursorImages) {
      expect(cursorImage.style.opacity).toBe("1");
    }

    for (const promptBox of promptBoxes) {
      expect(promptBox.style.visibility).toBe("hidden");
    }

    for (const box of mediaBoxes) {
      expect(box.style.visibility).toBe("visible");
      expect(box.style.backgroundColor).toBe("transparent");

      const textElement = box.querySelector(
        '[data-slot="landing-box-text"]',
      ) as HTMLElement;
      const dotsElement = box.querySelector(
        '[data-slot="landing-skeleton-dots"]',
      ) as HTMLElement;
      const artworkImage = box.querySelector(
        '[data-slot="landing-artwork"]',
      ) as HTMLElement;
      const video = box.querySelector(
        '[data-slot="landing-video"]',
      ) as HTMLElement;
      const dots = [
        ...box.querySelectorAll<HTMLElement>(
          '[data-slot="landing-skeleton-dot"]',
        ),
      ];

      expect(textElement.textContent).toBe("");
      expect(dots).toHaveLength(81);
      expect(dotsElement.style.opacity).toBe("0");
      expect(dotsElement.style.visibility).toBe("hidden");
      expect(artworkImage.style.opacity).toBe("1");
      expect(video.style.opacity).toBe("0");
    }
  });
});

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      addEventListener: vi.fn(),
      matches,
      removeEventListener: vi.fn(),
    }),
  );
}

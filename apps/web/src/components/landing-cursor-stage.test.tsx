/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
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

    expect(artworkImages.map((image) => image.getAttribute("src"))).toEqual([
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/neon-shark-collage.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/fox-windstorm.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/dandelion-kitten.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/detective-fox.png",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/ostrich-editorial.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/android-grief-3.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/prehistoric-family.jpg",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/art/loving-grace.png",
    ]);

    for (const artworkImage of artworkImages) {
      expect(artworkImage.getAttribute("src")).toMatch(/^https:\/\//);
    }

    expect(videos.map((video) => video.getAttribute("src"))).toEqual([
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/neon-shark-b721ced630f4.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/fox-windstorm-e8a0cd3fd4d1.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/dandelion-kitten-59fd87cda0d9.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/detective-fox.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/ostrich-editorial-dba8f9614fac.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/android-grief-ad3913a4d204.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/prehistoric-family-e1c9b1e3b8dd.mp4",
      "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos/loving-grace.mp4",
    ]);

    for (const video of videos) {
      expect(video.hasAttribute("controls")).toBe(false);
      expect(video.hasAttribute("loop")).toBe(true);
      expect(video.hasAttribute("playsinline")).toBe(true);
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

import { getExploreArtwork } from "@remora/app/explore";
import { dotFieldDots, mixDotFieldColor } from "@remora/app/generation";
import clsx from "clsx";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  createLifecycleStartOffsets,
  createPromptBoxScript,
  maxSquareHeight,
  resolveCursorFrame,
  scriptDurationMs,
  type CursorBox,
} from "../lib/landing-cursor-scene";

/**
 * The cursor SVGs share a 41x44 viewBox with the pointer tip at (4.7, 3.4).
 * Cursors are positioned by their tip so drawn boxes line up with where they
 * point, and the offset scales with the rendered width.
 */
const CURSOR_SVG = { tipX: 4.7, tipY: 3.4, width: 41 };
const CURSOR_WIDTH_PX = 24;
const CURSOR_TIP_OFFSET = {
  x: (CURSOR_SVG.tipX * CURSOR_WIDTH_PX) / CURSOR_SVG.width,
  y: (CURSOR_SVG.tipY * CURSOR_WIDTH_PX) / CURSOR_SVG.width,
};

/**
 * Caps the per-frame clock advance so the animation pauses while the tab is
 * hidden instead of skipping ahead on resume.
 */
const MAX_FRAME_DELTA_MS = 100;

/**
 * Pairs that do not share an edge in either responsive grid: two columns by
 * four rows below `sm`, or four columns by two rows from `sm` upward.
 */
const NON_ADJACENT_BEGINNING_PAIRS = [
  [0, 7],
  [1, 6],
  [2, 5],
  [3, 4],
] as const;

/**
 * Extra room beyond the measured prompt width so the last typed character
 * never touches the box edge.
 */
const BOX_TEXT_SLACK_PX = 8;

/** Used when the section cannot be measured, e.g. before layout. */
const FALLBACK_BOX_WIDTH = 0.35;
const FALLBACK_SQUARE_SIZE = { height: 0.4, width: 0.35 };

/**
 * Keep landing-page generations lighter than the in-app skeleton while never
 * outgrowing their section or the input box they morph from.
 */
const SKELETON_MAX_SIDE_PX = 136;
const SKELETON_MAX_SECTION_FRACTION = 0.52;

/** Mirrors the dot field skeleton's loadingCycleMs. */
const DOT_WAVE_CYCLE_MS = 2800;

const LANDING_VIDEO_BASE_URL =
  "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/landing/cursor-videos";

/** Breathing room kept between generations and the avoided element. */
const SAFE_ZONE_PADDING_PX = 24;

/**
 * Dots reveal outward from the box's top-right corner, where the cursor
 * starts dragging the skeleton square open. Each threshold is the normalized
 * distance from that corner; a dot is visible once the box's
 * skeletonProgress reaches it.
 */
const DOT_REVEAL_THRESHOLDS = (() => {
  const distances = dotFieldDots.map((dot) => Math.hypot(1 - dot.x, dot.y));
  const maxDistance = Math.max(...distances);

  return distances.map((distance) => distance / maxDistance);
})();

type LandingGeneration = {
  imageUrl: string;
  imagePrompt: string;
  videoPrompt: string;
  videoUrl: string;
};

type LandingMouse = {
  cursorSrc: string;
  id: string;
  initialGenerationIndex: number;
  verticalPosition: number;
};

export type LandingCursorStageProps = {
  /**
   * An element the cursors must keep their generations clear of, e.g. the
   * centered wordmark. Rows it vertically overlaps confine every agent to
   * the taller free band above or below it.
   */
  avoidRef?: RefObject<HTMLElement | null>;
  className?: string;
};

/**
 * Each generation keeps its image prompt, artwork, animation prompt, and
 * resulting video together so a cursor can shuffle among complete stories.
 */
const LANDING_GENERATIONS: LandingGeneration[] = [
  {
    imageUrl: getExploreArtwork("neon-shark-collage").imageUrl,
    imagePrompt: "A shark collaged from neon surf magazine cutouts",
    videoPrompt: "Animate the cutouts so the shark swims off the page",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/neon-shark-b721ced630f4.mp4`,
  },
  {
    imageUrl: getExploreArtwork("fox-windstorm").imageUrl,
    imagePrompt: "A fox braced against a swirling windstorm",
    videoPrompt: "Set the leaves swirling as the fox leans into the gale",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/fox-windstorm-e8a0cd3fd4d1.mp4`,
  },
  {
    imageUrl: getExploreArtwork("dandelion-kitten").imageUrl,
    imagePrompt: "A kitten pouncing on a dandelion at golden hour",
    videoPrompt: "Play the pounce in slow motion as petals drift",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/dandelion-kitten-59fd87cda0d9.mp4`,
  },
  {
    imagePrompt: "A fox detective waiting in a dim backroom",
    imageUrl: getExploreArtwork("fox-noir-office").imageUrl,
    videoPrompt: "Push in as the fox studies the room",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/detective-fox.mp4`,
  },
  {
    imageUrl: getExploreArtwork("ostrich-editorial").imageUrl,
    imagePrompt: "A desert fashion editorial shot from ostrich-back",
    videoPrompt: "Dolly backward as the ostrich strides through the dunes",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/ostrich-editorial-dba8f9614fac.mp4`,
  },
  {
    imageUrl: getExploreArtwork("android-grief-3").imageUrl,
    imagePrompt: "An android curled up in an empty white void",
    videoPrompt: "Orbit the android slowly as the terminals flicker",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/android-grief-ad3913a4d204.mp4`,
  },
  {
    imageUrl: getExploreArtwork("prehistoric-family").imageUrl,
    imagePrompt: "A prehistoric family portrait, fashion cover style",
    videoPrompt: "Pan across the portrait as the baby dinosaur waves",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/prehistoric-family-e1c9b1e3b8dd.mp4`,
  },
  {
    imagePrompt: "A charcoal sketch of a writer beside her robot",
    imageUrl: getExploreArtwork("charcoal-robot-sketch").imageUrl,
    videoPrompt: "Let her keep writing as the robot waits beside her",
    videoUrl: `${LANDING_VIDEO_BASE_URL}/loving-grace.mp4`,
  },
];

const LANDING_MICE: LandingMouse[] = [
  {
    cursorSrc: "/mice/mouse-baby-blue.svg",
    id: "baby-blue",
    initialGenerationIndex: 0,
    verticalPosition: 0.75,
  },
  {
    cursorSrc: "/mice/mouse-red.svg",
    id: "red",
    initialGenerationIndex: 1,
    verticalPosition: 0.15,
  },
  {
    cursorSrc: "/mice/mouse-green.svg",
    id: "green",
    initialGenerationIndex: 2,
    verticalPosition: 0.9,
  },
  {
    cursorSrc: "/mice/mouse-pink.svg",
    id: "pink",
    initialGenerationIndex: 3,
    verticalPosition: 0.3,
  },
  {
    cursorSrc: "/mice/mouse-orange.svg",
    id: "orange",
    initialGenerationIndex: 4,
    verticalPosition: 0.2,
  },
  {
    cursorSrc: "/mice/mouse-purple.svg",
    id: "purple",
    initialGenerationIndex: 5,
    verticalPosition: 0.85,
  },
  {
    cursorSrc: "/mice/mouse-blue.svg",
    id: "blue",
    initialGenerationIndex: 6,
    verticalPosition: 0.08,
  },
  {
    cursorSrc: "/mice/mouse-yellow.svg",
    id: "yellow",
    initialGenerationIndex: 7,
    verticalPosition: 0.7,
  },
];

function getLandingGeneration(index: number): LandingGeneration {
  const generation = LANDING_GENERATIONS[index];

  if (!generation) {
    throw new Error("Landing mouse must reference an existing generation");
  }

  return generation;
}

function createGenerationOffsets(random: () => number): number[] {
  const remaining = LANDING_GENERATIONS.slice(1).map((_, index) => index + 1);

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = remaining[index];
    const replacement = remaining[swapIndex];

    if (current && replacement) {
      remaining[index] = replacement;
      remaining[swapIndex] = current;
    }
  }

  return [0, ...remaining];
}

type FrameApplier = (elapsedMs: number) => boolean;

type FrameRegistration = {
  apply: FrameApplier;
  durationMs: number;
};

type GenerationOrderResolver = (
  initialGenerationIndex: number,
) => LandingGeneration[];

type MediaClaimSetter = (cursorId: string, mediaUrl: string | null) => boolean;

function measurePromptBoxWidthPx(box: HTMLElement, text: string): number {
  const style = window.getComputedStyle(box);
  const paddingX =
    (Number.parseFloat(style.paddingLeft) || 0) +
    (Number.parseFloat(style.paddingRight) || 0);
  const context = document.createElement("canvas").getContext("2d");
  let textWidth: number;

  if (context) {
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    textWidth = context.measureText(text).width;
  } else {
    textWidth = text.length * (Number.parseFloat(style.fontSize) || 12) * 0.6;
  }

  return textWidth + paddingX + BOX_TEXT_SLACK_PX;
}

function measurePromptBoxHeightPx(box: HTMLElement): number | undefined {
  const style = window.getComputedStyle(box);
  const height = Number.parseFloat(
    style.getPropertyValue("--landing-prompt-box-height"),
  );

  return Number.isFinite(height) && height > 0 ? height : undefined;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The normalized vertical band of the section left free by the avoided
 * element: the taller of the strips above and below it, padded. Applying the
 * same band across the row keeps its agents consistently offset around the
 * wordmark.
 */
function measureFreeVerticalBounds(
  section: HTMLElement,
  avoidElement: HTMLElement,
): { max: number; min: number } {
  const sectionRect = section.getBoundingClientRect();
  const avoidRect = avoidElement.getBoundingClientRect();

  if (
    sectionRect.height <= 0 ||
    avoidRect.bottom + SAFE_ZONE_PADDING_PX <= sectionRect.top ||
    avoidRect.top - SAFE_ZONE_PADDING_PX >= sectionRect.bottom
  ) {
    return { max: 1, min: 0 };
  }

  const bandAboveMax = clamp01(
    (avoidRect.top - SAFE_ZONE_PADDING_PX - sectionRect.top) /
      sectionRect.height,
  );
  const bandBelowMin = clamp01(
    (avoidRect.bottom + SAFE_ZONE_PADDING_PX - sectionRect.top) /
      sectionRect.height,
  );

  return bandAboveMax >= 1 - bandBelowMin
    ? { max: bandAboveMax, min: 0 }
    : { max: 1, min: bandBelowMin };
}

export function LandingCursorStage({
  avoidRef,
  className,
}: LandingCursorStageProps) {
  const registrationsRef = useRef(new Map<string, FrameRegistration>());
  const generationOffsetsRef = useRef<number[] | null>(null);
  const mediaClaimByCursorRef = useRef(new Map<string, string>());
  const mediaClaimOwnerRef = useRef(new Map<string, string>());

  const getGenerationOrder = useCallback<GenerationOrderResolver>(
    (initialGenerationIndex) => {
      generationOffsetsRef.current ??= createGenerationOffsets(Math.random);

      return generationOffsetsRef.current.map((offset) =>
        getLandingGeneration(
          (initialGenerationIndex + offset) % LANDING_GENERATIONS.length,
        ),
      );
    },
    [],
  );

  const setMediaClaim = useCallback<MediaClaimSetter>((cursorId, mediaUrl) => {
    const previousMediaUrl = mediaClaimByCursorRef.current.get(cursorId);

    if (previousMediaUrl === mediaUrl) {
      return true;
    }

    if (previousMediaUrl) {
      mediaClaimByCursorRef.current.delete(cursorId);

      if (mediaClaimOwnerRef.current.get(previousMediaUrl) === cursorId) {
        mediaClaimOwnerRef.current.delete(previousMediaUrl);
      }
    }

    if (!mediaUrl) {
      return true;
    }

    const owner = mediaClaimOwnerRef.current.get(mediaUrl);

    if (owner && owner !== cursorId) {
      return false;
    }

    mediaClaimByCursorRef.current.set(cursorId, mediaUrl);
    mediaClaimOwnerRef.current.set(mediaUrl, cursorId);

    return true;
  }, []);

  const registerApplier = useCallback(
    (id: string, apply: FrameApplier, durationMs: number) => {
      registrationsRef.current.set(id, { apply, durationMs });

      return () => {
        registrationsRef.current.delete(id);
      };
    },
    [],
  );

  useEffect(() => {
    const registrations = registrationsRef.current;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (const { apply } of registrations.values()) {
        apply(Number.POSITIVE_INFINITY);
      }

      return;
    }

    const entries = [...registrations.entries()];
    const startOffsets = createLifecycleStartOffsets(
      entries.map(([, registration]) => registration.durationMs),
      NON_ADJACENT_BEGINNING_PAIRS,
      Math.random,
    );
    const startOffsetById = new Map(
      entries.map(([id], index) => [id, startOffsets[index] ?? 0]),
    );

    let animationFrameId = 0;
    let elapsedMs = 0;
    let lastTimestamp: number | null = null;

    const tick = (timestamp: number) => {
      if (lastTimestamp !== null) {
        elapsedMs += Math.min(timestamp - lastTimestamp, MAX_FRAME_DELTA_MS);
      }

      lastTimestamp = timestamp;

      let allDone = true;

      for (const [id, { apply }] of registrations) {
        if (!apply(elapsedMs + (startOffsetById.get(id) ?? 0))) {
          allDone = false;
        }
      }

      if (!allDone) {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none grid grid-cols-2 grid-rows-4 gap-y-3 sm:grid-cols-4 sm:grid-rows-2 sm:gap-y-20",
        className,
      )}
    >
      {LANDING_MICE.map((mouse) => (
        <CursorSection
          avoidRef={avoidRef}
          getGenerationOrder={getGenerationOrder}
          key={mouse.id}
          mouse={mouse}
          registerApplier={registerApplier}
          setMediaClaim={setMediaClaim}
        />
      ))}
    </div>
  );
}

function CursorSection({
  avoidRef,
  getGenerationOrder,
  mouse,
  registerApplier,
  setMediaClaim,
}: {
  avoidRef?: RefObject<HTMLElement | null>;
  getGenerationOrder: GenerationOrderResolver;
  mouse: LandingMouse;
  registerApplier: (
    id: string,
    applier: FrameApplier,
    durationMs: number,
  ) => () => void;
  setMediaClaim: MediaClaimSetter;
}) {
  const initialGeneration = getLandingGeneration(mouse.initialGenerationIndex);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const cursorImageRef = useRef<HTMLImageElement | null>(null);
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const textRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const dotsRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const artworkImageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastElapsedRef = useRef(0);
  const sizeRef = useRef({ height: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const measureElement = boxRefs.current[0];
    const generations = getGenerationOrder(mouse.initialGenerationIndex);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    sizeRef.current = {
      height: container?.clientHeight ?? 0,
      width: container?.clientWidth ?? 0,
    };

    const { height: sectionHeight, width: sectionWidth } = sizeRef.current;
    const hasSize = sectionWidth > 0 && sectionHeight > 0;
    const promptPairs = generations.map((generation) => ({
      image: {
        boxWidth:
          measureElement && hasSize
            ? measurePromptBoxWidthPx(measureElement, generation.imagePrompt) /
              sectionWidth
            : FALLBACK_BOX_WIDTH,
        prompt: generation.imagePrompt,
      },
      video: {
        boxWidth:
          measureElement && hasSize
            ? measurePromptBoxWidthPx(measureElement, generation.videoPrompt) /
              sectionWidth
            : FALLBACK_BOX_WIDTH,
        prompt: generation.videoPrompt,
      },
    }));
    const firstPromptPair = promptPairs[0];
    const firstImageBoxWidthPx = firstPromptPair
      ? firstPromptPair.image.boxWidth * sectionWidth
      : 0;
    const promptBoxHeightPx = measureElement
      ? measurePromptBoxHeightPx(measureElement)
      : undefined;
    const promptBoxHeight =
      promptBoxHeightPx && hasSize
        ? promptBoxHeightPx / sectionHeight
        : undefined;
    const avoidElement = avoidRef?.current;
    const verticalBounds =
      container && avoidElement && hasSize
        ? measureFreeVerticalBounds(container, avoidElement)
        : { max: 1, min: 0 };
    const squareSidePx = Math.min(
      SKELETON_MAX_SIDE_PX,
      SKELETON_MAX_SECTION_FRACTION * Math.min(sectionWidth, sectionHeight),
      firstImageBoxWidthPx,
      Math.max(
        0,
        maxSquareHeight(
          verticalBounds.max - verticalBounds.min,
          promptBoxHeight,
        ) * sectionHeight,
      ),
    );

    if (!firstPromptPair) {
      return;
    }

    const script = createPromptBoxScript(Math.random, {
      alternates: promptPairs.slice(1),
      boxHeight: promptBoxHeight,
      image: firstPromptPair.image,
      squareSize: hasSize
        ? {
            height: squareSidePx / sectionHeight,
            width: squareSidePx / sectionWidth,
          }
        : FALLBACK_SQUARE_SIZE,
      verticalBounds,
      verticalPosition: mouse.verticalPosition,
      video: firstPromptPair.video,
    });

    const applyBoxFrame = (
      box: HTMLDivElement,
      textElement: HTMLSpanElement | null,
      boxState: CursorBox,
      sectionSize: { height: number; width: number },
    ) => {
      const { rect } = boxState;

      box.style.backgroundColor =
        boxState.skeletonProgress > 0 ? "transparent" : "";
      box.style.height = `${rect.height * sectionSize.height}px`;
      box.style.transform = `translate3d(${rect.x * sectionSize.width}px, ${rect.y * sectionSize.height}px, 0)`;
      box.style.visibility = "visible";
      box.style.width = `${rect.width * sectionSize.width}px`;

      if (textElement && textElement.textContent !== boxState.text) {
        textElement.textContent = boxState.text;
      }
    };

    const applyFrame: FrameApplier = (elapsedMs) => {
      lastElapsedRef.current = elapsedMs;

      const sectionSize = sizeRef.current;
      const frame = resolveCursorFrame(script, elapsedMs);
      const cursorImage = cursorImageRef.current;

      if (cursorImage) {
        cursorImage.style.opacity = frame.cursorHidden ? "0" : "1";
        cursorImage.style.transform = `translate3d(${frame.position.x * sectionSize.width - CURSOR_TIP_OFFSET.x}px, ${frame.position.y * sectionSize.height - CURSOR_TIP_OFFSET.y}px, 0)`;
      }

      boxRefs.current.forEach((box, boxIndex) => {
        if (!box) {
          return;
        }

        const boxState = frame.boxes[boxIndex];

        if (!boxState) {
          box.style.visibility = "hidden";
          return;
        }

        applyBoxFrame(
          box,
          textRefs.current[boxIndex] ?? null,
          boxState,
          sectionSize,
        );
      });

      const mediaBox = frame.boxes[0];

      if (!mediaBox) {
        setMediaClaim(mouse.id, null);
        return frame.done;
      }

      // The media square alternates forever: even reveals are the image,
      // odd reveals are the video.
      const videoShowing = mediaBox.mediaIndex % 2 === 1;
      const generationIndex =
        Math.floor(mediaBox.mediaIndex / 2) % generations.length;
      const generation = generations[generationIndex];
      const artworkUrl = generation?.imageUrl ?? null;
      const mediaUrl = generation
        ? videoShowing
          ? generation.videoUrl
          : artworkUrl
        : null;
      let mediaClaimed = false;

      if (mediaBox.mediaProgress > 0 && mediaUrl) {
        mediaClaimed = setMediaClaim(mouse.id, mediaUrl);
      } else {
        setMediaClaim(mouse.id, null);
      }

      dotRefs.current.forEach((dotElement, index) => {
        if (!dotElement) {
          return;
        }

        const revealThreshold = DOT_REVEAL_THRESHOLDS[index] ?? 1;

        dotElement.style.visibility =
          mediaBox.skeletonProgress > 0 &&
          revealThreshold <= mediaBox.skeletonProgress
            ? "visible"
            : "hidden";
      });

      const dotsElement = dotsRef.current;

      if (dotsElement) {
        dotsElement.style.opacity = mediaClaimed
          ? `${1 - mediaBox.mediaProgress}`
          : "1";
        dotsElement.style.visibility =
          mediaClaimed && mediaBox.mediaProgress >= 1 ? "hidden" : "visible";
      }

      const artworkImage = artworkImageRef.current;

      if (artworkImage && artworkUrl) {
        if (artworkImage.getAttribute("src") !== artworkUrl) {
          artworkImage.setAttribute("src", artworkUrl);
        }

        artworkImage.style.opacity =
          mediaClaimed && !videoShowing ? `${mediaBox.mediaProgress}` : "0";
      }

      const video = videoRef.current;

      if (video && generation) {
        if (video.getAttribute("src") !== generation.videoUrl) {
          video.setAttribute("src", generation.videoUrl);
        }

        video.style.opacity =
          mediaClaimed && videoShowing ? `${mediaBox.mediaProgress}` : "0";

        try {
          if (mediaClaimed && videoShowing && video.paused && !reducedMotion) {
            void video.play()?.catch(() => undefined);
          } else if ((!mediaClaimed || !videoShowing) && !video.paused) {
            video.pause();
          }
        } catch {
          // Some environments (jsdom) do not implement video playback.
        }
      }

      return frame.done;
    };

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) {
        return;
      }

      sizeRef.current = {
        height: entry.contentRect.height,
        width: entry.contentRect.width,
      };
      applyFrame(lastElapsedRef.current);
    });

    if (container) {
      resizeObserver.observe(container);
    }

    const unregister = registerApplier(
      mouse.id,
      applyFrame,
      scriptDurationMs(script),
    );

    return () => {
      resizeObserver.disconnect();
      setMediaClaim(mouse.id, null);
      unregister();
    };
  }, [avoidRef, getGenerationOrder, mouse, registerApplier, setMediaClaim]);

  return (
    <div className="relative overflow-hidden" ref={containerRef}>
      <div
        className="bg-surface-strong text-muted-foreground absolute top-0 left-0 flex items-center overflow-hidden rounded-sm px-2 text-xs whitespace-nowrap transition-colors duration-300"
        data-slot="landing-media-box"
        ref={(element) => {
          boxRefs.current[0] = element;
        }}
        style={{ visibility: "hidden" }}
      >
        <span
          data-slot="landing-box-text"
          ref={(element) => {
            textRefs.current[0] = element;
          }}
        />
        <div
          className="absolute inset-0"
          data-slot="landing-skeleton-dots"
          ref={dotsRef}
        >
          {dotFieldDots.map((dot, index) => (
            <span
              className="pointer-events-none absolute size-1 rounded-full motion-safe:animate-[landing-dot-wave_2800ms_linear_infinite]"
              data-slot="landing-skeleton-dot"
              key={dot.id}
              ref={(element) => {
                dotRefs.current[index] = element;
              }}
              style={{
                animationDelay: `${(dot.diagonal - 1) * DOT_WAVE_CYCLE_MS}ms`,
                backgroundColor: mixDotFieldColor(0),
                left: `${dot.x * 100}%`,
                top: `${dot.y * 100}%`,
                transform: "translate(-50%, -50%)",
                visibility: "hidden",
              }}
            />
          ))}
        </div>
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-0"
          data-slot="landing-artwork"
          draggable={false}
          ref={artworkImageRef}
          src={initialGeneration.imageUrl}
        />
        <video
          className="absolute inset-0 h-full w-full object-cover opacity-0"
          data-slot="landing-video"
          loop
          muted
          playsInline
          preload="auto"
          ref={videoRef}
          src={initialGeneration.videoUrl}
        />
      </div>
      <div
        className="bg-surface-strong text-muted-foreground absolute top-0 left-0 flex items-center overflow-hidden rounded-sm px-2 text-xs whitespace-nowrap"
        data-slot="landing-video-prompt-box"
        ref={(element) => {
          boxRefs.current[1] = element;
        }}
        style={{ visibility: "hidden" }}
      >
        <span
          data-slot="landing-box-text"
          ref={(element) => {
            textRefs.current[1] = element;
          }}
        />
      </div>
      <img
        alt=""
        className="absolute top-0 left-0 w-6 max-w-none opacity-0 transition-opacity duration-200 select-none"
        data-slot="landing-cursor"
        draggable={false}
        ref={cursorImageRef}
        src={mouse.cursorSrc}
      />
    </div>
  );
}

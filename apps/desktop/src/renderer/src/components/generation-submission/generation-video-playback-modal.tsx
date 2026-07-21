import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { useHotkey } from "../../providers/hotkeys-provider.tsx";

const videoPlaybackTransitionMs = 320;
const videoPlaybackTransitionTiming = "cubic-bezier(0.22,1,0.36,1)";
const remoraTitlebarHeightFallback = 44;

const videoPlaybackModalStyle = {
  outline: "none",
  top: "var(--remora-titlebar-height)",
} satisfies CSSProperties;

export type PlaybackRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type PlaybackViewportFrame = ViewportSize & {
  top: number;
};

export type GenerationVideoPlayback = {
  aspectRatio: number;
  originRect: PlaybackRect;
  previewImageUrl: string;
  videoUrl: string;
};

type GenerationVideoPlaybackPhase = "opening" | "open" | "closing";

export function GenerationVideoPlaybackModal({
  onCloseStart,
  playback,
  onClosed,
}: {
  onCloseStart: () => void;
  playback: GenerationVideoPlayback;
  onClosed: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const isCloseStartedRef = useRef(false);
  const isCloseCompleteRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const viewportFrame = usePlaybackViewportFrame();
  const [phase, setPhase] = useState<GenerationVideoPlaybackPhase>("opening");
  const [isVideoVisible, setIsVideoVisible] = useState(false);
  const finalRect = getContainedVideoRect(playback.aspectRatio, viewportFrame);
  const backdropStyle = getPlaybackBackdropStyle({
    phase,
    prefersReducedMotion,
  });
  const surfaceStyle = getPlaybackSurfaceStyle({
    finalRect,
    originRect: playback.originRect,
    phase,
    prefersReducedMotion,
  });

  const startClose = useCallback(() => {
    if (isCloseStartedRef.current) {
      return;
    }

    isCloseStartedRef.current = true;
    onCloseStart();
  }, [onCloseStart]);

  const completeClose = useCallback(() => {
    if (isCloseCompleteRef.current) {
      return;
    }

    isCloseCompleteRef.current = true;
    onClosed();
  }, [onClosed]);

  const requestClose = useCallback(() => {
    if (phase === "closing") {
      return;
    }

    setIsVideoVisible(false);
    startClose();

    if (prefersReducedMotion) {
      completeClose();
      return;
    }

    setPhase("closing");
  }, [completeClose, phase, prefersReducedMotion, startClose]);

  useHotkey("generation.closeMediaViewer", {
    allowInEditable: true,
    enabled: phase !== "closing",
    onKeyDown: requestClose,
  });

  useLayoutEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    if (prefersReducedMotion) {
      setPhase("open");
      setIsVideoVisible(true);
      return;
    }

    const animationFrameId = requestNextAnimationFrame(() => {
      setPhase("open");
    });

    return () => cancelNextAnimationFrame(animationFrameId);
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (phase !== "open" || isVideoVisible) {
      return;
    }

    if (prefersReducedMotion) {
      setIsVideoVisible(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsVideoVisible(true);
    }, videoPlaybackTransitionMs);

    return () => window.clearTimeout(timeoutId);
  }, [isVideoVisible, phase, prefersReducedMotion]);

  useEffect(() => {
    if (phase !== "closing" || prefersReducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(
      completeClose,
      videoPlaybackTransitionMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [completeClose, phase, prefersReducedMotion]);

  return createPortal(
    <div
      ref={dialogRef}
      aria-label="Generated video playback"
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 z-50 overflow-hidden"
      data-slot="generation-video-playback-modal"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
      role="dialog"
      style={videoPlaybackModalStyle}
      tabIndex={-1}
    >
      <div
        aria-hidden="true"
        data-slot="generation-video-playback-backdrop"
        onClick={requestClose}
        style={backdropStyle}
      />
      <div
        data-slot="generation-video-playback-surface"
        onTransitionEnd={(event) => {
          if (event.target !== event.currentTarget) {
            return;
          }

          if (event.propertyName && event.propertyName !== "transform") {
            return;
          }

          if (phase === "open") {
            setIsVideoVisible(true);
            return;
          }

          if (phase === "closing") {
            completeClose();
          }
        }}
        style={surfaceStyle}
      >
        {isVideoVisible ? (
          <video
            className="size-full object-contain"
            controls
            data-slot="generation-video-playback-video"
            data-testid="generation-video-playback-video"
            playsInline
            preload="metadata"
            src={playback.videoUrl}
          />
        ) : (
          <img
            alt=""
            aria-hidden="true"
            className="size-full object-cover"
            data-slot="generation-video-playback-preview"
            src={playback.previewImageUrl}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}

function getPlaybackSurfaceStyle({
  finalRect,
  originRect,
  phase,
  prefersReducedMotion,
}: {
  finalRect: PlaybackRect;
  originRect: PlaybackRect;
  phase: GenerationVideoPlaybackPhase;
  prefersReducedMotion: boolean;
}): CSSProperties {
  const shouldUseOriginTransform = !prefersReducedMotion && phase !== "open";

  return {
    height: finalRect.height,
    left: finalRect.left,
    overflow: "hidden",
    position: "fixed",
    top: finalRect.top,
    transform: shouldUseOriginTransform
      ? getOriginTransform(originRect, finalRect)
      : "translate3d(0, 0, 0) scale(1)",
    transformOrigin: "top left",
    transition: prefersReducedMotion
      ? undefined
      : `transform ${videoPlaybackTransitionMs}ms ${videoPlaybackTransitionTiming}`,
    width: finalRect.width,
    willChange: prefersReducedMotion ? undefined : "transform",
    zIndex: 1,
  };
}

function getPlaybackBackdropStyle({
  phase,
  prefersReducedMotion,
}: {
  phase: GenerationVideoPlaybackPhase;
  prefersReducedMotion: boolean;
}): CSSProperties {
  return {
    background: "var(--remora-stage-background)",
    inset: 0,
    opacity: phase === "open" ? 1 : 0,
    position: "absolute",
    transition: prefersReducedMotion
      ? undefined
      : `opacity ${videoPlaybackTransitionMs}ms ${videoPlaybackTransitionTiming}`,
    willChange: prefersReducedMotion ? undefined : "opacity",
  };
}

function getOriginTransform(originRect: PlaybackRect, finalRect: PlaybackRect) {
  const scaleX = originRect.width / Math.max(finalRect.width, 1);
  const scaleY = originRect.height / Math.max(finalRect.height, 1);
  const translateX = originRect.left - finalRect.left;
  const translateY = originRect.top - finalRect.top;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
}

function getContainedVideoRect(
  aspectRatio: number,
  viewportFrame: PlaybackViewportFrame,
): PlaybackRect {
  const safeAspectRatio =
    Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : 16 / 9;
  const viewportWidth = Math.max(viewportFrame.width, 1);
  const viewportHeight = Math.max(viewportFrame.height, 1);
  let width = viewportWidth;
  let height = width / safeAspectRatio;

  if (height > viewportHeight) {
    height = viewportHeight;
    width = height * safeAspectRatio;
  }

  return {
    height,
    left: (viewportWidth - width) / 2,
    top: viewportFrame.top + (viewportHeight - height) / 2,
    width,
  };
}

function usePlaybackViewportFrame() {
  const [viewportFrame, setViewportFrame] = useState<PlaybackViewportFrame>(
    () => getPlaybackViewportFrame(),
  );

  useEffect(() => {
    function syncViewportFrame() {
      setViewportFrame(getPlaybackViewportFrame());
    }

    window.addEventListener("resize", syncViewportFrame);

    return () => window.removeEventListener("resize", syncViewportFrame);
  }, []);

  return viewportFrame;
}

function getPlaybackViewportFrame(): PlaybackViewportFrame {
  const titlebarHeight = getTitlebarHeight();

  return {
    height: Math.max(window.innerHeight - titlebarHeight, 1),
    top: titlebarHeight,
    width: window.innerWidth,
  };
}

function getTitlebarHeight() {
  const titlebarHeight = document
    .querySelector<HTMLElement>(".remora-desktop-titlebar")
    ?.getBoundingClientRect().height;

  if (isPositiveFiniteNumber(titlebarHeight)) {
    return titlebarHeight;
  }

  const configuredTitlebarHeight = parseCssPixelValue(
    window
      .getComputedStyle(document.documentElement)
      .getPropertyValue("--remora-titlebar-height"),
  );

  if (isNonNegativeFiniteNumber(configuredTitlebarHeight)) {
    return configuredTitlebarHeight;
  }

  return remoraTitlebarHeightFallback;
}

function parseCssPixelValue(value: string) {
  const directValue = Number.parseFloat(value);

  if (Number.isFinite(directValue)) {
    return directValue;
  }

  return Number.parseFloat(value.match(/,\s*([0-9.]+)px\)/)?.[1] ?? "");
}

function isNonNegativeFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveFiniteNumber(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    getPrefersReducedMotion(),
  );

  useEffect(() => {
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    if (!motionQuery) {
      return;
    }

    function syncReducedMotion() {
      setPrefersReducedMotion(motionQuery?.matches ?? false);
    }

    syncReducedMotion();
    motionQuery.addEventListener("change", syncReducedMotion);

    return () => motionQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  return prefersReducedMotion;
}

function getPrefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function requestNextAnimationFrame(callback: FrameRequestCallback) {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(window.performance.now()), 16);
}

function cancelNextAnimationFrame(animationFrameId: number) {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(animationFrameId);
    return;
  }

  window.clearTimeout(animationFrameId);
}

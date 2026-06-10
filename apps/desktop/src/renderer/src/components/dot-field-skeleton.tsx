import {
  useEffect,
  useRef,
  type ComponentPropsWithoutRef,
  type PointerEvent,
} from "react";

const gridSize = 8;
const gridInset = 0.15;
const gridStep = (1 - gridInset * 2) / (gridSize - 1);
const fallbackBoundsPx = 100;
const loadingCycleMs = 2800;
const loadingWaveWidth = 0.32;
const dotBaseRgb = [118, 118, 118] as const;
const dotLoadingRgb = [255, 255, 255] as const;

type DotSpec = {
  id: string;
  diagonal: number;
  x: number;
  y: number;
  phase: number;
  speed: number;
};

const dots: DotSpec[] = Array.from(
  { length: gridSize * gridSize },
  (_, index) => {
    const row = Math.floor(index / gridSize);
    const column = index % gridSize;

    return {
      id: `${row}-${column}`,
      diagonal: (row + column) / ((gridSize - 1) * 2),
      x: gridInset + column * gridStep,
      y: gridInset + row * gridStep,
      phase: index * 0.71,
      speed: 0.00048 + ((row + column) % 4) * 0.00005,
    };
  },
);

function getLoadingWaveIntensity(time: number, diagonal: number) {
  const sweepPosition =
    ((time % loadingCycleMs) / loadingCycleMs) * (1 + loadingWaveWidth * 2) -
    loadingWaveWidth;
  const distance = Math.abs(diagonal - sweepPosition);
  const intensity = Math.max(0, 1 - distance / loadingWaveWidth);

  return intensity * intensity;
}

function mixDotColor(intensity: number) {
  const colorIntensity = Math.min(intensity, 1);
  const [baseRed, baseGreen, baseBlue] = dotBaseRgb;
  const [loadingRed, loadingGreen, loadingBlue] = dotLoadingRgb;
  const red = Math.round(baseRed + (loadingRed - baseRed) * colorIntensity);
  const green = Math.round(
    baseGreen + (loadingGreen - baseGreen) * colorIntensity,
  );
  const blue = Math.round(baseBlue + (loadingBlue - baseBlue) * colorIntensity);

  return `rgb(${red}, ${green}, ${blue})`;
}

type PointerState = {
  active: boolean;
  pressed: boolean;
  x: number;
  y: number;
};

function DotFieldSkeleton({
  className,
  "aria-label": ariaLabel = "Generating",
  onPointerCancel,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dotRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pointerRef = useRef<PointerState>({
    active: false,
    pressed: false,
    x: 0,
    y: 0,
  });
  const hoveredRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const animationFrameRef = useRef<number | null>(null);
  const startAnimationRef = useRef(() => {});

  useEffect(() => {
    const motionQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    function syncReducedMotion() {
      reducedMotionRef.current = Boolean(motionQuery?.matches);
      startAnimationRef.current();
    }

    syncReducedMotion();
    motionQuery?.addEventListener("change", syncReducedMotion);

    return () => {
      motionQuery?.removeEventListener("change", syncReducedMotion);
    };
  }, []);

  useEffect(() => {
    function stopAnimation() {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }

    function draw(time: number) {
      animationFrameRef.current = null;

      const root = rootRef.current;

      if (!root) {
        return;
      }

      const bounds = root.getBoundingClientRect();
      const width = bounds.width || fallbackBoundsPx;
      const height = bounds.height || fallbackBoundsPx;
      const size = Math.min(width, height);
      const pointer = pointerRef.current;
      const isReducedMotion = reducedMotionRef.current;
      const driftScale = pointer.active && !isReducedMotion ? 1 : 0;
      const reactionRadius = size * (pointer.pressed ? 0.72 : 0.5);
      const reactionStrength =
        size * (pointer.pressed ? 0.18 : 0.095) * (isReducedMotion ? 0.65 : 1);

      dots.forEach((dot, index) => {
        const element = dotRefs.current[index];

        if (!element) {
          return;
        }

        const driftX =
          (Math.sin(time * dot.speed + dot.phase) * 2.6 +
            Math.sin(time * dot.speed * 0.53 + dot.phase * 1.7) * 1.1) *
          driftScale;
        const driftY =
          (Math.cos(time * dot.speed * 0.86 + dot.phase) * 2.2 +
            Math.sin(time * dot.speed * 0.41 + dot.phase * 0.8) * 0.9) *
          driftScale;
        let reactionX = 0;
        let reactionY = 0;

        if (pointer.active) {
          const dotX = dot.x * width + driftX;
          const dotY = dot.y * height + driftY;
          const deltaX = dotX - pointer.x;
          const deltaY = dotY - pointer.y;
          const distance = Math.max(Math.hypot(deltaX, deltaY), 0.001);

          if (distance < reactionRadius) {
            const falloff = (1 - distance / reactionRadius) ** 2;
            reactionX = (deltaX / distance) * reactionStrength * falloff;
            reactionY = (deltaY / distance) * reactionStrength * falloff;
          }
        }

        const offsetX = driftX + reactionX;
        const offsetY = driftY + reactionY;
        const loadingWave = isReducedMotion
          ? 0
          : getLoadingWaveIntensity(time, dot.diagonal);

        element.style.transform = `translate(calc(-50% + ${offsetX.toFixed(
          3,
        )}px), calc(-50% + ${offsetY.toFixed(3)}px))`;
        element.style.backgroundColor = mixDotColor(loadingWave);
      });

      if (!isReducedMotion) {
        animationFrameRef.current = requestAnimationFrame(draw);
      } else {
        animationFrameRef.current = null;
      }
    }

    function startAnimation() {
      if (animationFrameRef.current === null) {
        animationFrameRef.current = requestAnimationFrame(draw);
      }
    }

    startAnimationRef.current = startAnimation;
    startAnimation();

    return () => {
      startAnimationRef.current = () => {};
      stopAnimation();
    };
  }, []);

  useEffect(() => {
    function handlePointerEnd() {
      pointerRef.current.pressed = false;

      if (!hoveredRef.current) {
        pointerRef.current.active = false;
      }

      startAnimationRef.current();
    }

    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, []);

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();

    hoveredRef.current = true;
    pointerRef.current.active = true;
    pointerRef.current.pressed = event.buttons > 0;
    pointerRef.current.x = event.clientX - bounds.left;
    pointerRef.current.y = event.clientY - bounds.top;
    startAnimationRef.current();
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    updatePointer(event);
    pointerRef.current.pressed = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    hoveredRef.current = false;

    if (event.buttons > 0) {
      pointerRef.current.pressed = true;
    } else {
      pointerRef.current.active = false;
      pointerRef.current.pressed = false;
    }

    startAnimationRef.current();
  }

  function handlePointerEnd(event: PointerEvent<HTMLDivElement>) {
    pointerRef.current.pressed = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    startAnimationRef.current();
  }

  return (
    <div
      {...props}
      ref={rootRef}
      role="status"
      aria-label={ariaLabel}
      data-slot="dot-field-skeleton"
      className={[
        "relative h-40 w-40 touch-none overflow-hidden select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onPointerEnter={(event) => {
        updatePointer(event);
        onPointerEnter?.(event);
      }}
      onPointerMove={(event) => {
        updatePointer(event);
        onPointerMove?.(event);
      }}
      onPointerDown={(event) => {
        handlePointerDown(event);
        onPointerDown?.(event);
      }}
      onPointerUp={(event) => {
        handlePointerEnd(event);
        onPointerUp?.(event);
      }}
      onPointerCancel={(event) => {
        handlePointerEnd(event);
        onPointerCancel?.(event);
      }}
      onPointerLeave={(event) => {
        handlePointerLeave(event);
        onPointerLeave?.(event);
      }}
    >
      {dots.map((dot, index) => (
        <span
          key={dot.id}
          ref={(element) => {
            dotRefs.current[index] = element;
          }}
          aria-hidden="true"
          data-slot="dot-field-skeleton-dot"
          className="pointer-events-none absolute size-1 rounded-full will-change-transform"
          style={{
            backgroundColor: mixDotColor(0),
            left: `${dot.x * 100}%`,
            top: `${dot.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}

export { DotFieldSkeleton };

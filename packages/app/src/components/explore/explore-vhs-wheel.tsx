import {
  motion,
  useMotionValueEvent,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import exploreVhsCassetteUrl from "../../assets/explore-vhs-cassette.webp";

const exploreVhsTapeCount = 10;
const exploreVhsTapeStepDegrees = 360 / exploreVhsTapeCount;
type ExploreVhsWheelProps = {
  focusedTapeIndex: number;
  onSelectTape: (tapeIndex: number) => void;
  rotation: MotionValue<number>;
  targetRotation: number;
};

function getExploreVhsWheelRotation(step: number) {
  return step * exploreVhsTapeStepDegrees;
}

function getExploreVhsFocusedTapeIndex(step: number) {
  return (
    ((-step % exploreVhsTapeCount) + exploreVhsTapeCount) % exploreVhsTapeCount
  );
}

function ExploreVhsWheel({
  focusedTapeIndex,
  onSelectTape,
  rotation,
  targetRotation,
}: ExploreVhsWheelProps) {
  const [cassetteUrl, setCassetteUrl] = useState<string | null>(null);
  const wheelRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(rotation, "change", (latestRotation) => {
    wheelRef.current?.setAttribute("data-rotation", String(latestRotation));
  });

  // The shared package resolves assets differently during web SSR and in the
  // browser. Applying the URL after hydration keeps both initial trees stable.
  useEffect(() => {
    setCassetteUrl(exploreVhsCassetteUrl);
  }, []);

  return (
    <motion.div
      className="pointer-events-none absolute top-1/2 left-0 size-0 origin-center will-change-transform select-none"
      data-focused-tape-index={focusedTapeIndex}
      data-rotation={rotation.get()}
      data-slot="explore-vhs-wheel"
      data-target-rotation={targetRotation}
      ref={wheelRef}
      style={{ rotate: rotation }}
    >
      {Array.from({ length: exploreVhsTapeCount }, (_, index) => {
        const angle = index * exploreVhsTapeStepDegrees;

        return (
          <div
            className="absolute top-0 left-0 size-0"
            data-angle={angle}
            data-focused={index === focusedTapeIndex ? "true" : undefined}
            data-slot="explore-vhs-tape"
            key={index}
            style={{
              transform: `rotate(${angle}deg) translateX(var(--explore-vhs-wheel-radius))`,
            }}
          >
            <button
              aria-current={index === focusedTapeIndex ? "true" : undefined}
              aria-label={`Center VHS tape ${index + 1}`}
              className="focus-visible:ring-ring pointer-events-auto inline-flex -translate-x-1/2 -translate-y-1/2 -rotate-90 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-2"
              onClick={() => onSelectTape(index)}
              type="button"
            >
              <img
                alt=""
                className="h-[var(--explore-vhs-tape-height)] max-w-none"
                decoding="async"
                draggable={false}
                src={cassetteUrl ?? undefined}
              />
            </button>
          </div>
        );
      })}
    </motion.div>
  );
}

export {
  ExploreVhsWheel,
  exploreVhsTapeCount,
  exploreVhsTapeStepDegrees,
  getExploreVhsFocusedTapeIndex,
  getExploreVhsWheelRotation,
  type ExploreVhsWheelProps,
};

import { ArrowLeftIcon } from "lucide-react";
import { useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";

import { type CreativeCategory } from "./creative-category.ts";
import {
  ExploreVhsWheel,
  exploreVhsTapeCount,
  getExploreVhsFocusedTapeIndex,
  getExploreVhsWheelRotation,
} from "./explore-vhs-wheel.tsx";

const exploreViewportHeight =
  "calc(100dvh - var(--remora-titlebar-height, 0px))";
const exploreVhsWheelStepDistancePx = 192;
const exploreVhsWheelSnapPointCount = 201;
const exploreVhsWheelCenterSnapPoint = Math.floor(
  exploreVhsWheelSnapPointCount / 2,
);
const exploreVhsWheelCenterScrollTop =
  exploreVhsWheelCenterSnapPoint * exploreVhsWheelStepDistancePx;
const exploreVhsWheelScrollTrackHeight =
  (exploreVhsWheelSnapPointCount - 1) * exploreVhsWheelStepDistancePx;

type ExplorePageProps = {
  category?: CreativeCategory;
  onBack: () => void;
  onSelectCategory: (category: CreativeCategory) => void;
  onStartCreating: () => void;
};

function ExplorePage({ onBack }: ExplorePageProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const wheelRotation = useMotionValue(0);
  const wheelTargetStepRef = useRef(0);
  const [wheelTargetStep, setWheelTargetStep] = useState(0);

  function centerTape(tapeIndex: number) {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer || prefersReducedMotion) {
      return;
    }

    const targetStep = getExploreVhsSelectedTapeStep(
      wheelRotation.get(),
      tapeIndex,
    );
    const relativeTargetStep = targetStep - wheelTargetStepRef.current;

    if (
      relativeTargetStep === 0 &&
      scrollContainer.scrollTop === exploreVhsWheelCenterScrollTop
    ) {
      return;
    }

    scrollContainer.scrollTo({
      behavior: "smooth",
      top:
        exploreVhsWheelCenterScrollTop +
        relativeTargetStep * exploreVhsWheelStepDistancePx,
    });
  }

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = exploreVhsWheelCenterScrollTop;
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = exploreVhsWheelCenterScrollTop;

    if (prefersReducedMotion) {
      wheelRotation.set(0);
      wheelTargetStepRef.current = 0;
      setWheelTargetStep(0);
      return;
    }

    let gestureDirection = 0;
    let maximumGestureDisplacement = 0;
    let isRecentering = false;

    function handleScroll() {
      const displacement =
        scrollContainer!.scrollTop - exploreVhsWheelCenterScrollTop;

      if (!isRecentering && Math.abs(displacement) > 0.5) {
        gestureDirection = Math.sign(displacement);
        maximumGestureDisplacement = Math.max(
          maximumGestureDisplacement,
          Math.abs(displacement),
        );
      }

      wheelRotation.set(
        getExploreVhsWheelRotation(
          wheelTargetStepRef.current +
            displacement / exploreVhsWheelStepDistancePx,
        ),
      );
    }

    function handleScrollEnd() {
      if (isRecentering) {
        return;
      }

      const displacement =
        scrollContainer!.scrollTop - exploreVhsWheelCenterScrollTop;
      const nearestStep =
        Math.sign(displacement) *
        Math.round(Math.abs(displacement) / exploreVhsWheelStepDistancePx);

      if (
        nearestStep === 0 &&
        gestureDirection !== 0 &&
        maximumGestureDisplacement > 0.5
      ) {
        scrollContainer!.scrollTo({
          behavior: "smooth",
          top:
            exploreVhsWheelCenterScrollTop +
            gestureDirection * exploreVhsWheelStepDistancePx,
        });
        return;
      }

      const targetStep = wheelTargetStepRef.current + nearestStep;

      wheelTargetStepRef.current = targetStep;
      setWheelTargetStep(targetStep);
      wheelRotation.set(getExploreVhsWheelRotation(targetStep));

      gestureDirection = 0;
      maximumGestureDisplacement = 0;
      isRecentering = true;
      scrollContainer!.scrollTop = exploreVhsWheelCenterScrollTop;
      window.requestAnimationFrame(() => {
        isRecentering = false;
      });
    }

    scrollContainer.addEventListener("scroll", handleScroll, { passive: true });
    scrollContainer.addEventListener("scrollend", handleScrollEnd);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      scrollContainer.removeEventListener("scrollend", handleScrollEnd);
    };
  }, [prefersReducedMotion, wheelRotation]);

  const focusedTapeIndex = getExploreVhsFocusedTapeIndex(wheelTargetStep);

  return (
    <main
      className="text-foreground bg-background relative min-h-0 [scroll-snap-type:y_mandatory] [scrollbar-width:none] overflow-x-hidden overflow-y-scroll overscroll-y-contain [--explore-vhs-tape-height:clamp(7.25rem,20dvh,12rem)] [--explore-vhs-wheel-radius:clamp(10.5rem,31dvh,20rem)] data-[motion=reduced]:[scroll-snap-type:none] data-[motion=reduced]:overflow-hidden [&::-webkit-scrollbar]:hidden"
      ref={scrollContainerRef}
      style={{ height: exploreViewportHeight }}
    >
      <div
        className="relative"
        style={{
          height: `calc(${exploreVhsWheelScrollTrackHeight}px + ${exploreViewportHeight})`,
        }}
      >
        <div
          className="sticky top-0 overflow-hidden"
          data-motion={prefersReducedMotion ? "reduced" : "full"}
          data-slot="explore-vhs-frame"
          style={{ height: exploreViewportHeight }}
        >
          <ExploreVhsWheel
            focusedTapeIndex={focusedTapeIndex}
            onSelectTape={centerTape}
            rotation={wheelRotation}
            targetRotation={
              prefersReducedMotion
                ? 0
                : getExploreVhsWheelRotation(wheelTargetStep)
            }
          />

          <div className="relative z-10 mx-auto w-full max-w-[90rem] px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
            <header className="flex items-center justify-between gap-4">
              <button
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:cursor-pointer focus-visible:ring-2"
                onClick={onBack}
                type="button"
              >
                <ArrowLeftIcon className="size-4" />
                Back to create
              </button>
            </header>
          </div>
        </div>

        {Array.from({ length: exploreVhsWheelSnapPointCount }, (_, index) => (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 size-px snap-start"
            data-slot="explore-vhs-snap-point"
            key={index}
            style={{ top: index * exploreVhsWheelStepDistancePx }}
          />
        ))}
      </div>
    </main>
  );
}

function getExploreVhsWheelRotationDelta(deltaPixels: number) {
  return (
    (deltaPixels / exploreVhsWheelStepDistancePx) *
    getExploreVhsWheelRotation(1)
  );
}

function getExploreVhsSelectedTapeStep(
  currentRotation: number,
  tapeIndex: number,
) {
  const currentStep = currentRotation / getExploreVhsWheelRotation(1);
  const nearestRevolution = Math.round(
    (currentStep + tapeIndex) / exploreVhsTapeCount,
  );

  return nearestRevolution * exploreVhsTapeCount - tapeIndex;
}

export {
  ExplorePage,
  exploreVhsWheelCenterScrollTop,
  exploreVhsWheelStepDistancePx,
  getExploreVhsSelectedTapeStep,
  getExploreVhsWheelRotationDelta,
  type ExplorePageProps,
};

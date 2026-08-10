import { ArrowLeftIcon } from "lucide-react";
import { useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";

import {
  getExploreVhsTapes,
  type CreativeCategory,
  type ExploreVhsTapeKey,
} from "../../lib/explore/explore.ts";
import { ExploreCrtTv } from "./explore-crt-tv.tsx";
import {
  ExploreVhsStack,
  getExploreVhsFocusedTapeIndex,
} from "./explore-vhs-stack.tsx";

const exploreViewportHeight =
  "calc(100dvh - var(--remora-titlebar-height, 0px))";
// Keep each detent far enough apart that a short touch or trackpad swipe does
// not carry through several tapes before native scrolling loses momentum.
export const exploreVhsStepDistancePx = 450;
const exploreVhsSnapPointCount = 201;
export const exploreVhsCenterScrollTop =
  Math.floor(exploreVhsSnapPointCount / 2) * exploreVhsStepDistancePx;

export type ExplorePageProps = {
  category?: CreativeCategory;
  onBack: () => void;
  onSelectCategory: (category: CreativeCategory) => void;
  onStartCreating: () => void;
  onTryPrompt: (key: ExploreVhsTapeKey) => void;
};

export function ExplorePage({
  category,
  onBack,
  onTryPrompt,
}: ExplorePageProps) {
  const vhsTapes = getExploreVhsTapes(category);
  const vhsTapeCount = vhsTapes.length;
  const prefersReducedMotion = usePrefersReducedMotion();
  const scrollContainerRef = useRef<HTMLElement>(null);
  const stackStep = useMotionValue(0);
  const targetStepRef = useRef(0);
  const [targetStep, setTargetStep] = useState(0);

  function centerTape(tapeIndex: number) {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer || prefersReducedMotion) {
      return;
    }

    const selectedStep = getExploreVhsSelectedTapeStep(
      stackStep.get(),
      tapeIndex,
      vhsTapeCount,
    );
    const relativeStep = selectedStep - targetStepRef.current;

    if (
      relativeStep === 0 &&
      scrollContainer.scrollTop === exploreVhsCenterScrollTop
    ) {
      return;
    }

    scrollContainer.scrollTo({
      behavior: "smooth",
      top: exploreVhsCenterScrollTop + relativeStep * exploreVhsStepDistancePx,
    });
  }

  useLayoutEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = exploreVhsCenterScrollTop;
    }
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;

    if (!scrollContainer) {
      return;
    }

    scrollContainer.scrollTop = exploreVhsCenterScrollTop;

    if (prefersReducedMotion) {
      stackStep.set(0);
      targetStepRef.current = 0;
      setTargetStep(0);
      return;
    }

    let gestureDirection = 0;
    let maximumGestureDisplacement = 0;
    let isRecentering = false;

    function handleScroll() {
      const displacement =
        scrollContainer!.scrollTop - exploreVhsCenterScrollTop;

      if (!isRecentering && Math.abs(displacement) > 0.5) {
        gestureDirection = Math.sign(displacement);
        maximumGestureDisplacement = Math.max(
          maximumGestureDisplacement,
          Math.abs(displacement),
        );
      }

      stackStep.set(
        targetStepRef.current + displacement / exploreVhsStepDistancePx,
      );
    }

    function handleScrollEnd() {
      if (isRecentering) {
        return;
      }

      const displacement =
        scrollContainer!.scrollTop - exploreVhsCenterScrollTop;
      const nearestStep =
        Math.sign(displacement) *
        Math.round(Math.abs(displacement) / exploreVhsStepDistancePx);

      if (
        nearestStep === 0 &&
        gestureDirection !== 0 &&
        maximumGestureDisplacement > 0.5
      ) {
        scrollContainer!.scrollTo({
          behavior: "smooth",
          top:
            exploreVhsCenterScrollTop +
            gestureDirection * exploreVhsStepDistancePx,
        });
        return;
      }

      const nextTargetStep = targetStepRef.current + nearestStep;

      targetStepRef.current = nextTargetStep;
      setTargetStep(nextTargetStep);
      stackStep.set(nextTargetStep);

      gestureDirection = 0;
      maximumGestureDisplacement = 0;
      isRecentering = true;
      scrollContainer!.scrollTop = exploreVhsCenterScrollTop;
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
  }, [prefersReducedMotion, stackStep]);

  const focusedTapeIndex = getExploreVhsFocusedTapeIndex(
    targetStep,
    vhsTapeCount,
  );

  return (
    <main
      className="bg-background text-foreground relative min-h-0 [scroll-snap-type:y_mandatory] [scrollbar-width:none] overflow-x-hidden overflow-y-scroll overscroll-y-contain [--explore-crt-tv-size:clamp(18rem,46vw,42rem)] [--explore-scene-edge:clamp(1.5rem,4vw,3rem)] [--explore-vhs-stack-x:calc(var(--explore-scene-edge)_+_var(--explore-vhs-tape-width)/2)] [--explore-vhs-tape-gap:calc((100dvh_-_var(--remora-titlebar-height,0px))_/_2_+_var(--explore-vhs-tape-height)_/_2_-_var(--explore-vhs-tape-peek))] [--explore-vhs-tape-height:clamp(14rem,min(50dvh,32vw),30rem)] [--explore-vhs-tape-peek:clamp(2rem,6dvh,3.5rem)] [--explore-vhs-tape-width:calc(var(--explore-vhs-tape-height)*1652/2987*cos(80deg)+var(--explore-vhs-tape-height)*sin(80deg))] data-[motion=reduced]:[scroll-snap-type:none] data-[motion=reduced]:overflow-hidden [&::-webkit-scrollbar]:hidden"
      data-theme="light"
      ref={scrollContainerRef}
      style={{ height: exploreViewportHeight }}
    >
      <div
        className="relative"
        style={{
          height: `calc(${(exploreVhsSnapPointCount - 1) * exploreVhsStepDistancePx}px + ${exploreViewportHeight})`,
        }}
      >
        <div
          className="sticky top-0 overflow-hidden"
          data-motion={prefersReducedMotion ? "reduced" : "full"}
          data-slot="explore-vhs-frame"
          style={{ height: exploreViewportHeight }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[.1]"
            data-slot="explore-grain"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23grain)'/%3E%3C/svg%3E")`,
            }}
          />

          <div
            className="absolute inset-y-0 left-1/2 w-full max-w-[90rem] -translate-x-1/2"
            data-slot="explore-scene"
          >
            <ExploreVhsStack
              focusedTapeIndex={focusedTapeIndex}
              onSelectTape={centerTape}
              onTryPrompt={onTryPrompt}
              step={stackStep}
              tapes={vhsTapes}
              targetStep={prefersReducedMotion ? 0 : targetStep}
            />

            <div className="pointer-events-none absolute inset-y-0 right-[var(--explore-scene-edge)] z-[1] flex w-[var(--explore-crt-tv-size)] items-center">
              <ExploreCrtTv
                category={category}
                videoKey={focusedTapeIndex}
                videoUrl={vhsTapes[focusedTapeIndex].videoUrl}
              />
            </div>

            <div className="relative z-10 w-full px-[var(--explore-scene-edge)] py-3">
              <header className="flex items-center justify-between gap-4">
                <button
                  aria-label="Back"
                  className="text-ink hover:text-ink-hover focus-visible:ring-ring -ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:cursor-pointer focus-visible:ring-2"
                  onClick={onBack}
                  type="button"
                >
                  <ArrowLeftIcon className="size-4" />
                </button>
              </header>
            </div>
          </div>
        </div>

        {Array.from({ length: exploreVhsSnapPointCount }, (_, index) => (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 size-px snap-start"
            data-slot="explore-vhs-snap-point"
            key={index}
            style={{ top: index * exploreVhsStepDistancePx }}
          />
        ))}
      </div>
    </main>
  );
}

export function getExploreVhsSelectedTapeStep(
  currentStep: number,
  tapeIndex: number,
  tapeCount: number = getExploreVhsTapes().length,
) {
  const nearestRevolution = Math.round((currentStep - tapeIndex) / tapeCount);

  return tapeIndex + nearestRevolution * tapeCount;
}

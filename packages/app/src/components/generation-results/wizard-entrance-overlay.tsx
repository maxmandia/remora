import { motion, useMotionValue } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";
import {
  computeWizardEntranceTimeline,
  getWizardEntranceBoxPosition,
  getWizardEntranceGeometry,
  getWizardEntranceSecondaryTarget,
  sampleWizardEntrance,
  type WizardEntranceSample,
  type WizardEntranceTimeline,
} from "../../lib/generation/wizard-entrance.ts";
import {
  WizardHead,
  type WizardHeadMotionHandle,
} from "../generation-composer/wizard-head.tsx";

// If the wordmark image never loads we abandon the entrance rather than
// keep the real wizard hidden behind a spectacle that cannot start.
const wizardEntranceLogoLoadTimeoutMs = 1500;
// Resizes beyond this many pixels invalidate the measured trajectory, so the
// entrance finishes immediately instead of landing in a stale slot.
const wizardEntranceResizeTolerancePx = 24;

type WizardEntranceOverlayProps = {
  logoRef: React.RefObject<HTMLImageElement | null>;
  onComplete: () => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
};

function WizardEntranceOverlay({
  logoRef,
  onComplete,
  stageRef,
}: WizardEntranceOverlayProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [timeline, setTimeline] = useState<WizardEntranceTimeline | null>(null);
  const motionHandleRef = useRef<WizardHeadMotionHandle | null>(null);
  const hasCompletedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const scaleX = useMotionValue(1);
  const scaleY = useMotionValue(1);
  const rotate = useMotionValue(0);

  onCompleteRef.current = onComplete;

  useLayoutEffect(() => {
    if (!prefersReducedMotion) {
      return;
    }

    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onCompleteRef.current();
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    let animationFrameId: number | null = null;
    let logoLoadTimeoutId: number | null = null;
    let logoElement: HTMLImageElement | null = null;
    let handleLogoLoad: (() => void) | null = null;

    function complete() {
      if (hasCompletedRef.current) {
        return;
      }

      hasCompletedRef.current = true;
      onCompleteRef.current();
    }

    function applySample(sample: WizardEntranceSample) {
      const boxPosition = getWizardEntranceBoxPosition(sample);

      x.set(boxPosition.x);
      y.set(boxPosition.y);
      scaleX.set(sample.scaleX);
      scaleY.set(sample.scaleY);
      rotate.set(sample.rotationDeg);
      motionHandleRef.current?.applyMotionTarget(
        getWizardEntranceSecondaryTarget(sample),
      );
    }

    function start() {
      const stage = stageRef.current;
      const logo = logoRef.current;
      const slot = stage?.querySelector(
        '[data-slot="generation-command-wizard"]',
      );

      if (!stage || !logo || !slot) {
        complete();
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const logoRect = logo.getBoundingClientRect();
      const slotRect = slot.getBoundingClientRect();

      if (
        stageRect.width <= 0 ||
        stageRect.height <= 0 ||
        logoRect.width <= 0 ||
        logoRect.height <= 0 ||
        slotRect.width <= 0 ||
        slotRect.height <= 0
      ) {
        complete();
        return;
      }

      const entranceTimeline = computeWizardEntranceTimeline(
        getWizardEntranceGeometry({ logoRect, slotRect, stageRect }),
      );

      applySample(sampleWizardEntrance(entranceTimeline, 0));
      setTimeline(entranceTimeline);

      const startedAt = performance.now();

      function step(frameTime: number) {
        const elapsedMs = frameTime - startedAt;
        const sample = sampleWizardEntrance(entranceTimeline, elapsedMs);

        applySample(sample);

        if (sample.phase === "done") {
          animationFrameId = null;
          complete();
          return;
        }

        animationFrameId = window.requestAnimationFrame(step);
      }

      animationFrameId = window.requestAnimationFrame(step);
    }

    const initialViewportWidth = window.innerWidth;
    const initialViewportHeight = window.innerHeight;

    function handleResize() {
      const widthDelta = Math.abs(window.innerWidth - initialViewportWidth);
      const heightDelta = Math.abs(window.innerHeight - initialViewportHeight);

      if (
        widthDelta <= wizardEntranceResizeTolerancePx &&
        heightDelta <= wizardEntranceResizeTolerancePx
      ) {
        return;
      }

      window.removeEventListener("resize", handleResize);
      complete();
    }

    const initialLogo = logoRef.current;

    if (!initialLogo) {
      complete();
      return;
    }

    if (initialLogo.complete && initialLogo.naturalWidth > 0) {
      start();
    } else {
      logoElement = initialLogo;
      handleLogoLoad = () => {
        if (logoLoadTimeoutId !== null) {
          window.clearTimeout(logoLoadTimeoutId);
          logoLoadTimeoutId = null;
        }

        start();
      };
      logoElement.addEventListener("load", handleLogoLoad, { once: true });
      logoLoadTimeoutId = window.setTimeout(
        complete,
        wizardEntranceLogoLoadTimeoutMs,
      );
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      if (logoLoadTimeoutId !== null) {
        window.clearTimeout(logoLoadTimeoutId);
      }

      if (logoElement && handleLogoLoad) {
        logoElement.removeEventListener("load", handleLogoLoad);
      }
    };
  }, [logoRef, prefersReducedMotion, rotate, scaleX, scaleY, stageRef, x, y]);

  if (prefersReducedMotion || !timeline) {
    return null;
  }

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute top-0 left-0 z-[2] size-12"
      data-slot="wizard-entrance-overlay"
      style={{
        rotate,
        scaleX,
        scaleY,
        transformOrigin: "50% 90%",
        x,
        y,
      }}
    >
      <WizardHead interactive={false} motionHandleRef={motionHandleRef} />
    </motion.div>
  );
}

export { WizardEntranceOverlay };
export type { WizardEntranceOverlayProps };

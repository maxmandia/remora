import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";
import {
  getWizardMotionTarget,
  neutralWizardMotionTarget,
  type WizardMotionTarget,
} from "../../lib/generation/wizard-head.ts";

const headSpring = {
  damping: 20,
  mass: 0.55,
  stiffness: 260,
};
const crownSpring = {
  damping: 13.5,
  mass: 0.8,
  stiffness: 170,
};
const charmSpring = {
  damping: 8.5,
  mass: 0.45,
  stiffness: 110,
};
const beardSpring = {
  damping: 16,
  mass: 1,
  stiffness: 130,
};
const eyesSpring = {
  damping: 30,
  mass: 0.25,
  stiffness: 360,
};
const riseSpring = {
  damping: 16,
  mass: 0.7,
  stiffness: 210,
};
const wizardViewBoxSize = 128;
const wizardDisplaySizePx = 48;
const wizardSvgUnitsPerDisplayPixel = wizardViewBoxSize / wizardDisplaySizePx;

type WizardTargetMotionValues = {
  crownRotate: MotionValue<number>;
  crownX: MotionValue<number>;
  crownY: MotionValue<number>;
  eyesX: MotionValue<number>;
  eyesY: MotionValue<number>;
  headRotate: MotionValue<number>;
  headX: MotionValue<number>;
  headY: MotionValue<number>;
  riseY: MotionValue<number>;
};

type WizardHeadMotionHandle = {
  applyMotionTarget: (target: WizardMotionTarget) => void;
};

type WizardHeadProps = {
  /**
   * When false, the wizard ignores pointer proximity entirely so an external
   * driver (the entrance overlay) can feed motion targets via the handle.
   */
  interactive?: boolean;
  motionHandleRef?: Ref<WizardHeadMotionHandle>;
};

function WizardHead({ interactive = true, motionHandleRef }: WizardHeadProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activeRef = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const headTargetX = useMotionValue(0);
  const headTargetY = useMotionValue(0);
  const headTargetRotate = useMotionValue(0);
  const crownTargetX = useMotionValue(0);
  const crownTargetY = useMotionValue(0);
  const crownTargetRotate = useMotionValue(0);
  const eyesTargetX = useMotionValue(0);
  const eyesTargetY = useMotionValue(0);
  const riseTargetY = useMotionValue(0);
  const headTargetSvgX = useTransform(headTargetX, toWizardSvgUnits);
  const headTargetSvgY = useTransform(headTargetY, toWizardSvgUnits);
  const crownTargetSvgX = useTransform(crownTargetX, toWizardSvgUnits);
  const crownTargetSvgY = useTransform(crownTargetY, toWizardSvgUnits);
  const eyesTargetSvgX = useTransform(eyesTargetX, toWizardSvgUnits);
  const eyesTargetSvgY = useTransform(eyesTargetY, toWizardSvgUnits);
  const riseTargetSvgY = useTransform(riseTargetY, toWizardSvgUnits);
  const targetMotionValues: WizardTargetMotionValues = {
    crownRotate: crownTargetRotate,
    crownX: crownTargetX,
    crownY: crownTargetY,
    eyesX: eyesTargetX,
    eyesY: eyesTargetY,
    headRotate: headTargetRotate,
    headX: headTargetX,
    headY: headTargetY,
    riseY: riseTargetY,
  };

  const riseY = useSpring(riseTargetSvgY, riseSpring);
  const headX = useSpring(headTargetSvgX, headSpring);
  const headY = useSpring(headTargetSvgY, headSpring);
  const headRotate = useSpring(headTargetRotate, headSpring);
  const crownX = useSpring(crownTargetSvgX, crownSpring);
  const crownY = useSpring(crownTargetSvgY, crownSpring);
  const crownRotate = useSpring(crownTargetRotate, crownSpring);
  const charmX = useSpring(crownX, charmSpring);
  const charmY = useSpring(crownY, charmSpring);
  const charmRotateSource = useTransform(
    crownRotate,
    (rotation) => rotation * (6.5 / 4.75),
  );
  const charmRotate = useSpring(charmRotateSource, charmSpring);
  const beardX = useSpring(headX, beardSpring);
  const beardY = useSpring(headY, beardSpring);
  const beardRotate = useSpring(headRotate, beardSpring);
  const eyesX = useSpring(eyesTargetSvgX, eyesSpring);
  const eyesY = useSpring(eyesTargetSvgY, eyesSpring);

  useImperativeHandle(
    motionHandleRef,
    () => ({
      applyMotionTarget: (target) =>
        applyWizardMotionTarget(targetMotionValues, target),
    }),
    [],
  );

  useEffect(() => {
    if (!interactive) {
      return;
    }

    if (prefersReducedMotion) {
      applyWizardMotionTarget(targetMotionValues, neutralWizardMotionTarget);
      [
        beardRotate,
        beardX,
        beardY,
        charmRotate,
        charmX,
        charmY,
        crownRotate,
        crownX,
        crownY,
        eyesX,
        eyesY,
        headRotate,
        headX,
        headY,
        riseY,
      ].forEach((motionValue) => motionValue.jump(0));
      activeRef.current = false;
      setIsActive(false);

      return;
    }

    let latestPointer: { x: number; y: number } | null = null;
    let animationFrameId: number | null = null;

    function applyTarget(target: WizardMotionTarget) {
      applyWizardMotionTarget(targetMotionValues, target);

      if (activeRef.current !== target.active) {
        activeRef.current = target.active;
        setIsActive(target.active);
      }
    }

    function resetTarget() {
      latestPointer = null;

      if (animationFrameId !== null) {
        cancelWizardAnimationFrame(animationFrameId);
        animationFrameId = null;
      }

      applyTarget(neutralWizardMotionTarget);
    }

    function updateTarget() {
      animationFrameId = null;

      const svg = svgRef.current;

      if (!svg || !latestPointer) {
        applyTarget(neutralWizardMotionTarget);
        return;
      }

      applyTarget(
        getWizardMotionTarget(latestPointer, svg.getBoundingClientRect()),
      );
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "touch") {
        resetTarget();
        return;
      }

      latestPointer = {
        x: event.clientX,
        y: event.clientY,
      };

      if (animationFrameId === null) {
        animationFrameId = requestWizardAnimationFrame(updateTarget);
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        resetTarget();
      }
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointercancel", resetTarget);
    window.addEventListener("blur", resetTarget);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointercancel", resetTarget);
      window.removeEventListener("blur", resetTarget);
      document.removeEventListener("visibilitychange", handleVisibilityChange);

      if (animationFrameId !== null) {
        cancelWizardAnimationFrame(animationFrameId);
      }

      applyWizardMotionTarget(targetMotionValues, neutralWizardMotionTarget);
      activeRef.current = false;
    };
  }, [
    beardRotate,
    beardX,
    beardY,
    charmRotate,
    charmX,
    charmY,
    crownRotate,
    crownX,
    crownY,
    crownTargetRotate,
    crownTargetX,
    crownTargetY,
    eyesX,
    eyesY,
    eyesTargetX,
    eyesTargetY,
    headRotate,
    headX,
    headY,
    headTargetRotate,
    headTargetX,
    headTargetY,
    interactive,
    prefersReducedMotion,
    riseTargetY,
    riseY,
  ]);

  return (
    <svg
      ref={svgRef}
      aria-hidden="true"
      className="size-full overflow-visible"
      data-proximity-active={isActive}
      data-slot="wizard-head"
      focusable="false"
      viewBox="0 0 128 128"
      xmlns="http://www.w3.org/2000/svg"
    >
      <motion.g data-physics-layer="rise" style={{ y: riseY }}>
        <motion.g
          data-physics-part="beard"
          style={{
            x: beardX,
            y: beardY,
            rotate: beardRotate,
            transformBox: "view-box",
            transformOrigin: "67px 79px",
          }}
        >
          <path
            fill="#e9e7e2"
            d="M31 79c-3 8 2 15 9 15-2 8 5 15 13 13 1 8 10 12 16 7 6 6 16 2 17-6 9 2 15-6 12-14 8-2 11-12 5-18Z"
          />
          <path
            fill="#c4c1bb"
            d="M48 86c3 12 11 22 21 28 11-8 18-18 20-30-11 7-29 8-41 2Z"
            opacity=".5"
          />
          <path
            fill="none"
            stroke="#9f9c96"
            strokeLinecap="round"
            strokeWidth="3"
            d="M51 94c4 4 7 8 9 14m27-15c-4 5-7 10-9 16m-9-13v15"
            opacity=".45"
          />
        </motion.g>

        <motion.g
          data-physics-part="head"
          style={{
            x: headX,
            y: headY,
            rotate: headRotate,
            transformBox: "view-box",
            transformOrigin: "67px 70px",
          }}
        >
          <ellipse cx="67" cy="70" rx="34" ry="28" fill="#cecbc5" />
          <path
            fill="#a9a69f"
            d="M34 66c-7 1-9 8-5 13 3 4 7 5 11 3Zm65 1c8 0 10 8 6 13-3 4-7 5-11 3Z"
            opacity=".75"
          />

          <motion.g
            data-physics-part="eyes"
            style={{
              x: eyesX,
              y: eyesY,
              transformBox: "view-box",
              transformOrigin: "67px 67px",
            }}
          >
            <path
              fill="none"
              stroke="#292823"
              strokeLinecap="round"
              strokeWidth="4.5"
              d="M44 67c5 3 10 3 15-1m18 0c5 3 10 3 15-1"
            />
            <circle cx="53" cy="68" r="1.7" fill="#292823" />
            <circle cx="86" cy="67" r="1.7" fill="#292823" />
          </motion.g>

          <path
            fill="#aaa7a1"
            d="M66 62c-2 8-5 15-8 20 5 4 12 4 18 0-3-5-4-12-4-20Z"
          />
        </motion.g>

        <motion.g
          data-physics-part="moustache"
          style={{
            x: headX,
            y: headY,
            rotate: headRotate,
            transformBox: "view-box",
            transformOrigin: "67px 70px",
          }}
        >
          <path
            fill="#f3f1ec"
            d="M67 81c-8-7-19-4-24 4 7 5 17 5 25 0 8 6 18 5 25-1-7-7-18-9-26-3Z"
          />
        </motion.g>

        <motion.g
          data-physics-part="hat-brim"
          style={{
            x: headX,
            y: headY,
            rotate: headRotate,
            transformBox: "view-box",
            transformOrigin: "67px 70px",
          }}
        >
          <path
            fill="#b8b5af"
            d="M19 54c12-9 31-13 52-12 22 0 39 5 47 15-12 9-33 13-57 11-20-1-35-6-42-14Z"
          />
          <path
            fill="#e1ded8"
            d="M27 55c20-4 53-3 82 3-21 4-57 3-82-3Z"
            opacity=".63"
          />
        </motion.g>

        <motion.g
          data-physics-part="hat-crown"
          style={{
            x: crownX,
            y: crownY,
            rotate: crownRotate,
            transformBox: "view-box",
            transformOrigin: "67px 55px",
          }}
        >
          <path
            fill="#cfccc6"
            d="M39 49c4-17 17-30 36-36 4 9 15 16 26 20-5 4-8 10-9 17-18-4-37-4-53-1Z"
          />
          <path
            fill="#f0eee9"
            d="M50 45c6-12 14-20 25-26 3 9 10 15 19 18-6 2-11 6-14 11-10-2-20-3-30-3Z"
            opacity=".45"
          />
          <path
            fill="#999690"
            d="M39 44c17 2 35 4 53 7l-2 9c-18-5-35-6-53-4Z"
          />
        </motion.g>

        <motion.g
          data-physics-part="hat-charm"
          style={{
            x: charmX,
            y: charmY,
            rotate: charmRotate,
            transformBox: "view-box",
            transformOrigin: "59px 41px",
          }}
        >
          <path
            fill="#f2f0eb"
            d="m59 30 4 7 8 1-6 6 1 8-7-4-7 4 1-8-6-6 8-1Z"
            opacity=".92"
          />
          <circle cx="59" cy="41" r="3" fill="#aaa7a1" />
        </motion.g>
      </motion.g>
    </svg>
  );
}

function applyWizardMotionTarget(
  motionValues: WizardTargetMotionValues,
  target: WizardMotionTarget,
) {
  motionValues.headX.set(target.headX);
  motionValues.headY.set(target.headY);
  motionValues.headRotate.set(target.headRotate);
  motionValues.crownX.set(target.crownX);
  motionValues.crownY.set(target.crownY);
  motionValues.crownRotate.set(target.crownRotate);
  motionValues.eyesX.set(target.eyesX);
  motionValues.eyesY.set(target.eyesY);
  motionValues.riseY.set(target.riseY);
}

function requestWizardAnimationFrame(callback: FrameRequestCallback) {
  if (typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame(callback);
  }

  return window.setTimeout(() => callback(window.performance.now()), 16);
}

function cancelWizardAnimationFrame(animationFrameId: number) {
  if (typeof window.cancelAnimationFrame === "function") {
    window.cancelAnimationFrame(animationFrameId);
    return;
  }

  window.clearTimeout(animationFrameId);
}

function toWizardSvgUnits(displayPixels: number) {
  return displayPixels * wizardSvgUnitsPerDisplayPixel;
}

export { WizardHead };
export type { WizardHeadMotionHandle, WizardHeadProps };

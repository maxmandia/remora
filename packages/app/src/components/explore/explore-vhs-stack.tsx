import {
  motion,
  useMotionValueEvent,
  useTransform,
  type MotionValue,
} from "motion/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@remora/ui";
import { ArrowRightIcon } from "lucide-react";
import exploreVhsCassetteUrl from "../../assets/explore-vhs-cassette.webp";
import {
  exploreVhsTapes,
  type ExploreVhsTapeDetails,
  type ExploreVhsTapeKey,
} from "../../lib/explore/explore.ts";

export const exploreVhsTapeCount = exploreVhsTapes.length;

// Sub-pixel scroll jitter maps to step noise below this threshold, so treat
// anything closer than this to the target step as settled.
const exploreVhsSettledStepEpsilon = 0.005;

export type ExploreVhsStackProps = {
  focusedTapeIndex: number;
  onSelectTape: (tapeIndex: number) => void;
  onTryPrompt: (key: ExploreVhsTapeKey) => void;
  step: MotionValue<number>;
  tapes: readonly ExploreVhsTapeDetails<ExploreVhsTapeKey>[];
  targetStep: number;
};

export function getExploreVhsFocusedTapeIndex(
  step: number,
  tapeCount: number = exploreVhsTapeCount,
) {
  return ((step % tapeCount) + tapeCount) % tapeCount;
}

export function getExploreVhsTapeOffset(
  step: number,
  tapeIndex: number,
  tapeCount: number = exploreVhsTapeCount,
) {
  const distance = (((tapeIndex - step) % tapeCount) + tapeCount) % tapeCount;

  return distance < tapeCount / 2 ? distance : distance - tapeCount;
}

export function ExploreVhsStack({
  focusedTapeIndex,
  onSelectTape,
  onTryPrompt,
  step,
  tapes,
  targetStep,
}: ExploreVhsStackProps) {
  const [cassetteUrl, setCassetteUrl] = useState<string | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);

  useMotionValueEvent(step, "change", (latestStep) => {
    stackRef.current?.setAttribute("data-step", String(latestStep));
  });

  // The shared package resolves assets differently during web SSR and in the
  // browser. Applying the URL after hydration keeps both initial trees stable.
  useEffect(() => {
    setCassetteUrl(exploreVhsCassetteUrl);
  }, []);

  return (
    <div
      className="pointer-events-none absolute top-1/2 left-[var(--explore-vhs-stack-x)] size-0 select-none"
      data-focused-tape-index={focusedTapeIndex}
      data-slot="explore-vhs-stack"
      data-step={step.get()}
      data-target-step={targetStep}
      ref={stackRef}
    >
      {tapes.map((tape, index) => (
        <ExploreVhsTape
          cassetteUrl={cassetteUrl}
          focused={index === focusedTapeIndex}
          index={index}
          key={tape.key}
          onSelect={onSelectTape}
          step={step}
          tapeCount={tapes.length}
          title={tape.title}
        />
      ))}

      <ExploreVhsTapeCaption
        focusedTapeIndex={focusedTapeIndex}
        onTryPrompt={onTryPrompt}
        step={step}
        tapes={tapes}
        targetStep={targetStep}
      />
    </div>
  );
}

type ExploreVhsTapeCaptionProps = {
  focusedTapeIndex: number;
  onTryPrompt: (key: ExploreVhsTapeKey) => void;
  step: MotionValue<number>;
  tapes: readonly ExploreVhsTapeDetails<ExploreVhsTapeKey>[];
  targetStep: number;
};

function ExploreVhsTapeCaption({
  focusedTapeIndex,
  onTryPrompt,
  step,
  tapes,
  targetStep,
}: ExploreVhsTapeCaptionProps) {
  const [settled, setSettled] = useState(
    () => Math.abs(step.get() - targetStep) < exploreVhsSettledStepEpsilon,
  );
  const targetStepRef = useRef(targetStep);

  useEffect(() => {
    targetStepRef.current = targetStep;
    setSettled(
      Math.abs(step.get() - targetStep) < exploreVhsSettledStepEpsilon,
    );
  }, [step, targetStep]);

  useMotionValueEvent(step, "change", (latestStep) => {
    setSettled(
      Math.abs(latestStep - targetStepRef.current) <
        exploreVhsSettledStepEpsilon,
    );
  });

  const { description, key, title } = tapes[focusedTapeIndex];

  return (
    <div
      className="absolute top-[calc(var(--explore-vhs-tape-height)/2)] left-[calc((var(--explore-vhs-tape-height)*1652/2987*cos(80deg)+var(--explore-vhs-tape-height)*sin(80deg))/-2)] flex w-[calc(var(--explore-vhs-tape-height)*1652/2987*cos(80deg)+var(--explore-vhs-tape-height)*sin(80deg))] flex-col items-start justify-start gap-1 transition-opacity duration-200 data-[settled=false]:opacity-0 data-[settled=false]:transition-none"
      data-settled={settled ? "true" : "false"}
      data-slot="explore-vhs-tape-caption"
    >
      <div className="flex w-full items-center justify-between">
        <span className="text-ink text-lg leading-tight font-light tracking-[-0.01em]">
          {title}
        </span>
        <Button
          className="pointer-events-auto text-xs"
          disabled={!settled}
          onClick={() => onTryPrompt(key)}
          variant="ghost"
        >
          <ArrowRightIcon className="size-3" />
        </Button>
      </div>
      <span className="text-ink/65 w-full text-lg leading-snug font-light">
        {description}
      </span>
    </div>
  );
}

type ExploreVhsTapeProps = {
  cassetteUrl: string | null;
  focused: boolean;
  index: number;
  onSelect: (tapeIndex: number) => void;
  step: MotionValue<number>;
  tapeCount: number;
  title: string;
};

function ExploreVhsTape({
  cassetteUrl,
  focused,
  index,
  onSelect,
  step,
  tapeCount,
  title,
}: ExploreVhsTapeProps) {
  const tapeRef = useRef<HTMLDivElement>(null);
  const y = useTransform(
    step,
    (latestStep) =>
      `calc(${getExploreVhsTapeOffset(latestStep, index, tapeCount)} * var(--explore-vhs-tape-gap))`,
  );

  useMotionValueEvent(step, "change", (latestStep) => {
    tapeRef.current?.setAttribute(
      "data-offset",
      String(getExploreVhsTapeOffset(latestStep, index, tapeCount)),
    );
  });

  return (
    <motion.div
      className="absolute top-0 left-0 size-0 will-change-transform"
      data-focused={focused ? "true" : undefined}
      data-offset={getExploreVhsTapeOffset(step.get(), index, tapeCount)}
      data-slot="explore-vhs-tape"
      data-tape-index={index}
      ref={tapeRef}
      style={{ y }}
    >
      <button
        aria-current={focused ? "true" : undefined}
        aria-label={`Center ${title}`}
        className="focus-visible:ring-ring pointer-events-auto absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 border-0 bg-transparent p-0 outline-none focus-visible:ring-2"
        onClick={() => onSelect(index)}
        type="button"
      >
        <img
          alt=""
          className="h-[var(--explore-vhs-tape-height)] max-w-none -rotate-80"
          decoding="async"
          draggable={false}
          src={cassetteUrl ?? undefined}
        />
      </button>
    </motion.div>
  );
}

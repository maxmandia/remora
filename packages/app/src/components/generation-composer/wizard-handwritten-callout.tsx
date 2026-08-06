import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";

const wizardCalloutText = "Click the wizard to help build prompts";
const wizardCalloutDismissDelayMs = 2600;
const wizardCalloutArrowDelaySeconds = 1.5;
const wizardCalloutArrowDurationSeconds = 0.38;
const wizardCalloutFadeDurationSeconds = 0.4;
const wizardCalloutGlyphDurationSeconds = 0.14;
const wizardCalloutGlyphIntervalSeconds = 0.032;
const wizardCalloutLinePauseSeconds = 0.1;
const wizardCalloutWordPauseSeconds = 0.04;

type WizardCalloutGlyphDefinition = {
  advance: number;
  strokes: string[];
};

type WizardCalloutPositionedGlyph = {
  character: string;
  delaySeconds: number;
  index: number;
  strokes: string[];
  x: number;
  y: number;
};

type WizardHandwrittenCalloutProps = {
  onDismiss?: () => void;
  visible: boolean;
};

const wizardCalloutGlyphs = {
  C: {
    advance: 12,
    strokes: ["M10.5 2.5C8-0.5 2 0 1.5 8.5C1 16 7.5 19 11 14.5"],
  },
  a: {
    advance: 11,
    strokes: [
      "M8.5 8.5C6 5.5 1.5 7 1.5 12.5C1.5 17.5 6.5 18.5 9 14",
      "M9 7.5C8.5 11 8.5 15 10 17.5",
    ],
  },
  b: {
    advance: 11,
    strokes: [
      "M2.5 0.5C2 5.5 2 11 2 16.5",
      "M2.5 11C5 6.5 10 7 10 12.5C10 17.5 5 18.5 2 15",
    ],
  },
  c: {
    advance: 10,
    strokes: ["M8.5 8.5C6 5.5 1.5 7 1.5 12.5C1.5 17.5 6.5 18.5 9 15"],
  },
  d: {
    advance: 11,
    strokes: [
      "M9.5 0.5C9 6 8.5 12 9.5 17.5",
      "M8.5 9C6 5.5 1.5 7 1.5 12.5C1.5 17.5 6.5 18.5 9 14",
    ],
  },
  e: {
    advance: 11,
    strokes: [
      "M1.5 12.5C4 12 8.5 10.5 9 8C8 5.5 2 6.5 1.5 12.5C1 17.5 7 19 10 14.5",
    ],
  },
  h: {
    advance: 11,
    strokes: [
      "M2.5 0.5C2 6 2 11.5 2.5 17.5",
      "M2.5 11.5C4.5 7 9 7 9.5 12L9.5 17.5",
    ],
  },
  i: {
    advance: 5,
    strokes: ["M2.5 7.5C2 11 2 14.5 2.5 17.5", "M2.7 3L2.75 3"],
  },
  k: {
    advance: 11,
    strokes: [
      "M2.5 0.5C2 6 2 12 2.5 17.5",
      "M9.5 7.5L2.5 13",
      "M5.5 10.5L10 17.5",
    ],
  },
  l: {
    advance: 6,
    strokes: ["M3 0.5C2 6.5 2 13 3.5 17.5"],
  },
  m: {
    advance: 14,
    strokes: [
      "M1.5 8L1.5 17.5",
      "M1.5 11.5C3 7 6.5 7 6.5 12L6.5 17.5",
      "M6.5 11.5C8.5 7 12 7 12 12L12 17.5",
    ],
  },
  o: {
    advance: 11,
    strokes: ["M5 7C1.5 7 0.5 12 2 16C4.5 19 10 16.5 10 12C10 8.5 7.5 6.5 5 7"],
  },
  p: {
    advance: 11,
    strokes: [
      "M2 8C2.5 13 2.5 17.5 2 22",
      "M2.5 11C4.5 6.5 10 7 10 12.5C10 17.5 5 18.5 2 15",
    ],
  },
  r: {
    advance: 10,
    strokes: ["M2 7.5L2.5 17.5", "M2.5 11.5C4.5 7 7.5 6.5 9 9"],
  },
  s: {
    advance: 10,
    strokes: [
      "M9 8.5C6 5.5 1.5 7 2 10.5C2.5 13 8 12.5 9 15C10 18.5 3.5 19.5 1 16.5",
    ],
  },
  t: {
    advance: 10,
    strokes: ["M4.5 2C3.5 7.5 3 14 5 17.5", "M0.5 7.5C4 7.5 7 7 9 6.5"],
  },
  u: {
    advance: 11,
    strokes: [
      "M2 7.5C1.5 11.5 1 16 4 17.5C7 19 9 14 9.5 8",
      "M9.5 8C9 12 9 15.5 10.5 17.5",
    ],
  },
  w: {
    advance: 14,
    strokes: [
      "M1 7.5C1 12 1.5 16 3.5 17.5C5.5 16.5 6 12.5 6.5 9C6.5 14 7.5 17 9.5 17.5C11.5 15.5 12.5 11 12.5 7.5",
    ],
  },
  z: {
    advance: 12,
    strokes: ["M1 8C4.5 7 8 7 10.5 7.5L1.5 17.5C5.5 16.5 8.5 16.5 11 16.5"],
  },
} satisfies Record<string, WizardCalloutGlyphDefinition>;

const wizardCalloutLines = [
  { text: "Click the wizard", x: 27, y: 1 },
  { text: "to help build prompts", x: 2, y: 29 },
] as const;

const positionedWizardCalloutGlyphs = layoutWizardCalloutGlyphs();

function WizardHandwrittenCallout({
  onDismiss,
  visible,
}: WizardHandwrittenCalloutProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const onDismissRef = useRef(onDismiss);

  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) {
      return;
    }

    const dismissalTimer = window.setTimeout(
      () => onDismissRef.current?.(),
      wizardCalloutDismissDelayMs,
    );

    return () => window.clearTimeout(dismissalTimer);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          aria-live="polite"
          className="pointer-events-none absolute top-[-6rem] right-0 z-[6] h-[4.5rem] w-52 -rotate-2 text-[#e9e7e2] @min-[82rem]:top-[-7rem] @min-[82rem]:right-auto @min-[82rem]:left-[calc(100%-3rem)] @min-[82rem]:w-56"
          data-motion={prefersReducedMotion ? "reduced" : "animated"}
          data-slot="wizard-handwritten-callout"
          exit={prefersReducedMotion ? undefined : { opacity: 0 }}
          key="wizard-handwritten-callout"
          role="status"
          transition={{
            duration: prefersReducedMotion
              ? 0
              : wizardCalloutFadeDurationSeconds,
            ease: "easeOut",
          }}
        >
          <span className="sr-only">{wizardCalloutText}</span>
          <svg
            aria-hidden="true"
            className="size-full overflow-visible"
            fill="none"
            viewBox="0 0 205 56"
            xmlns="http://www.w3.org/2000/svg"
          >
            {positionedWizardCalloutGlyphs.flatMap((glyph) =>
              glyph.strokes.map((stroke, strokeIndex) => (
                <motion.path
                  animate={
                    prefersReducedMotion
                      ? undefined
                      : { opacity: 1, pathLength: 1 }
                  }
                  d={stroke}
                  data-character={glyph.character}
                  data-glyph-index={glyph.index}
                  data-stroke-index={strokeIndex}
                  initial={
                    prefersReducedMotion ? false : { opacity: 0, pathLength: 0 }
                  }
                  key={`${glyph.index}-${strokeIndex}`}
                  pathLength={1}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.65"
                  style={{
                    transform: `translate(${glyph.x}px, ${glyph.y}px)`,
                  }}
                  transition={{
                    delay:
                      glyph.delaySeconds +
                      strokeIndex * wizardCalloutGlyphIntervalSeconds,
                    duration: prefersReducedMotion
                      ? 0
                      : wizardCalloutGlyphDurationSeconds,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              )),
            )}
          </svg>
          <WizardHandwrittenArrow
            direction="right"
            prefersReducedMotion={prefersReducedMotion}
          />
          <WizardHandwrittenArrow
            direction="left"
            prefersReducedMotion={prefersReducedMotion}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function WizardHandwrittenArrow({
  direction,
  prefersReducedMotion,
}: {
  direction: "left" | "right";
  prefersReducedMotion: boolean;
}) {
  const pathMotion = prefersReducedMotion
    ? undefined
    : { opacity: 1, pathLength: 1 };
  const initialPathMotion = prefersReducedMotion
    ? false
    : { opacity: 0, pathLength: 0 };

  return (
    <motion.svg
      aria-hidden="true"
      className={
        direction === "right"
          ? "absolute top-[4.75rem] left-1/2 h-[2.625rem] w-28 overflow-visible @min-[82rem]:hidden"
          : "absolute top-[4.75rem] left-0 hidden h-[2.625rem] w-28 overflow-visible @min-[82rem]:block"
      }
      data-direction={direction}
      data-slot="wizard-handwritten-arrow"
      fill="none"
      viewBox="0 0 112 42"
      xmlns="http://www.w3.org/2000/svg"
    >
      <motion.path
        animate={pathMotion}
        d={
          direction === "right"
            ? "M3 3C13 10 5 22 15 27C19 30 22 31 26 34"
            : "M106 3C96 10 104 22 88 27C75 33 63 28 50 34"
        }
        initial={initialPathMotion}
        pathLength={1}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{
          delay: wizardCalloutArrowDelaySeconds,
          duration: prefersReducedMotion
            ? 0
            : wizardCalloutArrowDurationSeconds,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
      <motion.path
        animate={pathMotion}
        d={direction === "right" ? "M16 36L27 35L23 25" : "M60 36L49 35L53 25"}
        initial={initialPathMotion}
        pathLength={1}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        transition={{
          delay:
            wizardCalloutArrowDelaySeconds +
            wizardCalloutArrowDurationSeconds * 0.72,
          duration: prefersReducedMotion ? 0 : 0.12,
          ease: [0.22, 1, 0.36, 1],
        }}
      />
    </motion.svg>
  );
}

function layoutWizardCalloutGlyphs() {
  const glyphs: WizardCalloutPositionedGlyph[] = [];
  let delaySeconds = 0;
  let glyphIndex = 0;

  wizardCalloutLines.forEach((line, lineIndex) => {
    let x = line.x;

    if (lineIndex > 0) {
      delaySeconds += wizardCalloutLinePauseSeconds;
    }

    for (const character of line.text) {
      if (character === " ") {
        x += 6;
        delaySeconds += wizardCalloutWordPauseSeconds;
        continue;
      }

      if (!isWizardCalloutCharacter(character)) {
        throw new Error(`Unsupported wizard callout character: ${character}`);
      }

      const glyph = wizardCalloutGlyphs[character];

      glyphs.push({
        character,
        delaySeconds,
        index: glyphIndex,
        strokes: glyph.strokes,
        x,
        y: line.y,
      });

      x += glyph.advance;
      delaySeconds += wizardCalloutGlyphIntervalSeconds;
      glyphIndex += 1;
    }
  });

  return glyphs;
}

function isWizardCalloutCharacter(
  character: string,
): character is keyof typeof wizardCalloutGlyphs {
  return Object.hasOwn(wizardCalloutGlyphs, character);
}

export { WizardHandwrittenCallout };
export type { WizardHandwrittenCalloutProps };

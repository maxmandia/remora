export type NormalizedPoint = {
  x: number;
  y: number;
};

export type NormalizedRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export type CursorStep =
  | {
      durationMs: number;
      kind: "clearText";
    }
  | {
      durationMs: number;
      kind: "hide";
    }
  | {
      durationMs: number;
      kind: "idle";
    }
  | {
      drawsBox?: boolean;
      durationMs: number;
      kind: "move";
      to: NormalizedPoint;
    }
  | {
      durationMs: number;
      kind: "removeBox";
    }
  | {
      durationMs: number;
      kind: "resizeBox";
      to: NormalizedRect;
    }
  | {
      durationMs: number;
      kind: "revealMedia";
    }
  | {
      durationMs: number;
      kind: "show";
    }
  | {
      durationMs: number;
      kind: "swapMedia";
    }
  | {
      durationMs: number;
      kind: "type";
      text: string;
    };

export type CursorScript = {
  /**
   * Index of the step the script loops back to after the last step
   * completes, making the script infinite. The steps before it are an intro
   * played once; the steps from it onward repeat forever and must leave the
   * scene in the same state they found it (media parity aside). Omit for
   * scripts that end.
   */
  loopFromStep?: number;
  start: NormalizedPoint;
  steps: CursorStep[];
};

export type CursorBox = {
  /**
   * Which of the box's media is being revealed: 0 for the first (the image),
   * incremented by each `swapMedia` step (1 for the video).
   */
  mediaIndex: number;
  /**
   * How far the box's current media has faded in over the skeleton, from 0
   * (skeleton only) to 1 (fully revealed). Driven by `revealMedia` steps and
   * reset by `swapMedia` steps.
   */
  mediaProgress: number;
  rect: NormalizedRect;
  /**
   * How far the box has morphed into a loading skeleton, from 0 (still an
   * input box) to 1 (fully a skeleton). Driven by `resizeBox` steps.
   */
  skeletonProgress: number;
  text: string;
};

export type CursorFrame = {
  boxes: CursorBox[];
  cursorHidden: boolean;
  done: boolean;
  position: NormalizedPoint;
};

export function easeInOutCubic(progress: number): number {
  const clamped = Math.min(1, Math.max(0, progress));

  return clamped < 0.5 ? 4 * clamped ** 3 : 1 - (-2 * clamped + 2) ** 3 / 2;
}

export function lerpPoint(
  from: NormalizedPoint,
  to: NormalizedPoint,
  progress: number,
): NormalizedPoint {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function lerpRect(
  from: NormalizedRect,
  to: NormalizedRect,
  progress: number,
): NormalizedRect {
  return {
    height: from.height + (to.height - from.height) * progress,
    width: from.width + (to.width - from.width) * progress,
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
  };
}

export function rectBetween(
  a: NormalizedPoint,
  b: NormalizedPoint,
): NormalizedRect {
  return {
    height: Math.abs(a.y - b.y),
    width: Math.abs(a.x - b.x),
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
  };
}

const BOX_MARGIN = 0.08;
/** Boxes read as prompt inputs: short and rounded, sized to their text. */
const BOX_HEIGHT = 0.08;
/** Vertical gap between the image square and the video prompt box. */
const VIDEO_BOX_GAP = 0.04;
const IDLE_RANGE_MS = { max: 2000, min: 300 };
const DRAW_RANGE_MS = { max: 1900, min: 1200 };
const RETURN_RANGE_MS = { max: 550, min: 350 };
const PRE_TYPE_IDLE_RANGE_MS = { max: 450, min: 150 };
const TYPE_MS_PER_CHAR_RANGE = { max: 70, min: 35 };
const REAPPEAR_IDLE_RANGE_MS = { max: 550, min: 250 };
const CORNER_MOVE_RANGE_MS = { max: 600, min: 350 };
const PRE_RESIZE_IDLE_RANGE_MS = { max: 450, min: 200 };
const RESIZE_RANGE_MS = { max: 1400, min: 900 };
/** How long the skeleton "loads" before its media resolves. */
const SKELETON_DWELL_RANGE_MS = { max: 3200, min: 1800 };
const MEDIA_REVEAL_RANGE_MS = { max: 1100, min: 700 };
/** The beat after the image reveals before the cursor moves on. */
const POST_REVEAL_IDLE_RANGE_MS = { max: 900, min: 400 };
const TRAVEL_RANGE_MS = { max: 800, min: 500 };
const PRE_DRAW_IDLE_RANGE_MS = { max: 500, min: 200 };
/** The beat after the video prompt is typed before it "submits". */
const SUBMIT_IDLE_RANGE_MS = { max: 1100, min: 600 };
/** Where the typing caret sits, normalized from the box's left edge. */
const TEXT_START_INSET = 0.02;
/** Keeps staggered cursors away from both ends of their lifecycle. */
const MIDDLE_LIFECYCLE_PROGRESS_RANGE = { max: 0.8, min: 0.2 };

function randomInRange(
  random: () => number,
  range: { max: number; min: number },
): number {
  return range.min + (range.max - range.min) * random();
}

function drawStartPoint(
  box: NormalizedRect,
  drawsUpward: boolean,
): NormalizedPoint {
  return { x: box.x, y: drawsUpward ? box.y + box.height : box.y };
}

/**
 * The shared input-box gesture: drag the box out left to right, glide back to
 * its left edge, vanish, and type the prompt. Assumes the cursor is already
 * at the box's draw start corner.
 */
function inputBoxSteps(
  random: () => number,
  box: NormalizedRect,
  drawsUpward: boolean,
  text: string,
): CursorStep[] {
  return [
    {
      drawsBox: true,
      durationMs: randomInRange(random, DRAW_RANGE_MS),
      kind: "move",
      to: {
        x: box.x + box.width,
        y: drawsUpward ? box.y : box.y + box.height,
      },
    },
    {
      durationMs: randomInRange(random, RETURN_RANGE_MS),
      kind: "move",
      to: { x: box.x + TEXT_START_INSET, y: box.y + box.height / 2 },
    },
    { durationMs: 0, kind: "hide" },
    {
      durationMs: randomInRange(random, PRE_TYPE_IDLE_RANGE_MS),
      kind: "idle",
    },
    {
      durationMs: text.length * randomInRange(random, TYPE_MS_PER_CHAR_RANGE),
      kind: "type",
      text,
    },
  ];
}

type PromptBoxScriptPrompt = {
  /** Normalized width the prompt needs, measured by the caller. */
  boxWidth: number;
  prompt: string;
};

export type PromptBoxScriptPair = {
  image: PromptBoxScriptPrompt;
  video: PromptBoxScriptPrompt;
};

export type PromptBoxScriptOptions = PromptBoxScriptPair & {
  /**
   * Additional image/video prompt pairs to visit before the loop returns to
   * the first pair. Their order is preserved, allowing the caller to shuffle
   * it once per cursor while keeping the animation deterministic afterward.
   */
  alternates?: readonly PromptBoxScriptPair[];
  /**
   * Normalized prompt-box height. Defaults to the desktop single-line height;
   * callers can provide a taller value for wrapped mobile prompts.
   */
  boxHeight?: number;
  /**
   * Where the media-and-prompt column sits within its available vertical
   * range: 0 at the top and 1 at the bottom. Defaults to a random position.
   */
  verticalPosition?: number;
  /**
   * Normalized dimensions of the loading skeleton, precomputed by the caller
   * so it renders as a pixel square. The width is expected to be at most the
   * image prompt's width so the resize drags up and to the left.
   */
  squareSize: { height: number; width: number };
  /**
   * Normalized vertical band the whole column (square + prompt boxes) must
   * stay inside, e.g. to keep clear of the wordmark. Defaults to the full
   * section.
   */
  verticalBounds?: { max: number; min: number };
};

/**
 * The tallest skeleton square whose column (square, gap, and prompt box,
 * inside the margins) fits in a vertical band of the given normalized span.
 */
export function maxSquareHeight(
  boundsSpan: number,
  boxHeight = BOX_HEIGHT,
): number {
  return boundsSpan - 2 * BOX_MARGIN - VIDEO_BOX_GAP - boxHeight;
}

/**
 * One repeating beat of the loop: the cursor reappears, glides to the prompt
 * box's draw start below the media square, performs the input-box gesture,
 * and on submit the input vanishes while the media flips back to the
 * skeleton in place, dwells, and resolves into the next media.
 */
function promptCycleSteps(
  random: () => number,
  box: NormalizedRect,
  drawsUpward: boolean,
  text: string,
): CursorStep[] {
  return [
    {
      durationMs: randomInRange(random, POST_REVEAL_IDLE_RANGE_MS),
      kind: "idle",
    },
    { durationMs: 0, kind: "show" },
    {
      durationMs: randomInRange(random, TRAVEL_RANGE_MS),
      kind: "move",
      to: drawStartPoint(box, drawsUpward),
    },
    {
      durationMs: randomInRange(random, PRE_DRAW_IDLE_RANGE_MS),
      kind: "idle",
    },
    ...inputBoxSteps(random, box, drawsUpward, text),
    { durationMs: randomInRange(random, SUBMIT_IDLE_RANGE_MS), kind: "idle" },
    { durationMs: 0, kind: "removeBox" },
    { durationMs: 0, kind: "swapMedia" },
    {
      durationMs: randomInRange(random, SKELETON_DWELL_RANGE_MS),
      kind: "idle",
    },
    {
      durationMs: randomInRange(random, MEDIA_REVEAL_RANGE_MS),
      kind: "revealMedia",
    },
  ];
}

/**
 * Builds the endless performance for one section, sharing one media square.
 * The intro plays once: the cursor drags an input box out, types the image
 * prompt, reappears beside the last character, settles on the box's
 * top-right corner, the text clears, and the cursor drags that corner up and
 * to the left until the box becomes a square loading skeleton (anchored to
 * the box's bottom-left) that dwells and resolves into the image. From there
 * the script loops forever, alternating prompt cycles below the square: type
 * the current pair's video prompt and the square regenerates into its video,
 * then type the next pair's image prompt and regenerate into a different
 * image. Every alternate pair is visited before the loop returns to the
 * first one.
 * Box widths are clamped so everything fits inside the margins; every box
 * shares the same height, so only the column's position is randomized.
 * `random` is injected so callers can seed it and the output stays
 * deterministic.
 */
export function createPromptBoxScript(
  random: () => number,
  options: PromptBoxScriptOptions,
): CursorScript {
  const bounds = options.verticalBounds ?? { max: 1, min: 0 };
  const boxHeight = options.boxHeight ?? BOX_HEIGHT;
  const pairs = [
    { image: options.image, video: options.video },
    ...(options.alternates ?? []),
  ];
  const pairRects = pairs.map((pair) => ({
    imageWidth: Math.min(pair.image.boxWidth, 1 - 2 * BOX_MARGIN),
    videoWidth: Math.min(pair.video.boxWidth, 1 - 2 * BOX_MARGIN),
  }));
  const firstPairRect = pairRects[0];
  const imageWidth = firstPairRect?.imageWidth ?? 0;
  const maxPromptWidth = Math.max(
    ...pairRects.flatMap(({ imageWidth: pairImageWidth, videoWidth }) => [
      pairImageWidth,
      videoWidth,
    ]),
  );
  const squareWidth = Math.min(options.squareSize.width, imageWidth);
  const squareHeight = Math.max(
    0.02,
    Math.min(
      options.squareSize.height,
      maxSquareHeight(bounds.max - bounds.min, boxHeight),
    ),
  );
  const x = randomInRange(random, {
    max: 1 - BOX_MARGIN - maxPromptWidth,
    min: BOX_MARGIN,
  });
  const yMin = bounds.min + BOX_MARGIN + Math.max(0, squareHeight - boxHeight);
  const yMax = Math.max(
    yMin,
    bounds.max - BOX_MARGIN - boxHeight - VIDEO_BOX_GAP - boxHeight,
  );
  const y =
    options.verticalPosition === undefined
      ? randomInRange(random, { max: yMax, min: yMin })
      : yMin +
        (yMax - yMin) * Math.min(1, Math.max(0, options.verticalPosition));
  const imageBox = { height: boxHeight, width: imageWidth, x, y };
  const squareRect = {
    height: squareHeight,
    width: squareWidth,
    x,
    y: y + boxHeight - squareHeight,
  };
  const promptBoxY = y + boxHeight + VIDEO_BOX_GAP;
  const imageDrawsUpward = random() < 0.5;

  const introSteps: CursorStep[] = [
    { durationMs: randomInRange(random, IDLE_RANGE_MS), kind: "idle" },
    ...inputBoxSteps(random, imageBox, imageDrawsUpward, options.image.prompt),
    {
      durationMs: 0,
      kind: "move",
      to: {
        x: imageBox.x + imageBox.width - TEXT_START_INSET,
        y: imageBox.y + imageBox.height / 2,
      },
    },
    { durationMs: 0, kind: "show" },
    {
      durationMs: randomInRange(random, REAPPEAR_IDLE_RANGE_MS),
      kind: "idle",
    },
    {
      durationMs: randomInRange(random, CORNER_MOVE_RANGE_MS),
      kind: "move",
      to: { x: imageBox.x + imageBox.width, y: imageBox.y },
    },
    {
      durationMs: randomInRange(random, PRE_RESIZE_IDLE_RANGE_MS),
      kind: "idle",
    },
    { durationMs: 0, kind: "clearText" },
    {
      durationMs: randomInRange(random, RESIZE_RANGE_MS),
      kind: "resizeBox",
      to: squareRect,
    },
    {
      durationMs: randomInRange(random, SKELETON_DWELL_RANGE_MS),
      kind: "idle",
    },
    {
      durationMs: randomInRange(random, MEDIA_REVEAL_RANGE_MS),
      kind: "revealMedia",
    },
  ];

  return {
    loopFromStep: introSteps.length,
    start: drawStartPoint(imageBox, imageDrawsUpward),
    steps: [
      ...introSteps,
      ...pairs.flatMap((pair, index) => {
        const pairRect = pairRects[index];
        const nextPair = pairs[(index + 1) % pairs.length];
        const nextPairRect = pairRects[(index + 1) % pairs.length];

        if (!pairRect || !nextPair || !nextPairRect) {
          return [];
        }

        return [
          ...promptCycleSteps(
            random,
            {
              height: boxHeight,
              width: pairRect.videoWidth,
              x,
              y: promptBoxY,
            },
            random() < 0.5,
            pair.video.prompt,
          ),
          ...promptCycleSteps(
            random,
            {
              height: boxHeight,
              width: nextPairRect.imageWidth,
              x,
              y: promptBoxY,
            },
            random() < 0.5,
            nextPair.image.prompt,
          ),
        ];
      }),
    ],
  };
}

export function scriptDurationMs(script: CursorScript): number {
  return script.steps.reduce((total, step) => total + step.durationMs, 0);
}

/**
 * Chooses which cursors start at the beginning, then places every other
 * cursor at a random point in the middle of its own lifecycle.
 */
export function createLifecycleStartOffsets(
  durationsMs: number[],
  beginningIndexOptions: readonly (readonly number[])[],
  random: () => number,
): number[] {
  const beginningOptionIndex = Math.floor(
    random() * beginningIndexOptions.length,
  );
  const beginningIndices = new Set(
    beginningIndexOptions[beginningOptionIndex] ?? [],
  );

  return durationsMs.map((durationMs, index) =>
    beginningIndices.has(index)
      ? 0
      : durationMs * randomInRange(random, MIDDLE_LIFECYCLE_PROGRESS_RANGE),
  );
}

export function resolveCursorFrame(
  script: CursorScript,
  elapsedMs: number,
): CursorFrame {
  const boxes: CursorBox[] = [];
  let cursorHidden = false;
  let looping = false;
  let position = script.start;
  let remaining = Math.max(0, elapsedMs);

  if (script.loopFromStep !== undefined) {
    const introMs = script.steps
      .slice(0, script.loopFromStep)
      .reduce((total, step) => total + step.durationMs, 0);
    const cycleMs = script.steps
      .slice(script.loopFromStep)
      .reduce((total, step) => total + step.durationMs, 0);

    if (cycleMs > 0) {
      looping = true;

      if (!Number.isFinite(remaining)) {
        // The static "final" state of a looping script is the end of its
        // intro, e.g. the first media reveal for reduced-motion visitors.
        remaining = introMs;
      } else if (remaining >= introMs + cycleMs) {
        remaining = introMs + ((remaining - introMs) % cycleMs);
      }
    }
  }

  for (const step of script.steps) {
    const box = boxes[boxes.length - 1];

    if (remaining >= step.durationMs) {
      if (step.kind === "clearText") {
        if (box) {
          box.text = "";
        }
      } else if (step.kind === "hide") {
        cursorHidden = true;
      } else if (step.kind === "move") {
        if (step.drawsBox) {
          boxes.push({
            mediaIndex: 0,
            mediaProgress: 0,
            rect: rectBetween(position, step.to),
            skeletonProgress: 0,
            text: "",
          });
        }

        position = step.to;
      } else if (step.kind === "removeBox") {
        boxes.pop();
      } else if (step.kind === "resizeBox") {
        if (box) {
          box.rect = step.to;
          box.skeletonProgress = 1;
        }

        position = { x: step.to.x + step.to.width, y: step.to.y };
      } else if (step.kind === "revealMedia") {
        if (box) {
          box.mediaProgress = 1;
        }
      } else if (step.kind === "show") {
        cursorHidden = false;
      } else if (step.kind === "swapMedia") {
        if (box) {
          box.mediaIndex += 1;
          box.mediaProgress = 0;
        }
      } else if (step.kind === "type") {
        if (box) {
          box.text += step.text;
        }
      }

      remaining -= step.durationMs;
      continue;
    }

    if (step.kind === "move") {
      const current = lerpPoint(
        position,
        step.to,
        easeInOutCubic(remaining / step.durationMs),
      );

      if (step.drawsBox) {
        boxes.push({
          mediaIndex: 0,
          mediaProgress: 0,
          rect: rectBetween(position, current),
          skeletonProgress: 0,
          text: "",
        });
      }

      position = current;
    } else if (step.kind === "resizeBox") {
      if (box) {
        const progress = easeInOutCubic(remaining / step.durationMs);

        box.rect = lerpRect(box.rect, step.to, progress);
        box.skeletonProgress = progress;
        position = { x: box.rect.x + box.rect.width, y: box.rect.y };
      }
    } else if (step.kind === "revealMedia") {
      if (box) {
        box.mediaProgress = easeInOutCubic(remaining / step.durationMs);
      }
    } else if (step.kind === "type") {
      if (box) {
        const typedCharCount = Math.floor(
          (remaining / step.durationMs) * step.text.length,
        );

        box.text += step.text.slice(0, typedCharCount);
      }
    }

    return { boxes, cursorHidden, done: false, position };
  }

  return { boxes, cursorHidden, done: !looping, position };
}

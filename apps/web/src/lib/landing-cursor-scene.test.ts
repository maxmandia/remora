import { describe, expect, it } from "vitest";

import {
  createLifecycleStartOffsets,
  createPromptBoxScript,
  easeInOutCubic,
  rectBetween,
  resolveCursorFrame,
  scriptDurationMs,
  type CursorScript,
} from "./landing-cursor-scene";

function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1_664_525 + 1_013_904_223) % 2_147_483_647;
    return state / 2_147_483_647;
  };
}

function elapsedThroughStep(script: CursorScript, stepIndex: number): number {
  return script.steps
    .slice(0, stepIndex + 1)
    .reduce((total, step) => total + step.durationMs, 0);
}

const boxDrawScript: CursorScript = {
  start: { x: 0, y: 1 },
  steps: [
    { durationMs: 600, kind: "idle" },
    { drawsBox: true, durationMs: 1600, kind: "move", to: { x: 1, y: 0 } },
  ],
};

const typingScript: CursorScript = {
  start: { x: 0, y: 0 },
  steps: [
    { drawsBox: true, durationMs: 100, kind: "move", to: { x: 0.5, y: 0.2 } },
    { durationMs: 0, kind: "hide" },
    { durationMs: 300, kind: "type", text: "abc" },
  ],
};

const skeletonScript: CursorScript = {
  start: { x: 0.1, y: 0.5 },
  steps: [
    { drawsBox: true, durationMs: 100, kind: "move", to: { x: 0.6, y: 0.58 } },
    { durationMs: 100, kind: "type", text: "hi" },
    { durationMs: 0, kind: "show" },
    { durationMs: 0, kind: "clearText" },
    {
      durationMs: 200,
      kind: "resizeBox",
      to: { height: 0.3, width: 0.3, x: 0.1, y: 0.28 },
    },
    { durationMs: 100, kind: "idle" },
    { durationMs: 200, kind: "revealMedia" },
  ],
};

const loopScript: CursorScript = {
  loopFromStep: 2,
  start: { x: 0, y: 0 },
  steps: [
    { drawsBox: true, durationMs: 100, kind: "move", to: { x: 0.4, y: 0.1 } },
    { durationMs: 100, kind: "revealMedia" },
    { durationMs: 100, kind: "idle" },
    { durationMs: 0, kind: "swapMedia" },
    { durationMs: 100, kind: "revealMedia" },
  ],
};

const mediaSwapScript: CursorScript = {
  start: { x: 0.1, y: 0.1 },
  steps: [
    { drawsBox: true, durationMs: 100, kind: "move", to: { x: 0.5, y: 0.18 } },
    { durationMs: 100, kind: "revealMedia" },
    { durationMs: 100, kind: "move", to: { x: 0.1, y: 0.3 } },
    { drawsBox: true, durationMs: 100, kind: "move", to: { x: 0.5, y: 0.38 } },
    { durationMs: 100, kind: "type", text: "go" },
    { durationMs: 100, kind: "idle" },
    { durationMs: 0, kind: "removeBox" },
    { durationMs: 0, kind: "swapMedia" },
    { durationMs: 100, kind: "idle" },
    { durationMs: 200, kind: "revealMedia" },
  ],
};

describe("easeInOutCubic", () => {
  it("maps the endpoints and midpoint exactly", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(1)).toBe(1);
  });

  it("clamps progress outside the unit range", () => {
    expect(easeInOutCubic(-2)).toBe(0);
    expect(easeInOutCubic(3)).toBe(1);
  });
});

describe("rectBetween", () => {
  it("normalizes inverted corners into a positive rect", () => {
    expect(rectBetween({ x: 1, y: 0 }, { x: 0.25, y: 0.5 })).toEqual({
      height: 0.5,
      width: 0.75,
      x: 0.25,
      y: 0,
    });
  });
});

describe("scriptDurationMs", () => {
  it("sums the step durations", () => {
    expect(scriptDurationMs(boxDrawScript)).toBe(2200);
  });
});

describe("createLifecycleStartOffsets", () => {
  it("starts exactly two cursors at zero and the rest within the middle of their lifecycle", () => {
    const durationsMs = [10_000, 12_000, 14_000, 16_000, 18_000, 20_000];
    const beginningIndexOptions = [
      [0, 4],
      [0, 5],
      [1, 5],
    ];

    for (let seed = 1; seed <= 100; seed += 1) {
      const offsets = createLifecycleStartOffsets(
        durationsMs,
        beginningIndexOptions,
        createSeededRandom(seed),
      );
      const beginningIndices = offsets.flatMap((offset, index) =>
        offset === 0 ? [index] : [],
      );

      expect(beginningIndices).toHaveLength(2);
      expect(beginningIndexOptions).toContainEqual(beginningIndices);

      offsets.forEach((offset, index) => {
        if (offset === 0) {
          return;
        }

        expect(offset).toBeGreaterThanOrEqual(durationsMs[index] * 0.2);
        expect(offset).toBeLessThanOrEqual(durationsMs[index] * 0.8);
      });
    }
  });
});

describe("createPromptBoxScript", () => {
  const scriptOptions = {
    image: { boxWidth: 0.3, prompt: "A tiny robot watering a bonsai tree" },
    squareSize: { height: 0.2, width: 0.2 },
    video: { boxWidth: 0.35, prompt: "Make the robot bow after watering" },
  };

  it("plays the intro once and loops alternating prompt cycles", () => {
    const script = createPromptBoxScript(createSeededRandom(5), scriptOptions);
    const introKinds = [
      "idle",
      "move",
      "move",
      "hide",
      "idle",
      "type",
      "move",
      "show",
      "idle",
      "move",
      "idle",
      "clearText",
      "resizeBox",
      "idle",
      "revealMedia",
    ];
    const cycleKinds = [
      "idle",
      "show",
      "move",
      "idle",
      "move",
      "move",
      "hide",
      "idle",
      "type",
      "idle",
      "removeBox",
      "swapMedia",
      "idle",
      "revealMedia",
    ];

    expect(script.loopFromStep).toBe(introKinds.length);
    expect(script.steps.map((step) => step.kind)).toEqual([
      ...introKinds,
      ...cycleKinds,
      ...cycleKinds,
    ]);
  });

  it("visits alternate prompt pairs before returning to the first image", () => {
    const alternate = {
      image: { boxWidth: 0.28, prompt: "A fox asleep under a willow tree" },
      video: { boxWidth: 0.32, prompt: "Wake the fox as the branches sway" },
    };
    const script = createPromptBoxScript(createSeededRandom(5), {
      ...scriptOptions,
      alternates: [alternate],
    });
    const typeSteps = script.steps.filter((step) => step.kind === "type");
    const revealStepIndexes = script.steps.flatMap((step, index) =>
      step.kind === "revealMedia" ? [index] : [],
    );

    expect(typeSteps.map((step) => step.text)).toEqual([
      scriptOptions.image.prompt,
      scriptOptions.video.prompt,
      alternate.image.prompt,
      alternate.video.prompt,
      scriptOptions.image.prompt,
    ]);
    expect(
      revealStepIndexes.map(
        (stepIndex) =>
          resolveCursorFrame(script, elapsedThroughStep(script, stepIndex) - 1)
            .boxes[0].mediaIndex,
      ),
    ).toEqual([0, 1, 2, 3, 4]);
  });

  it("settles infinite elapsed time on the intro's image reveal, never done", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const script = createPromptBoxScript(
        createSeededRandom(seed),
        scriptOptions,
      );
      const settledFrame = resolveCursorFrame(script, Number.POSITIVE_INFINITY);
      const box = settledFrame.boxes[0];

      expect(settledFrame.boxes).toHaveLength(1);
      expect(box.rect.width).toBeCloseTo(0.2);
      expect(box.rect.height).toBeCloseTo(0.2);
      expect(box.rect.x).toBeGreaterThanOrEqual(0.08);
      expect(box.rect.x + box.rect.width).toBeLessThanOrEqual(0.92);
      expect(box.rect.y).toBeGreaterThanOrEqual(0.08);
      expect(box.rect.y + box.rect.height).toBeLessThanOrEqual(0.92);
      expect(box.mediaIndex).toBe(0);
      expect(box.mediaProgress).toBe(1);
      expect(box.skeletonProgress).toBe(1);
      expect(box.text).toBe("");
      expect(settledFrame.cursorHidden).toBe(false);
      expect(settledFrame.done).toBe(false);
      expect(script.start.x).toBe(box.rect.x);
    }
  });

  it("keeps the whole column inside the given vertical bounds", () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const script = createPromptBoxScript(createSeededRandom(seed), {
        ...scriptOptions,
        verticalBounds: { max: 1, min: 0.55 },
      });
      const settledFrame = resolveCursorFrame(script, Number.POSITIVE_INFINITY);
      const square = settledFrame.boxes[0].rect;
      const promptBox = script.steps.find(
        (step) => step.kind === "move" && step.drawsBox,
      );

      expect(square.y).toBeGreaterThanOrEqual(0.55 + 0.08);
      // The prompt box sits below the square with a 0.04 gap and 0.08 height.
      expect(square.y + square.height + 0.04 + 0.08).toBeLessThanOrEqual(
        1 - 0.08 + 1e-9,
      );
      expect(promptBox).toBeDefined();
    }
  });

  it("places the column at a requested point in its available vertical range", () => {
    const topScript = createPromptBoxScript(createSeededRandom(5), {
      ...scriptOptions,
      verticalPosition: 0,
    });
    const bottomScript = createPromptBoxScript(createSeededRandom(5), {
      ...scriptOptions,
      verticalPosition: 1,
    });
    const topBox = resolveCursorFrame(
      topScript,
      elapsedThroughStep(topScript, 1),
    ).boxes[0];
    const bottomBox = resolveCursorFrame(
      bottomScript,
      elapsedThroughStep(bottomScript, 1),
    ).boxes[0];

    expect(topBox.rect.y).toBeCloseTo(0.2);
    expect(bottomBox.rect.y).toBeCloseTo(0.72);
  });

  it("draws the video prompt box just below the revealed image", () => {
    const script = createPromptBoxScript(createSeededRandom(9), scriptOptions);
    const typeStepIndex = 23;

    expect(script.steps[typeStepIndex]?.kind).toBe("type");

    const frame = resolveCursorFrame(
      script,
      elapsedThroughStep(script, typeStepIndex) + 1,
    );
    const [imageBox, videoPromptBox] = frame.boxes;

    expect(frame.boxes).toHaveLength(2);
    expect(imageBox.mediaIndex).toBe(0);
    expect(imageBox.mediaProgress).toBe(1);
    expect(videoPromptBox.text).toBe(scriptOptions.video.prompt);
    expect(videoPromptBox.rect.width).toBeCloseTo(0.35);
    expect(videoPromptBox.rect.y).toBeCloseTo(
      imageBox.rect.y + imageBox.rect.height + 0.04,
    );
    expect(videoPromptBox.rect.x).toBeCloseTo(imageBox.rect.x);
  });

  it("uses a taller requested height for wrapped prompt boxes", () => {
    const boxHeight = 0.14;
    const script = createPromptBoxScript(createSeededRandom(9), {
      ...scriptOptions,
      boxHeight,
    });
    const imagePromptBox = resolveCursorFrame(
      script,
      elapsedThroughStep(script, 1),
    ).boxes[0];
    const typeStepIndex = 23;
    const frame = resolveCursorFrame(
      script,
      elapsedThroughStep(script, typeStepIndex) + 1,
    );
    const [imageBox, videoPromptBox] = frame.boxes;

    expect(imagePromptBox.rect.height).toBeCloseTo(boxHeight);
    expect(videoPromptBox.rect.height).toBeCloseTo(boxHeight);
    expect(videoPromptBox.rect.y).toBeCloseTo(
      imageBox.rect.y + imageBox.rect.height + 0.04,
    );
  });

  it("stays hidden while the image prompt types out", () => {
    const script = createPromptBoxScript(createSeededRandom(11), scriptOptions);
    const frame = resolveCursorFrame(script, elapsedThroughStep(script, 5) - 1);

    expect(script.steps[5]?.kind).toBe("type");
    expect(frame.cursorHidden).toBe(true);
    expect(frame.boxes[0].text.length).toBeGreaterThan(0);
    expect(scriptOptions.image.prompt.startsWith(frame.boxes[0].text)).toBe(
      true,
    );
  });

  it("clamps the requested width so the input box still fits inside the margins", () => {
    const script = createPromptBoxScript(createSeededRandom(3), {
      ...scriptOptions,
      image: { boxWidth: 0.95, prompt: "A very long prompt" },
    });
    const box = resolveCursorFrame(script, elapsedThroughStep(script, 1))
      .boxes[0];

    expect(box.rect.width).toBeCloseTo(0.84);
    expect(box.rect.x).toBeCloseTo(0.08);
  });

  it("is deterministic for the same random sequence", () => {
    expect(createPromptBoxScript(createSeededRandom(7), scriptOptions)).toEqual(
      createPromptBoxScript(createSeededRandom(7), scriptOptions),
    );
  });
});

describe("resolveCursorFrame", () => {
  it("holds the start position while idling", () => {
    expect(resolveCursorFrame(boxDrawScript, 0)).toEqual({
      boxes: [],
      cursorHidden: false,
      done: false,
      position: { x: 0, y: 1 },
    });
    expect(resolveCursorFrame(boxDrawScript, 300).position).toEqual({
      x: 0,
      y: 1,
    });
  });

  it("expands the box from the move origin to the cursor position", () => {
    const frame = resolveCursorFrame(boxDrawScript, 600 + 800);

    expect(frame.done).toBe(false);
    expect(frame.position).toEqual({ x: 0.5, y: 0.5 });
    expect(frame.boxes).toEqual([
      {
        mediaIndex: 0,
        mediaProgress: 0,
        rect: { height: 0.5, width: 0.5, x: 0, y: 0.5 },
        skeletonProgress: 0,
        text: "",
      },
    ]);
  });

  it("keeps the completed box and final position past the script end", () => {
    const frame = resolveCursorFrame(boxDrawScript, 10_000);

    expect(frame).toEqual({
      boxes: [
        {
          mediaIndex: 0,
          mediaProgress: 0,
          rect: { height: 1, width: 1, x: 0, y: 0 },
          skeletonProgress: 0,
          text: "",
        },
      ],
      cursorHidden: false,
      done: true,
      position: { x: 1, y: 0 },
    });
  });

  it("hides the cursor and types into the latest box character by character", () => {
    const midTypeFrame = resolveCursorFrame(typingScript, 100 + 150);

    expect(midTypeFrame.cursorHidden).toBe(true);
    expect(midTypeFrame.done).toBe(false);
    expect(midTypeFrame.boxes[0].text).toBe("a");

    expect(resolveCursorFrame(typingScript, 100).boxes[0].text).toBe("");
    expect(resolveCursorFrame(typingScript, 100 + 250).boxes[0].text).toBe(
      "ab",
    );
    expect(resolveCursorFrame(typingScript, 10_000).boxes[0].text).toBe("abc");
  });

  it("reshows the cursor, clears text, and morphs the box into the skeleton", () => {
    const beforeResizeFrame = resolveCursorFrame(skeletonScript, 200);
    const beforeBox = beforeResizeFrame.boxes[0];

    expect(beforeResizeFrame.cursorHidden).toBe(false);
    expect(beforeBox.skeletonProgress).toBe(0);
    expect(beforeBox.text).toBe("");
    expect(beforeBox.rect.height).toBeCloseTo(0.08);
    expect(beforeBox.rect.width).toBeCloseTo(0.5);
    expect(beforeBox.rect.x).toBeCloseTo(0.1);
    expect(beforeBox.rect.y).toBeCloseTo(0.5);

    const midResizeFrame = resolveCursorFrame(skeletonScript, 200 + 100);
    const midBox = midResizeFrame.boxes[0];

    expect(midBox.skeletonProgress).toBeCloseTo(0.5);
    expect(midBox.text).toBe("");
    expect(midBox.rect.height).toBeCloseTo(0.19);
    expect(midBox.rect.width).toBeCloseTo(0.4);
    expect(midBox.rect.x).toBeCloseTo(0.1);
    expect(midBox.rect.y).toBeCloseTo(0.39);
    expect(midResizeFrame.position.x).toBeCloseTo(0.5);
    expect(midResizeFrame.position.y).toBeCloseTo(0.39);

    const finalFrame = resolveCursorFrame(skeletonScript, 10_000);

    expect(finalFrame.boxes[0]).toEqual({
      mediaIndex: 0,
      mediaProgress: 1,
      rect: { height: 0.3, width: 0.3, x: 0.1, y: 0.28 },
      skeletonProgress: 1,
      text: "",
    });
    expect(finalFrame.position.x).toBeCloseTo(0.4);
    expect(finalFrame.position.y).toBeCloseTo(0.28);
    expect(finalFrame.done).toBe(true);
  });

  it("fades the media in over the settled skeleton", () => {
    const dwellFrame = resolveCursorFrame(skeletonScript, 450);

    expect(dwellFrame.boxes[0].skeletonProgress).toBe(1);
    expect(dwellFrame.boxes[0].mediaProgress).toBe(0);

    const midRevealFrame = resolveCursorFrame(skeletonScript, 500 + 100);

    expect(midRevealFrame.boxes[0].mediaProgress).toBeCloseTo(0.5);
    expect(midRevealFrame.boxes[0].skeletonProgress).toBe(1);
  });

  it("removes the prompt box and swaps the first box's media on submit", () => {
    const beforeSubmitFrame = resolveCursorFrame(mediaSwapScript, 550);

    expect(beforeSubmitFrame.boxes).toHaveLength(2);
    expect(beforeSubmitFrame.boxes[0].mediaIndex).toBe(0);
    expect(beforeSubmitFrame.boxes[0].mediaProgress).toBe(1);
    expect(beforeSubmitFrame.boxes[1].text).toBe("go");

    const dwellFrame = resolveCursorFrame(mediaSwapScript, 600);

    expect(dwellFrame.boxes).toHaveLength(1);
    expect(dwellFrame.boxes[0].mediaIndex).toBe(1);
    expect(dwellFrame.boxes[0].mediaProgress).toBe(0);

    const finalFrame = resolveCursorFrame(mediaSwapScript, 10_000);

    expect(finalFrame.boxes).toHaveLength(1);
    expect(finalFrame.boxes[0].mediaIndex).toBe(1);
    expect(finalFrame.boxes[0].mediaProgress).toBe(1);
    expect(finalFrame.done).toBe(true);
  });

  it("wraps looping scripts back to the loop step forever", () => {
    const firstPassFrame = resolveCursorFrame(loopScript, 350);

    expect(firstPassFrame.boxes[0].mediaIndex).toBe(1);
    expect(firstPassFrame.boxes[0].mediaProgress).toBeCloseTo(0.5);
    expect(firstPassFrame.done).toBe(false);

    // 400ms is one full pass; 650ms lands 50ms into the loop's second cycle,
    // equivalent to 250ms on the first pass.
    const wrappedFrame = resolveCursorFrame(loopScript, 650);
    const equivalentFrame = resolveCursorFrame(loopScript, 250);

    expect(wrappedFrame).toEqual(equivalentFrame);
    expect(wrappedFrame.boxes[0].mediaIndex).toBe(0);
    expect(wrappedFrame.boxes[0].mediaProgress).toBe(1);
    expect(wrappedFrame.done).toBe(false);

    const distantFrame = resolveCursorFrame(loopScript, 400 * 1000 + 350);

    expect(distantFrame).toEqual(firstPassFrame);
  });

  it("settles looping scripts at the end of their intro for infinite elapsed time", () => {
    const settledFrame = resolveCursorFrame(
      loopScript,
      Number.POSITIVE_INFINITY,
    );

    expect(settledFrame.boxes[0].mediaIndex).toBe(0);
    expect(settledFrame.boxes[0].mediaProgress).toBe(1);
    expect(settledFrame.done).toBe(false);
  });

  it("resolves the fully composed state for an infinite elapsed time", () => {
    expect(resolveCursorFrame(typingScript, Number.POSITIVE_INFINITY)).toEqual(
      resolveCursorFrame(typingScript, scriptDurationMs(typingScript)),
    );
    expect(
      resolveCursorFrame(mediaSwapScript, Number.POSITIVE_INFINITY),
    ).toEqual(
      resolveCursorFrame(mediaSwapScript, scriptDurationMs(mediaSwapScript)),
    );
  });

  it("completes zero-duration steps instantly", () => {
    const frame = resolveCursorFrame(
      {
        start: { x: 0, y: 0 },
        steps: [
          { drawsBox: true, durationMs: 0, kind: "move", to: { x: 1, y: 1 } },
        ],
      },
      0,
    );

    expect(frame).toEqual({
      boxes: [
        {
          mediaIndex: 0,
          mediaProgress: 0,
          rect: { height: 1, width: 1, x: 0, y: 0 },
          skeletonProgress: 0,
          text: "",
        },
      ],
      cursorHidden: false,
      done: true,
      position: { x: 1, y: 1 },
    });
  });

  it("clamps negative elapsed time to the script start", () => {
    expect(resolveCursorFrame(boxDrawScript, -500).position).toEqual({
      x: 0,
      y: 1,
    });
  });
});

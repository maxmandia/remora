type GenerationCommandMode = "generation" | "prompt-builder";

type GenerationCommandPhase =
  | "generation"
  | "entering-prompt-builder"
  | "prompt-builder"
  | "returning-generation";

type GenerationChromeMotionState = "entering" | "exiting" | "visible";

const generationChromeTransitionDurationMs = 260;

function getGenerationCommandMode(
  phase: GenerationCommandPhase,
): GenerationCommandMode {
  return phase === "generation" || phase === "returning-generation"
    ? "generation"
    : "prompt-builder";
}

export { generationChromeTransitionDurationMs, getGenerationCommandMode };
export type {
  GenerationChromeMotionState,
  GenerationCommandMode,
  GenerationCommandPhase,
};

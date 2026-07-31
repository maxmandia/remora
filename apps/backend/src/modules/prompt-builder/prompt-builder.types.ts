export type PromptBuilderInput = {
  modelId: string;
  prompt: string;
};

export type PromptBuilderImageResult = {
  modelId: string;
  modelType: "image";
  prompt: string;
};

export type PromptBuilderVideoResult = {
  modelId: string;
  modelType: "video";
  prompt: string;
  duration: number;
};

export type PromptBuilderResult =
  | PromptBuilderImageResult
  | PromptBuilderVideoResult;

export class PromptBuilderResultUnavailableError extends Error {
  readonly code = "PROMPT_BUILDER_RESULT_UNAVAILABLE";

  constructor() {
    super("OpenAI did not return a built prompt");
    this.name = "PromptBuilderResultUnavailableError";
  }
}

export class PromptBuilderModelUnavailableError extends Error {
  readonly code = "PROMPT_BUILDER_MODEL_UNAVAILABLE";

  constructor(modelId: string) {
    super(`Prompt builder model ${modelId} is unavailable`);
    this.name = "PromptBuilderModelUnavailableError";
  }
}

export class PromptBuilderDurationOptionsUnavailableError extends Error {
  readonly code = "PROMPT_BUILDER_DURATION_OPTIONS_UNAVAILABLE";

  constructor(modelId: string) {
    super(`Prompt builder model ${modelId} has no supported video durations`);
    this.name = "PromptBuilderDurationOptionsUnavailableError";
  }
}

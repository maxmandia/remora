import type { GenerationModelType } from "@remora/domain/generation-model/dto";

export type PromptBuilderInput = {
  modelType: GenerationModelType;
  prompt: string;
};

export type PromptBuilderImageResult = {
  modelType: "image";
  prompt: string;
};

export type PromptBuilderVideoResult = {
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

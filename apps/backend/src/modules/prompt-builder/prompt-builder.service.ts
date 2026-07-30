import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  getOpenAIClient,
  type OpenAIResponsesClient,
} from "../../clients/openai/openai.ts";
import type {
  PromptBuilderImageResult,
  PromptBuilderInput,
  PromptBuilderResult,
  PromptBuilderVideoResult,
} from "./prompt-builder.types.ts";
import { PromptBuilderResultUnavailableError } from "./prompt-builder.types.ts";
import {
  promptBuilderPromptMaxLength,
  videoPromptBuilderSystemPrompt,
} from "./prompt-builder.utils.ts";

export const promptBuilderModel = "gpt-5.6-luna";

const imagePromptBuilderResultSchema = z.strictObject({
  prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
});

const videoPromptBuilderResultSchema = z.strictObject({
  prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
  duration: z
    .number()
    .int()
    .positive()
    .describe("Recommended video duration in seconds."),
});

export class PromptBuilderService {
  private readonly client: OpenAIResponsesClient | null;

  constructor(client: OpenAIResponsesClient | null = null) {
    this.client = client;
  }

  async build(input: PromptBuilderInput): Promise<PromptBuilderResult> {
    if (input.modelType === "video") {
      const result = await this.buildVideo(input.prompt);

      return {
        modelType: "video",
        ...result,
      };
    }

    const result = await this.buildImage(input.prompt);

    return {
      modelType: "image",
      ...result,
    };
  }

  private async buildImage(
    prompt: string,
  ): Promise<Omit<PromptBuilderImageResult, "modelType">> {
    const response = await this.getClient().responses.parse({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: prompt,
      text: {
        format: zodTextFormat(
          imagePromptBuilderResultSchema,
          "image_prompt_builder_result",
        ),
      },
      store: false,
    });
    const result = response.output_parsed?.prompt.trim();

    if (!result) {
      throw new PromptBuilderResultUnavailableError();
    }

    return { prompt: result };
  }

  private async buildVideo(
    prompt: string,
  ): Promise<Omit<PromptBuilderVideoResult, "modelType">> {
    const response = await this.getClient().responses.parse({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: [
        {
          role: "developer",
          content: videoPromptBuilderSystemPrompt,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(
          videoPromptBuilderResultSchema,
          "video_prompt_builder_result",
        ),
      },
      store: false,
    });
    const result = response.output_parsed;
    const builtPrompt = result?.prompt.trim();

    if (!result || !builtPrompt) {
      throw new PromptBuilderResultUnavailableError();
    }

    return {
      prompt: builtPrompt,
      duration: result.duration,
    };
  }

  private getClient(): OpenAIResponsesClient {
    return this.client ?? getOpenAIClient();
  }
}

export const promptBuilderService = new PromptBuilderService();

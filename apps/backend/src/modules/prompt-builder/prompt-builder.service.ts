import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  getOpenAIClient,
  type OpenAIResponsesClient,
} from "../../clients/openai/openai.ts";
import {
  modelRepository,
  type ModelRepository,
} from "../model/model.repository.ts";
import type {
  PromptBuilderImageResult,
  PromptBuilderInput,
  PromptBuilderResult,
  PromptBuilderVideoResult,
} from "./prompt-builder.types.ts";
import {
  PromptBuilderDurationOptionsUnavailableError,
  PromptBuilderModelUnavailableError,
  PromptBuilderResultUnavailableError,
} from "./prompt-builder.types.ts";
import {
  getVideoPromptBuilderSystemPrompt,
  promptBuilderPromptMaxLength,
} from "./prompt-builder.utils.ts";

export const promptBuilderModel = "gpt-5.6-luna";

const imagePromptBuilderResultSchema = z.strictObject({
  prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
});

export class PromptBuilderService {
  private readonly client: OpenAIResponsesClient | null;
  private readonly repository: Pick<ModelRepository, "getPublishedModel">;

  constructor(
    client: OpenAIResponsesClient | null = null,
    repository: Pick<ModelRepository, "getPublishedModel"> = modelRepository,
  ) {
    this.client = client;
    this.repository = repository;
  }

  async build(input: PromptBuilderInput): Promise<PromptBuilderResult> {
    const model = await this.repository.getPublishedModel(input.modelId);

    if (!model) {
      throw new PromptBuilderModelUnavailableError(input.modelId);
    }

    if (model.type === "video") {
      const result = await this.buildVideo(input.prompt, model);

      return {
        modelId: model.id,
        modelType: "video",
        ...result,
      };
    }

    const result = await this.buildImage(input.prompt);

    return {
      modelId: model.id,
      modelType: "image",
      ...result,
    };
  }

  private async buildImage(
    prompt: string,
  ): Promise<Omit<PromptBuilderImageResult, "modelId" | "modelType">> {
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
    model: PublishedGenerationModelSummary,
  ): Promise<Omit<PromptBuilderVideoResult, "modelId" | "modelType">> {
    const durationOptions = this.getPositiveIntegerDurationOptions(model);
    const resultSchema = z.strictObject({
      prompt: z.string().min(1).max(promptBuilderPromptMaxLength),
      duration: z
        .literal(durationOptions)
        .describe("Recommended video duration in seconds."),
    });
    const response = await this.getClient().responses.parse({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: [
        {
          role: "developer",
          content: getVideoPromptBuilderSystemPrompt(durationOptions),
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      text: {
        format: zodTextFormat(
          resultSchema,
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

  private getPositiveIntegerDurationOptions(
    model: PublishedGenerationModelSummary,
  ): readonly [number, ...number[]] {
    const durationField = model.spec.fields.find(
      (field) => field.id === "duration",
    );
    const durationOptions = [
      ...new Set(
        durationField?.options
          ?.map((option) => option.value)
          .filter(
            (value): value is number =>
              typeof value === "number" &&
              Number.isInteger(value) &&
              value > 0,
          ) ?? [],
      ),
    ];

    if (durationOptions.length === 0) {
      throw new PromptBuilderDurationOptionsUnavailableError(model.id);
    }

    return durationOptions as [number, ...number[]];
  }

  private getClient(): OpenAIResponsesClient {
    return this.client ?? getOpenAIClient();
  }
}

export const promptBuilderService = new PromptBuilderService();

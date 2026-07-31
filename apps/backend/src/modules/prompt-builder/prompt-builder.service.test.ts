import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it, vi } from "vitest";

import {
  promptBuilderModel,
  PromptBuilderService,
} from "./prompt-builder.service.ts";
import {
  PromptBuilderDurationOptionsUnavailableError,
  PromptBuilderModelUnavailableError,
  PromptBuilderResultUnavailableError,
} from "./prompt-builder.types.ts";
import { getVideoPromptBuilderSystemPrompt } from "./prompt-builder.utils.ts";

vi.mock("../model/model.repository.ts", () => ({
  modelRepository: {},
}));

describe("PromptBuilderService", () => {
  it("builds a structured image prompt with GPT-5.6 Luna", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        prompt: "  A cinematic glass studio in a thunderstorm  ",
      },
    });
    const { getPublishedModel, service } = createService(
      parse,
      createModel("nano-banana-2", "image"),
    );

    await expect(
      service.build({
        modelId: "nano-banana-2",
        prompt: "A glass studio during a thunderstorm",
      }),
    ).resolves.toEqual({
      modelId: "nano-banana-2",
      modelType: "image",
      prompt: "A cinematic glass studio in a thunderstorm",
    });
    expect(getPublishedModel).toHaveBeenCalledWith("nano-banana-2");
    expect(parse).toHaveBeenCalledWith({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: "A glass studio during a thunderstorm",
      text: {
        format: {
          type: "json_schema",
          name: "image_prompt_builder_result",
          strict: true,
          schema: expect.objectContaining({
            type: "object",
            properties: {
              prompt: {
                type: "string",
                minLength: 1,
                maxLength: 10_000,
              },
            },
            required: ["prompt"],
            additionalProperties: false,
          }),
        },
      },
      store: false,
    });
  });

  it("builds a structured video prompt and duration with GPT-5.6 Luna", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        prompt: "  A cinematic glass studio in a thunderstorm  ",
        duration: 8,
      },
    });
    const durationOptions = [-1, 4, 8, 15];
    const { getPublishedModel, service } = createService(
      parse,
      createModel("seedance-2.0-video", "video", durationOptions),
    );

    await expect(
      service.build({
        modelId: "seedance-2.0-video",
        prompt: "A glass studio during a thunderstorm",
      }),
    ).resolves.toEqual({
      modelId: "seedance-2.0-video",
      modelType: "video",
      prompt: "A cinematic glass studio in a thunderstorm",
      duration: 8,
    });
    expect(getPublishedModel).toHaveBeenCalledWith("seedance-2.0-video");
    expect(parse).toHaveBeenCalledWith({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: [
        {
          role: "developer",
          content: getVideoPromptBuilderSystemPrompt([4, 8, 15]),
        },
        {
          role: "user",
          content: "A glass studio during a thunderstorm",
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "video_prompt_builder_result",
          strict: true,
          schema: expect.objectContaining({
            type: "object",
            properties: {
              prompt: {
                type: "string",
                minLength: 1,
                maxLength: 10_000,
              },
              duration: expect.objectContaining({
                type: "number",
                enum: [4, 8, 15],
                description: "Recommended video duration in seconds.",
              }),
            },
            required: ["prompt", "duration"],
            additionalProperties: false,
          }),
        },
      },
      store: false,
    });
  });

  it("rejects an empty model response", async () => {
    const { service } = createService(
      vi.fn().mockResolvedValue({ output_parsed: null }),
      createModel("nano-banana-2", "image"),
    );

    await expect(
      service.build({ modelId: "nano-banana-2", prompt: "A prompt" }),
    ).rejects.toBeInstanceOf(PromptBuilderResultUnavailableError);
  });

  it("rejects an unavailable target model before calling OpenAI", async () => {
    const parse = vi.fn();
    const { service } = createService(parse, null);

    await expect(
      service.build({ modelId: "missing-model", prompt: "A prompt" }),
    ).rejects.toBeInstanceOf(PromptBuilderModelUnavailableError);
    expect(parse).not.toHaveBeenCalled();
  });

  it("rejects video models without positive integer duration choices", async () => {
    const parse = vi.fn();
    const { service } = createService(
      parse,
      createModel("adaptive-only-video", "video", [-1]),
    );

    await expect(
      service.build({
        modelId: "adaptive-only-video",
        prompt: "A prompt",
      }),
    ).rejects.toBeInstanceOf(
      PromptBuilderDurationOptionsUnavailableError,
    );
    expect(parse).not.toHaveBeenCalled();
  });
});

function createService(
  parse: ReturnType<typeof vi.fn>,
  model: PublishedGenerationModelSummary | null,
) {
  const getPublishedModel = vi.fn().mockResolvedValue(model);

  return {
    getPublishedModel,
    service: new PromptBuilderService(
      {
        responses: { parse },
      } as unknown as ConstructorParameters<typeof PromptBuilderService>[0],
      { getPublishedModel },
    ),
  };
}

function createModel(
  id: string,
  type: "image" | "video",
  durationOptions: number[] = [],
): PublishedGenerationModelSummary {
  return {
    id,
    type,
    spec: {
      fields: [
        {
          id: "duration",
          options: durationOptions.map((value) => ({
            label: `${value}s`,
            value,
          })),
        },
      ],
    },
  } as unknown as PublishedGenerationModelSummary;
}

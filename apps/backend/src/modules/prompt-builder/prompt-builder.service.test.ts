import { describe, expect, it, vi } from "vitest";

import {
  promptBuilderModel,
  PromptBuilderService,
} from "./prompt-builder.service.ts";
import { PromptBuilderResultUnavailableError } from "./prompt-builder.types.ts";
import { videoPromptBuilderSystemPrompt } from "./prompt-builder.utils.ts";

describe("PromptBuilderService", () => {
  it("builds a structured image prompt with GPT-5.6 Luna", async () => {
    const parse = vi.fn().mockResolvedValue({
      output_parsed: {
        prompt: "  A cinematic glass studio in a thunderstorm  ",
      },
    });
    const service = createService(parse);

    await expect(
      service.build({
        modelType: "image",
        prompt: "A glass studio during a thunderstorm",
      }),
    ).resolves.toEqual({
      modelType: "image",
      prompt: "A cinematic glass studio in a thunderstorm",
    });
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
    const service = createService(parse);

    await expect(
      service.build({
        modelType: "video",
        prompt: "A glass studio during a thunderstorm",
      }),
    ).resolves.toEqual({
      modelType: "video",
      prompt: "A cinematic glass studio in a thunderstorm",
      duration: 8,
    });
    expect(parse).toHaveBeenCalledWith({
      model: promptBuilderModel,
      reasoning: { effort: "none" },
      input: [
        {
          role: "developer",
          content: videoPromptBuilderSystemPrompt,
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
                type: "integer",
                exclusiveMinimum: 0,
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
    const service = createService(
      vi.fn().mockResolvedValue({ output_parsed: null }),
    );

    await expect(
      service.build({ modelType: "image", prompt: "A prompt" }),
    ).rejects.toBeInstanceOf(PromptBuilderResultUnavailableError);
  });
});

function createService(parse: ReturnType<typeof vi.fn>) {
  return new PromptBuilderService({
    responses: { parse },
  } as unknown as ConstructorParameters<typeof PromptBuilderService>[0]);
}

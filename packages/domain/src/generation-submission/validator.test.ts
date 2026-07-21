import { describe, expect, it } from "vitest";

import {
  createImageGenerationInputSchema,
  createVideoGenerationInputSchema,
  imageGenerationSubmissionInputSchema,
  videoGenerationSubmissionInputSchema,
} from "./validator.ts";

describe("generation submission validators", () => {
  const baseInput = {
    modelId: "generation-model",
    modelSpecId: "generation-model-v1",
    prompt: "  Quiet sea  ",
    resolution: "2k",
    aspectRatio: "1:1",
    requestedGenerations: 1,
    attachmentMedia: {
      images: [{ id: "image_1", role: "reference" as const }],
    },
  };

  it("normalizes the canonical image creation contract", () => {
    expect(createImageGenerationInputSchema.parse(baseInput)).toEqual({
      ...baseInput,
      prompt: "Quiet sea",
    });
  });

  it("rejects video-only image creation fields", () => {
    expect(() =>
      createImageGenerationInputSchema.parse({
        ...baseInput,
        duration: 5,
        generateAudio: false,
      }),
    ).toThrow();
  });

  it.each(["prompt", "resolution", "aspectRatio"] as const)(
    "requires %s for image creation",
    (fieldId) => {
      const input: Record<string, unknown> = { ...baseInput };
      delete input[fieldId];

      expect(() => createImageGenerationInputSchema.parse(input)).toThrow();
    },
  );

  it("preserves the existing video creation contract", () => {
    expect(
      createVideoGenerationInputSchema.parse({
        ...baseInput,
        duration: 5,
        generateAudio: true,
      }),
    ).toEqual({
      ...baseInput,
      prompt: "Quiet sea",
      duration: 5,
      generateAudio: true,
    });
  });

  it("rejects simultaneous thread and project targets", () => {
    expect(() =>
      createImageGenerationInputSchema.parse({
        ...baseInput,
        threadId: "thread_1",
        projectId: "project_1",
      }),
    ).toThrow();
  });

  it.each([0, 16, 1.5])(
    "rejects an invalid requested generation count of %s",
    (requestedGenerations) => {
      expect(() =>
        createImageGenerationInputSchema.parse({
          ...baseInput,
          requestedGenerations,
        }),
      ).toThrow();
    },
  );

  it("parses exact persisted video and image shapes", () => {
    expect(
      videoGenerationSubmissionInputSchema.parse({
        prompt: "  Quiet sea  ",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).toEqual({
      prompt: "Quiet sea",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    });
    expect(
      imageGenerationSubmissionInputSchema.parse({
        prompt: "  Quiet sea  ",
        resolution: "2k",
        aspectRatio: "1:1",
      }),
    ).toEqual({
      prompt: "Quiet sea",
      resolution: "2k",
      aspectRatio: "1:1",
    });
  });
});

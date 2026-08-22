import { describe, expect, it } from "vitest";

import {
  createImageGenerationInputSchema,
  createModel3dGenerationInputSchema,
  createVideoGenerationInputSchema,
  imageGenerationSubmissionInputSchema,
  model3dGenerationSubmissionInputSchema,
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

  it("defaults older video creation inputs to full quality", () => {
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
      draft: false,
    });
  });

  it("normalizes and defaults the model3d creation contract", () => {
    expect(
      createModel3dGenerationInputSchema.parse({
        modelId: "tripo-h3-1-text-to-3d",
        modelSpecId: "tripo-h3-1-text-to-3d-v1",
        prompt: "  A ceramic fox  ",
        faceLimit: null,
        geometryQuality: "standard",
        requestedGenerations: 1,
      }),
    ).toEqual({
      modelId: "tripo-h3-1-text-to-3d",
      modelSpecId: "tripo-h3-1-text-to-3d-v1",
      prompt: "A ceramic fox",
      textureLevel: "standard",
      faceLimit: null,
      geometryQuality: "standard",
      requestedGenerations: 1,
    });
  });

  it("accepts promptless model3d image input and rejects prompts over 1024 characters", () => {
    expect(
      createModel3dGenerationInputSchema.parse({
        modelId: "tripo-p1-image-to-3d",
        modelSpecId: "tripo-p1-image-to-3d-v1",
        prompt: "",
        textureLevel: "detailed",
        faceLimit: 20_000,
        geometryQuality: null,
        requestedGenerations: 1,
        attachmentMedia: {
          images: [{ id: "image_1", role: "reference" }],
        },
      }),
    ).toMatchObject({ prompt: "", textureLevel: "detailed" });

    expect(() =>
      createModel3dGenerationInputSchema.parse({
        modelId: "tripo-h3-1-text-to-3d",
        modelSpecId: "tripo-h3-1-text-to-3d-v1",
        prompt: "x".repeat(1_025),
        textureLevel: "standard",
        faceLimit: null,
        geometryQuality: "standard",
        requestedGenerations: 1,
      }),
    ).toThrow();
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
      draft: false,
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
    expect(
      model3dGenerationSubmissionInputSchema.parse({
        prompt: "",
        textureLevel: "standard",
        faceLimit: null,
        geometryQuality: null,
      }),
    ).toEqual({
      prompt: "",
      textureLevel: "standard",
      faceLimit: null,
      geometryQuality: null,
    });
  });
});

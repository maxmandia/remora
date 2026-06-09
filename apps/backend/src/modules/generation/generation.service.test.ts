import { beforeEach, describe, expect, it, vi } from "vitest";

import { generationService } from "./generation.service.ts";
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";

const mocks = vi.hoisted(() => ({
  getLatestPublishedGenerationModelSpec: vi.fn(),
  insertGenerationJob: vi.fn(),
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getLatestPublishedGenerationModelSpec:
      mocks.getLatestPublishedGenerationModelSpec,
    insertGenerationJob: mocks.insertGenerationJob,
  },
}));

describe("generation service", () => {
  beforeEach(() => {
    mocks.getLatestPublishedGenerationModelSpec.mockReset();
    mocks.insertGenerationJob.mockReset();
    mocks.getLatestPublishedGenerationModelSpec.mockResolvedValue({
      id: "seedance-2.0-video-v1",
      modelId: "seedance-2.0-video",
      providerId: "byteplus",
      spec: createSeedanceSpec(),
    });
    mocks.insertGenerationJob.mockResolvedValue(createJob());
  });

  it("rejects unsupported models before querying persistence", async () => {
    await expect(
      generationService.createVideoGenerationJob({
        userId: "user_1",
        input: createInput({
          modelId: "kling-v3-text-to-video",
        }),
      }),
    ).rejects.toBeInstanceOf(UnsupportedGenerationModelError);
    expect(mocks.getLatestPublishedGenerationModelSpec).not.toHaveBeenCalled();
    expect(mocks.insertGenerationJob).not.toHaveBeenCalled();
  });

  it("rejects aspect ratios outside the model spec options", async () => {
    await expect(
      generationService.createVideoGenerationJob({
        userId: "user_1",
        input: createInput({
          aspectRatio: "2:1",
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "aspectRatio",
    });
    expect(mocks.insertGenerationJob).not.toHaveBeenCalled();
  });

  it("rejects duration values outside the model spec options", async () => {
    await expect(
      generationService.createVideoGenerationJob({
        userId: "user_1",
        input: createInput({
          duration: 7,
        }),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "duration",
    });
    expect(mocks.insertGenerationJob).not.toHaveBeenCalled();
  });

  it("rejects prompts over the model spec max length", async () => {
    await expect(
      generationService.createVideoGenerationJob({
        userId: "user_1",
        input: createInput({
          prompt: "A prompt that is too long",
        }),
      }),
    ).rejects.toBeInstanceOf(GenerationInputValidationError);
    expect(mocks.insertGenerationJob).not.toHaveBeenCalled();
  });

  it("normalizes and creates valid Seedance generation jobs", async () => {
    const result = await generationService.createVideoGenerationJob({
      userId: "user_1",
      input: createInput({
        prompt: "  Quiet sea  ",
      }),
    });

    expect(result).toEqual({
      job: createJob(),
      callbackToken: expect.any(String),
    });
    expect(result.callbackToken).not.toHaveLength(0);
    expect(mocks.insertGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        input: createInput({
          prompt: "  Quiet sea  ",
        }),
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createSeedanceSpec(),
        },
        submittedInput: {
          prompt: "Quiet sea",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("passes existing thread ids through to persistence", async () => {
    await generationService.createVideoGenerationJob({
      userId: "user_1",
      input: createInput({
        threadId: "thread_1",
      }),
    });

    expect(mocks.insertGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          threadId: "thread_1",
        }),
      }),
    );
  });
});

function createInput(
  overrides: Partial<
    Parameters<typeof generationService.createVideoGenerationJob>[0]["input"]
  > = {},
) {
  return {
    modelId: "seedance-2.0-video",
    prompt: "Quiet sea",
    aspectRatio: "16:9",
    duration: 5,
    generateAudio: true,
    ...overrides,
  };
}

function createSeedanceSpec(): VideoModelSpec {
  return {
    schemaVersion: 1,
    id: "seedance-2.0-video",
    provider: "byteplus",
    providerModelId: "dreamina-seedance-2-0-260128",
    displayName: "Seedance 2.0",
    type: "video",
    status: "published",
    sourceUrls: [],
    endpoint: {
      method: "POST",
      path: "/contents/generations/tasks",
    },
    modelParameter: {
      path: ["model"],
      source: "spec",
    },
    fields: [
      createField({
        id: "prompt",
        valueKind: "string",
        maxLength: 10,
      }),
      createField({
        id: "aspectRatio",
        valueKind: "string",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
        ],
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        min: -1,
        max: 15,
        options: [
          { label: "Adaptive", value: -1 },
          { label: "5s", value: 5 },
          { label: "10s", value: 10 },
        ],
      }),
      createField({
        id: "generateAudio",
        valueKind: "boolean",
        options: [
          { label: "On", value: true },
          { label: "Off", value: false },
        ],
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: ["prompt"],
        advanced: false,
      },
    ],
    transforms: [{ kind: "seedanceContentArray" }],
    validationRules: ["seedance20ContentRules"],
  };
}

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  };
}

function createJob() {
  return {
    id: "job_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    status: "queued",
    submittedInput: {
      prompt: "Quiet sea",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: "callback-token-hash",
    providerId: "byteplus",
    providerTaskId: null,
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
  };
}

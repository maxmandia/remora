import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generationService } from "./generation.service.ts";
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";

const mocks = vi.hoisted(() => ({
  getLatestPublishedGenerationModelSpec: vi.fn(),
  getPublishedGenerationModelSpecById: vi.fn(),
  insertGenerationJob: vi.fn(),
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getLatestPublishedGenerationModelSpec:
      mocks.getLatestPublishedGenerationModelSpec,
    getPublishedGenerationModelSpecById:
      mocks.getPublishedGenerationModelSpecById,
    insertGenerationJob: mocks.insertGenerationJob,
  },
}));

describe("generation service", () => {
  beforeEach(() => {
    mocks.getLatestPublishedGenerationModelSpec.mockReset();
    mocks.getPublishedGenerationModelSpecById.mockReset();
    mocks.insertGenerationJob.mockReset();
    mocks.getLatestPublishedGenerationModelSpec.mockImplementation(
      async (modelId: string) => {
        if (modelId === "seedance-2.0-fast-video") {
          return createPublishedModelSpec({
            id: "seedance-2.0-fast-video-v1",
            modelId,
            spec: createSeedanceFastSpec(),
          });
        }

        if (modelId === "seedance-2.0-video") {
          return createPublishedModelSpec();
        }

        return null;
      },
    );
    mocks.getPublishedGenerationModelSpecById.mockImplementation(
      async ({
        modelId,
        modelSpecId,
      }: {
        modelId: string;
        modelSpecId: string;
      }) => {
        if (
          modelId === "seedance-2.0-fast-video" &&
          modelSpecId === "seedance-2.0-fast-video-v1"
        ) {
          return createPublishedModelSpec({
            id: modelSpecId,
            modelId,
            spec: createSeedanceFastSpec(),
          });
        }

        if (
          modelId === "seedance-2.0-video" &&
          modelSpecId === "seedance-2.0-video-v1"
        ) {
          return createPublishedModelSpec();
        }

        return null;
      },
    );
    mocks.insertGenerationJob.mockResolvedValue(createJob());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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
        modelSpec: createPublishedModelSpec(),
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

  it("normalizes and creates valid Seedance Fast generation jobs", async () => {
    const fastJob = createJob({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    mocks.insertGenerationJob.mockResolvedValueOnce(fastJob);

    const result = await generationService.createVideoGenerationJob({
      userId: "user_1",
      input: createInput({
        modelId: "seedance-2.0-fast-video",
      }),
    });

    expect(result.job).toMatchObject({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    expect(mocks.insertGenerationJob).toHaveBeenCalledWith(
      expect.objectContaining({
        input: createInput({
          modelId: "seedance-2.0-fast-video",
        }),
        modelSpec: createPublishedModelSpec({
          id: "seedance-2.0-fast-video-v1",
          modelId: "seedance-2.0-fast-video",
          spec: createSeedanceFastSpec(),
        }),
      }),
    );
  });

  it("creates provider tasks from the exact persisted model spec", async () => {
    const fetchMock = vi.fn(async (_url: URL | string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        model: "dreamina-seedance-2-0-fast-260128",
      });

      return new Response(JSON.stringify({ id: "cgt-fast" }), {
        status: 200,
      });
    });
    vi.stubEnv("BYTEPLUS_ARK_API_KEY", "ark-test-key");
    vi.stubEnv("BYTEPLUS_ARK_BASE_URL", "https://ark.example.test/api/v3");
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generationService.createSeedanceVideoTask({
        modelId: "seedance-2.0-fast-video",
        modelSpecId: "seedance-2.0-fast-video-v1",
        prompt: "Quiet sea",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).resolves.toEqual({
      provider: "byteplus",
      providerTaskId: "cgt-fast",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
    });
    expect(mocks.getPublishedGenerationModelSpecById).toHaveBeenCalledWith({
      modelId: "seedance-2.0-fast-video",
      modelSpecId: "seedance-2.0-fast-video-v1",
    });
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

function createPublishedModelSpec(
  overrides: Partial<{
    id: string;
    modelId: string;
    providerId: string;
    spec: VideoModelSpec;
  }> = {},
) {
  return {
    id: "seedance-2.0-video-v1",
    modelId: "seedance-2.0-video",
    providerId: "byteplus",
    spec: createSeedanceSpec(),
    ...overrides,
  };
}

function createSeedanceFastSpec(): VideoModelSpec {
  return createSeedanceSpec({
    id: "seedance-2.0-fast-video",
    providerModelId: "dreamina-seedance-2-0-fast-260128",
    displayName: "Seedance 2.0 Fast",
  });
}

function createSeedanceSpec(
  overrides: Partial<VideoModelSpec> = {},
): VideoModelSpec {
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
        providerPath: ["ratio"],
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
        ],
      }),
      createField({
        id: "duration",
        valueKind: "integer",
        providerPath: ["duration"],
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
        providerPath: ["generate_audio"],
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
    ...overrides,
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

function createJob(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

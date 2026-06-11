import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generationService } from "./generation.service.ts";
import {
  GenerationInputValidationError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";
import type { GenerationThreadJob } from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  createSignedGetUrlWithExpiration: vi.fn(),
  getLatestPublishedGenerationModelSpec: vi.fn(),
  getPublishedGenerationModelSpecById: vi.fn(),
  insertGenerationJob: vi.fn(),
  listGenerationsFromThread: vi.fn(),
}));

vi.mock("../storage/object-storage.service.ts", () => ({
  objectStorageService: {
    createSignedGetUrlWithExpiration: mocks.createSignedGetUrlWithExpiration,
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getLatestPublishedGenerationModelSpec:
      mocks.getLatestPublishedGenerationModelSpec,
    getPublishedGenerationModelSpecById:
      mocks.getPublishedGenerationModelSpecById,
    insertGenerationJob: mocks.insertGenerationJob,
    listGenerationsFromThread: mocks.listGenerationsFromThread,
  },
}));

describe("generation service", () => {
  beforeEach(() => {
    mocks.createSignedGetUrlWithExpiration.mockReset();
    mocks.getLatestPublishedGenerationModelSpec.mockReset();
    mocks.getPublishedGenerationModelSpecById.mockReset();
    mocks.insertGenerationJob.mockReset();
    mocks.listGenerationsFromThread.mockReset();
    mocks.createSignedGetUrlWithExpiration.mockImplementation(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
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
    mocks.listGenerationsFromThread.mockResolvedValue([]);
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

  it("signs stored video asset URLs into thread list results", async () => {
    mocks.listGenerationsFromThread.mockResolvedValueOnce([
      createThreadJob({
        result: {
          assets: [
            {
              kind: "video",
              bucket: "remora-dev-media",
              objectKey: "jobs/job_1/video.mp4",
              contentType: "video/mp4",
              contentLength: 1234,
              etag: '"video-etag"',
              checksumSha256: "video-sha256",
              sourceProviderUrl: "https://provider.example/video.mp4",
            },
          ],
        },
      }),
    ]);

    await expect(
      generationService.listGenerationsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          videoUrl: "https://signed.example/jobs/job_1/video.mp4",
          lastFrameUrl: null,
          mediaUrlExpiresAt: "2026-06-05T00:17:00.000Z",
        }),
      }),
    ]);
    expect(mocks.listGenerationsFromThread).toHaveBeenCalledWith({
      userId: "user_1",
      threadId: "thread_1",
    });
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "jobs/job_1/video.mp4",
    });
  });

  it("signs stored last-frame asset URLs into thread list results", async () => {
    mocks.listGenerationsFromThread.mockResolvedValueOnce([
      createThreadJob({
        result: {
          videoUrl: "https://provider.example/video.mp4",
          lastFrameUrl: "https://provider.example/last-frame.png",
          assets: [
            {
              kind: "last_frame",
              bucket: "remora-dev-media",
              objectKey: "jobs/job_1/last-frame.png",
              contentType: "image/png",
              contentLength: 4321,
              etag: '"last-frame-etag"',
              checksumSha256: "last-frame-sha256",
              sourceProviderUrl: "https://provider.example/last-frame.png",
            },
          ],
        },
      }),
    ]);

    await expect(
      generationService.listGenerationsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        result: expect.objectContaining({
          videoUrl: "https://provider.example/video.mp4",
          lastFrameUrl: "https://signed.example/jobs/job_1/last-frame.png",
          mediaUrlExpiresAt: "2026-06-05T00:17:00.000Z",
        }),
      }),
    ]);
    expect(mocks.createSignedGetUrlWithExpiration).toHaveBeenCalledWith({
      bucket: "remora-dev-media",
      objectKey: "jobs/job_1/last-frame.png",
    });
  });

  it("leaves pending jobs and results without asset rows unsigned", async () => {
    mocks.listGenerationsFromThread.mockResolvedValueOnce([
      createThreadJob({ result: null }),
      createThreadJob({
        id: "job_2",
        result: {
          assets: [],
          videoUrl: "https://provider.example/video.mp4",
        },
      }),
    ]);

    await expect(
      generationService.listGenerationsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "job_1",
        result: null,
      }),
      expect.objectContaining({
        id: "job_2",
        result: expect.objectContaining({
          videoUrl: "https://provider.example/video.mp4",
          mediaUrlExpiresAt: null,
        }),
      }),
    ]);
    expect(mocks.createSignedGetUrlWithExpiration).not.toHaveBeenCalled();
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

function createThreadJob(
  overrides: Partial<
    Omit<GenerationThreadJob, "result"> & {
      result:
        | null
        | Partial<NonNullable<GenerationThreadJob["result"]>>;
    }
  > = {},
): GenerationThreadJob {
  const { result: resultOverrides, ...jobOverrides } = overrides;
  const result =
    resultOverrides === null
      ? null
      : {
          providerId: "byteplus",
          providerTaskId: "cgt-123",
          providerModelId: "dreamina-seedance-2-0-260128",
          providerStatus: "succeeded" as const,
          videoUrl: "https://provider.example/video.mp4",
          lastFrameUrl: null,
          mediaUrlExpiresAt: null,
          assets: [],
          providerError: null,
          receivedAt: "2026-06-05T00:02:00.000Z",
          createdAt: "2026-06-05T00:02:01.000Z",
          updatedAt: "2026-06-05T00:02:02.000Z",
          ...resultOverrides,
        };

  return {
    id: "job_1",
    threadId: "thread_1",
    modelId: "seedance-2.0-video",
    status: "succeeded",
    submittedInput: {
      prompt: "Quiet sea",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: "2026-06-05T00:01:00.000Z",
    updatedAt: "2026-06-05T00:02:00.000Z",
    result,
    ...jobOverrides,
  };
}

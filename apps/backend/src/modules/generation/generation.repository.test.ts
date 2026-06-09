import { beforeEach, describe, expect, it, vi } from "vitest";

import { generationRepository } from "./generation.repository.ts";
import { GenerationThreadNotFoundError } from "./generation.types.ts";

import type { VideoModelSpec } from "../model/types.ts";

const mocks = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertRows: [] as unknown[],
  updateRows: [] as unknown[],
  insertValues: vi.fn(),
  randomBytes: vi.fn(),
  randomUUID: vi.fn(),
  transaction: vi.fn(),
  updateSet: vi.fn(),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

vi.mock("node:crypto", () => ({
  randomBytes: mocks.randomBytes,
  randomUUID: mocks.randomUUID,
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  desc: mocks.desc,
  eq: mocks.eq,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
      mocks.transaction();

      return callback({
        select: vi.fn(() => createSelectChain()),
        insert: vi.fn(() => createInsertChain()),
        update: vi.fn(() => createUpdateChain()),
      });
    }),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    generationJob: {
      id: "generation_job.id",
      threadId: "generation_job.thread_id",
      userId: "generation_job.user_id",
      modelId: "generation_job.model_id",
      modelSpecId: "generation_job.model_spec_id",
      status: "generation_job.status",
      callbackTokenHash: "generation_job.callback_token_hash",
    },
    generationThread: {
      id: "generation_thread.id",
      userId: "generation_thread.user_id",
      name: "generation_thread.name",
      createdAt: "generation_thread.created_at",
      updatedAt: "generation_thread.updated_at",
    },
    generationResult: {
      id: "generation_result.id",
      jobId: "generation_result.job_id",
      providerId: "generation_result.provider_id",
      providerTaskId: "generation_result.provider_task_id",
      providerModelId: "generation_result.provider_model_id",
      providerStatus: "generation_result.provider_status",
      videoUrl: "generation_result.video_url",
      lastFrameUrl: "generation_result.last_frame_url",
      usage: "generation_result.usage",
      providerError: "generation_result.provider_error",
      rawPayload: "generation_result.raw_payload",
      receivedAt: "generation_result.received_at",
      updatedAt: "generation_result.updated_at",
    },
    generationModel: {
      id: "generation_model.id",
      providerId: "generation_model.provider_id",
      status: "generation_model.status",
    },
    generationModelSpec: {
      id: "generation_model_spec.id",
      modelId: "generation_model_spec.model_id",
      spec: "generation_model_spec.spec",
      status: "generation_model_spec.status",
      version: "generation_model_spec.version",
    },
  },
}));

describe("generation repository", () => {
  beforeEach(() => {
    mocks.randomBytes.mockReset();
    mocks.randomBytes.mockReturnValue(Buffer.from("1a2b3c4d", "hex"));
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("job_1");
    mocks.selectRows = [
      {
        id: "seedance-2.0-video-v1",
        modelId: "seedance-2.0-video",
        providerId: "byteplus",
        spec: {
          providerModelId: "dreamina-seedance-2-0-260128",
        },
      },
    ];
    mocks.insertRows = [createJob({ status: "queued" })];
    mocks.updateRows = [createJob({ status: "creating_provider_task" })];
    mocks.insertValues.mockClear();
    mocks.transaction.mockClear();
    mocks.updateSet.mockClear();
    mocks.eq.mockClear();
    mocks.and.mockClear();
    mocks.desc.mockClear();
  });

  it("loads the latest published model spec", async () => {
    await expect(
      generationRepository.getLatestPublishedGenerationModelSpec(
        "seedance-2.0-video",
      ),
    ).resolves.toEqual({
      id: "seedance-2.0-video-v1",
      modelId: "seedance-2.0-video",
      providerId: "byteplus",
      spec: {
        providerModelId: "dreamina-seedance-2-0-260128",
      },
    });
  });

  it("lists user generation threads by most recently updated", async () => {
    mocks.selectRows = [
      {
        id: "thread_2",
        userId: "user_1",
        name: "Second thread",
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-06T00:00:00.000Z"),
      },
      {
        id: "thread_1",
        userId: "user_1",
        name: "First thread",
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    ];

    await expect(
      generationRepository.listGenerationThreadsForUser("user_1"),
    ).resolves.toEqual([
      {
        id: "thread_2",
        name: "Second thread",
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z",
      },
      {
        id: "thread_1",
        name: "First thread",
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_thread.user_id",
      "user_1",
    );
    expect(mocks.desc).toHaveBeenCalledWith("generation_thread.updated_at");
  });

  it("creates a new thread and queued generation job in one transaction", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("thread_1")
      .mockReturnValueOnce("job_1");
    mocks.insertRows = [createJob({ threadId: "thread_1", status: "queued" })];

    await expect(
      generationRepository.insertGenerationJob({
        userId: "user_1",
        input: {
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHash: "callback-token-hash",
      }),
    ).resolves.toMatchObject({
      id: "job_1",
      threadId: "thread_1",
      status: "queued",
    });

    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.insertValues).toHaveBeenNthCalledWith(1, {
      id: "thread_1",
      userId: "user_1",
      name: "Thread 1a2b3c4d",
    });
    expect(mocks.insertValues).toHaveBeenNthCalledWith(2, {
      id: "job_1",
      threadId: "thread_1",
      userId: "user_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      status: "queued",
      submittedInput: {
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      callbackTokenHash: "callback-token-hash",
      providerId: "byteplus",
      providerModelId: "dreamina-seedance-2-0-260128",
    });
  });

  it("appends queued generation jobs to owned threads", async () => {
    mocks.insertRows = [createJob({ threadId: "thread_1", status: "queued" })];
    mocks.updateRows = [{ id: "thread_1" }];

    await expect(
      generationRepository.insertGenerationJob({
        userId: "user_1",
        input: {
          threadId: "thread_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHash: "callback-token-hash",
      }),
    ).resolves.toMatchObject({
      id: "job_1",
      threadId: "thread_1",
      status: "queued",
    });

    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "job_1",
        threadId: "thread_1",
        userId: "user_1",
      }),
    );
  });

  it("rejects appending jobs to missing or cross-user threads", async () => {
    mocks.updateRows = [];

    await expect(
      generationRepository.insertGenerationJob({
        userId: "user_1",
        input: {
          threadId: "thread_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHash: "callback-token-hash",
      }),
    ).rejects.toBeInstanceOf(GenerationThreadNotFoundError);

    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("updates jobs while creating provider tasks", async () => {
    mocks.updateRows = [
      createJob({
        status: "creating_provider_task",
        temporalWorkflowId: "generation-job:job_1",
        temporalRunId: "run_1",
      }),
    ];

    await expect(
      generationRepository.markGenerationJobCreatingProviderTask({
        jobId: "job_1",
        workflowId: "generation-job:job_1",
        runId: "run_1",
      }),
    ).resolves.toMatchObject({
      status: "creating_provider_task",
      temporalWorkflowId: "generation-job:job_1",
      temporalRunId: "run_1",
    });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "creating_provider_task",
        temporalWorkflowId: "generation-job:job_1",
        temporalRunId: "run_1",
        terminalError: null,
      }),
    );
  });

  it("stores provider task creation results", async () => {
    mocks.updateRows = [
      createJob({
        status: "provider_task_created",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
      }),
    ];

    await expect(
      generationRepository.markGenerationJobProviderTaskCreated({
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
      }),
    ).resolves.toMatchObject({
      status: "provider_task_created",
      providerTaskId: "cgt-123",
    });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "provider_task_created",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
      }),
    );
  });

  it("stores provider task ids while waiting for provider callbacks", async () => {
    mocks.updateRows = [
      createJob({
        status: "waiting_for_provider_callback",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
      }),
    ];

    await expect(
      generationRepository.markGenerationJobWaitingForProviderCallback({
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
      }),
    ).resolves.toMatchObject({
      status: "waiting_for_provider_callback",
      providerTaskId: "cgt-123",
    });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "waiting_for_provider_callback",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
      }),
    );
  });

  it("upserts generation results by job id", async () => {
    mocks.insertRows = [
      {
        id: "job_1",
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerStatus: "succeeded",
      },
    ];
    const rawPayload = {
      id: "cgt-123",
      status: "succeeded",
    };

    await expect(
      generationRepository.upsertGenerationResult({
        jobId: "job_1",
        result: {
          provider: "byteplus",
          providerTaskId: "cgt-123",
          providerModelId: "dreamina-seedance-2-0-260128",
          status: "succeeded",
          videoUrl: "https://assets.example/video.mp4",
          lastFrameUrl: null,
          usage: null,
          createdAt: 1780770000,
          updatedAt: 1780770060,
          providerError: null,
        },
        rawPayload,
        receivedAt: new Date("2026-06-05T00:00:00.000Z"),
      }),
    ).resolves.toMatchObject({
      providerTaskId: "cgt-123",
      providerStatus: "succeeded",
    });

    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerStatus: "succeeded",
        videoUrl: "https://assets.example/video.mp4",
        rawPayload,
      }),
    );
  });

  it("stores failure errors when jobs fail", async () => {
    mocks.updateRows = [
      createJob({
        status: "failed",
        terminalError: {
          source: "provider",
          code: "ProviderHttpError",
          message: "BytePlus request failed",
        },
      }),
    ];

    await expect(
      generationRepository.markGenerationJobFailed({
        jobId: "job_1",
        terminalError: {
          source: "provider",
          code: "ProviderHttpError",
          message: "BytePlus request failed",
        },
      }),
    ).resolves.toMatchObject({
      status: "failed",
      terminalError: {
        source: "provider",
        code: "ProviderHttpError",
        message: "BytePlus request failed",
      },
    });
  });

  it("stores workflow start failures without clearing provider task fields", async () => {
    mocks.updateRows = [
      createJob({
        status: "failed",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      }),
    ];

    await expect(
      generationRepository.markGenerationJobWorkflowStartFailed({
        jobId: "job_1",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      }),
    ).resolves.toMatchObject({
      status: "failed",
      terminalError: {
        source: "internal",
        code: "WORKFLOW_START_FAILED",
        message: "Temporal is unavailable",
      },
    });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        terminalError: {
          source: "internal",
          code: "WORKFLOW_START_FAILED",
          message: "Temporal is unavailable",
        },
      }),
    );
    expect(mocks.updateSet).not.toHaveBeenCalledWith(
      expect.objectContaining({
        providerTaskId: expect.anything(),
      }),
    );
  });
});

function createSelectChain() {
  const chain = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => mocks.selectRows),
    then: vi.fn((resolve, reject) =>
      Promise.resolve(mocks.selectRows).then(resolve, reject),
    ),
  };

  return chain;
}

function createInsertChain() {
  const returning = vi.fn(async () => mocks.insertRows);

  return {
    values: vi.fn((values: unknown) => {
      mocks.insertValues(values);

      return {
        onConflictDoUpdate: vi.fn(() => ({
          returning,
        })),
        returning,
      };
    }),
  };
}

function createUpdateChain() {
  const chain = {
    set: vi.fn((values: unknown) => {
      mocks.updateSet(values);

      return chain;
    }),
    where: vi.fn(() => chain),
    returning: vi.fn(async () => mocks.updateRows),
  };

  return chain;
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
      prompt: "A quiet ocean studio",
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

function createModelSpec(): VideoModelSpec {
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
      {
        id: "prompt",
        label: "Prompt",
        componentKind: "promptTextarea",
        valueKind: "string",
        required: false,
        advanced: false,
        omitWhenEmpty: true,
        omitWhenDefault: false,
        notes: [],
      },
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

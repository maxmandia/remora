import { beforeEach, describe, expect, it, vi } from "vitest";

import { generationRepository } from "./generation.repository.ts";
import { GenerationThreadNotFoundError } from "./generation.types.ts";

import type { VideoModelSpec } from "../model/types.ts";
import type {
  RetrieveSeedanceVideoTaskResult,
  StoredGenerationResultAssetReference,
} from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertRows: [] as unknown[],
  updateRows: [] as unknown[],
  insertValues: vi.fn(),
  randomBytes: vi.fn(),
  randomUUID: vi.fn(),
  transaction: vi.fn(),
  updateSet: vi.fn(),
  asc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  generationResultAssetTable: {
    resultId: "generation_result_asset.result_id",
    kind: "generation_result_asset.kind",
    bucket: "generation_result_asset.bucket",
    objectKey: "generation_result_asset.object_key",
    contentType: "generation_result_asset.content_type",
    contentLength: "generation_result_asset.content_length",
    etag: "generation_result_asset.etag",
    checksumSha256: "generation_result_asset.checksum_sha256",
    sourceProviderUrl: "generation_result_asset.source_provider_url",
  },
}));

vi.mock("node:crypto", () => ({
  randomBytes: mocks.randomBytes,
  randomUUID: mocks.randomUUID,
}));

vi.mock("drizzle-orm", () => ({
  and: mocks.and,
  asc: mocks.asc,
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
      submittedInput: "generation_job.submitted_input",
      callbackTokenHash: "generation_job.callback_token_hash",
      providerId: "generation_job.provider_id",
      providerTaskId: "generation_job.provider_task_id",
      providerModelId: "generation_job.provider_model_id",
      terminalError: "generation_job.terminal_error",
      createdAt: "generation_job.created_at",
      updatedAt: "generation_job.updated_at",
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
      createdAt: "generation_result.created_at",
      updatedAt: "generation_result.updated_at",
    },
    generationResultAsset: mocks.generationResultAssetTable,
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
    mocks.asc.mockClear();
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

  it("lists user generation thread jobs oldest first with nullable results", async () => {
    mocks.selectRows = [
      {
        id: "job_1",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "queued",
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        providerId: "byteplus",
        providerTaskId: null,
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
        resultId: null,
        resultProviderId: null,
        resultProviderTaskId: null,
        resultProviderModelId: null,
        resultProviderStatus: null,
        resultVideoUrl: null,
        resultLastFrameUrl: null,
        resultProviderError: null,
        resultReceivedAt: null,
        resultCreatedAt: null,
        resultUpdatedAt: null,
      },
      {
        id: "job_2",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "succeeded",
        submittedInput: {
          prompt: "A lantern city at dusk",
          aspectRatio: "9:16",
          duration: 10,
          generateAudio: false,
        },
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        createdAt: new Date("2026-06-05T00:01:00.000Z"),
        updatedAt: new Date("2026-06-05T00:02:00.000Z"),
        resultId: "result_1",
        resultProviderId: "byteplus",
        resultProviderTaskId: "cgt-123",
        resultProviderModelId: "dreamina-seedance-2-0-260128",
        resultProviderStatus: "succeeded",
        resultVideoUrl: "https://assets.example/video.mp4",
        resultLastFrameUrl: null,
        resultProviderError: null,
        resultReceivedAt: new Date("2026-06-05T00:02:00.000Z"),
        resultCreatedAt: new Date("2026-06-05T00:02:01.000Z"),
        resultUpdatedAt: new Date("2026-06-05T00:02:02.000Z"),
      },
    ];

    await expect(
      generationRepository.listGenerationsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      {
        id: "job_1",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "queued",
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        providerId: "byteplus",
        providerTaskId: null,
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
        result: null,
      },
      {
        id: "job_2",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "succeeded",
        submittedInput: {
          prompt: "A lantern city at dusk",
          aspectRatio: "9:16",
          duration: 10,
          generateAudio: false,
        },
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        createdAt: "2026-06-05T00:01:00.000Z",
        updatedAt: "2026-06-05T00:02:00.000Z",
        result: {
          providerId: "byteplus",
          providerTaskId: "cgt-123",
          providerModelId: "dreamina-seedance-2-0-260128",
          providerStatus: "succeeded",
          videoUrl: "https://assets.example/video.mp4",
          lastFrameUrl: null,
          mediaUrlExpiresAt: null,
          assets: [],
          providerError: null,
          receivedAt: "2026-06-05T00:02:00.000Z",
          createdAt: "2026-06-05T00:02:01.000Z",
          updatedAt: "2026-06-05T00:02:02.000Z",
        },
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith("generation_job.user_id", "user_1");
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_job.thread_id",
      "thread_1",
    );
    expect(mocks.asc).toHaveBeenCalledWith("generation_job.created_at");
  });

  it("folds joined result asset rows without duplicating thread jobs", async () => {
    mocks.selectRows = [
      createThreadJobListRow({
        id: "job_video",
        resultId: "result_video",
        assetResultId: "result_video",
        assetKind: "video",
        assetBucket: "remora-dev-media",
        assetObjectKey: "jobs/job_video/video.mp4",
        assetContentType: "video/mp4",
        assetContentLength: 1234,
        assetEtag: '"video-etag"',
        assetChecksumSha256: "video-sha256",
        assetSourceProviderUrl: "https://assets.example/video.mp4",
      }),
      createThreadJobListRow({
        id: "job_with_last_frame",
        resultId: "result_with_last_frame",
        assetResultId: "result_with_last_frame",
        assetKind: "last_frame",
        assetBucket: "remora-dev-media",
        assetObjectKey: "jobs/job_with_last_frame/last-frame.png",
        assetContentType: "image/png",
        assetContentLength: 4321,
        assetEtag: '"last-frame-etag"',
        assetChecksumSha256: "last-frame-sha256",
        assetSourceProviderUrl: "https://assets.example/last-frame.png",
      }),
      createThreadJobListRow({
        id: "job_with_last_frame",
        resultId: "result_with_last_frame",
        assetResultId: "result_with_last_frame",
        assetKind: "video",
        assetBucket: "remora-dev-media",
        assetObjectKey: "jobs/job_with_last_frame/video.mp4",
        assetContentType: "video/mp4",
        assetContentLength: 2468,
        assetEtag: '"second-video-etag"',
        assetChecksumSha256: "second-video-sha256",
        assetSourceProviderUrl: "https://assets.example/second-video.mp4",
      }),
    ];

    await expect(
      generationRepository.listGenerationsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "job_video",
        result: expect.objectContaining({
          assets: [
            {
              kind: "video",
              bucket: "remora-dev-media",
              objectKey: "jobs/job_video/video.mp4",
              contentType: "video/mp4",
              contentLength: 1234,
              etag: '"video-etag"',
              checksumSha256: "video-sha256",
              sourceProviderUrl: "https://assets.example/video.mp4",
            },
          ],
        }),
      }),
      expect.objectContaining({
        id: "job_with_last_frame",
        result: expect.objectContaining({
          assets: [
            {
              kind: "last_frame",
              bucket: "remora-dev-media",
              objectKey: "jobs/job_with_last_frame/last-frame.png",
              contentType: "image/png",
              contentLength: 4321,
              etag: '"last-frame-etag"',
              checksumSha256: "last-frame-sha256",
              sourceProviderUrl: "https://assets.example/last-frame.png",
            },
            {
              kind: "video",
              bucket: "remora-dev-media",
              objectKey: "jobs/job_with_last_frame/video.mp4",
              contentType: "video/mp4",
              contentLength: 2468,
              etag: '"second-video-etag"',
              checksumSha256: "second-video-sha256",
              sourceProviderUrl: "https://assets.example/second-video.mp4",
            },
          ],
        }),
      }),
    ]);
    expect(mocks.asc).toHaveBeenCalledWith("generation_job.created_at");
    expect(mocks.asc).toHaveBeenCalledWith("generation_result_asset.kind");
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

  it("upserts generation results by job id without stored assets", async () => {
    mocks.insertRows = [
      {
        id: "result_1",
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
    expect(mocks.insertValues).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("stores a video asset reference with an upserted generation result", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("result_insert_1")
      .mockReturnValueOnce("asset_video_1");
    mocks.insertRows = [
      {
        id: "result_1",
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerStatus: "succeeded",
      },
    ];

    await expect(
      generationRepository.upsertGenerationResult({
        jobId: "job_1",
        result: createSeedanceResult({
          videoUrl: "https://assets.example/video.mp4",
          lastFrameUrl: null,
        }),
        rawPayload: { id: "cgt-123", status: "succeeded" },
        receivedAt: new Date("2026-06-05T00:00:00.000Z"),
        storedAssets: [
          createStoredAsset({
            kind: "video",
            sourceProviderUrl: "https://assets.example/video.mp4",
          }),
        ],
      }),
    ).resolves.toMatchObject({
      id: "result_1",
      providerTaskId: "cgt-123",
    });

    expect(mocks.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "asset_video_1",
        resultId: "result_1",
        kind: "video",
        bucket: "remora-dev-media",
        objectKey: "jobs/job_1/video.mp4",
        sourceProviderUrl: "https://assets.example/video.mp4",
      }),
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });

  it("stores video and last-frame asset references with an upserted generation result", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("result_insert_1")
      .mockReturnValueOnce("asset_video_1")
      .mockReturnValueOnce("asset_last_frame_1");
    mocks.insertRows = [
      {
        id: "result_1",
        jobId: "job_1",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerStatus: "succeeded",
      },
    ];

    await expect(
      generationRepository.upsertGenerationResult({
        jobId: "job_1",
        result: createSeedanceResult({
          videoUrl: "https://assets.example/video.mp4",
          lastFrameUrl: "https://assets.example/last-frame.png",
        }),
        rawPayload: { id: "cgt-123", status: "succeeded" },
        receivedAt: new Date("2026-06-05T00:00:00.000Z"),
        storedAssets: [
          createStoredAsset({
            kind: "video",
            sourceProviderUrl: "https://assets.example/video.mp4",
          }),
          createStoredAsset({
            kind: "last_frame",
            contentType: "image/png",
            objectKey: "jobs/job_1/last-frame.png",
            sourceProviderUrl: "https://assets.example/last-frame.png",
          }),
        ],
      }),
    ).resolves.toMatchObject({
      id: "result_1",
      providerTaskId: "cgt-123",
    });

    expect(mocks.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "asset_video_1",
        resultId: "result_1",
        kind: "video",
        objectKey: "jobs/job_1/video.mp4",
      }),
    );
    expect(mocks.insertValues).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        id: "asset_last_frame_1",
        resultId: "result_1",
        kind: "last_frame",
        objectKey: "jobs/job_1/last-frame.png",
      }),
    );
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
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
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(async () => mocks.selectRows),
    then: vi.fn((resolve, reject) =>
      Promise.resolve(mocks.selectRows).then(resolve, reject),
    ),
  };

  return chain;
}

function createSeedanceResult(
  overrides: Partial<RetrieveSeedanceVideoTaskResult> = {},
): RetrieveSeedanceVideoTaskResult {
  return {
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
    ...overrides,
  };
}

function createThreadJobListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job_1",
    threadId: "thread_1",
    modelId: "seedance-2.0-video",
    status: "succeeded",
    submittedInput: {
      prompt: "A lantern city at dusk",
      aspectRatio: "9:16",
      duration: 10,
      generateAudio: false,
    },
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: new Date("2026-06-05T00:01:00.000Z"),
    updatedAt: new Date("2026-06-05T00:02:00.000Z"),
    resultId: "result_1",
    resultProviderId: "byteplus",
    resultProviderTaskId: "cgt-123",
    resultProviderModelId: "dreamina-seedance-2-0-260128",
    resultProviderStatus: "succeeded",
    resultVideoUrl: "https://assets.example/video.mp4",
    resultLastFrameUrl: null,
    resultProviderError: null,
    resultReceivedAt: new Date("2026-06-05T00:02:00.000Z"),
    resultCreatedAt: new Date("2026-06-05T00:02:01.000Z"),
    resultUpdatedAt: new Date("2026-06-05T00:02:02.000Z"),
    assetResultId: null,
    assetKind: null,
    assetBucket: null,
    assetObjectKey: null,
    assetContentType: null,
    assetContentLength: null,
    assetEtag: null,
    assetChecksumSha256: null,
    assetSourceProviderUrl: null,
    ...overrides,
  };
}

function createStoredAsset(
  overrides: Partial<StoredGenerationResultAssetReference> = {},
): StoredGenerationResultAssetReference {
  const kind = overrides.kind ?? "video";

  return {
    kind,
    bucket: "remora-dev-media",
    objectKey:
      kind === "last_frame"
        ? "jobs/job_1/last-frame.png"
        : "jobs/job_1/video.mp4",
    contentType: kind === "last_frame" ? "image/png" : "video/mp4",
    contentLength: 1234,
    etag: '"etag"',
    checksumSha256: "sha256-checksum",
    sourceProviderUrl:
      kind === "last_frame"
        ? "https://assets.example/last-frame.png"
        : "https://assets.example/video.mp4",
    ...overrides,
  };
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

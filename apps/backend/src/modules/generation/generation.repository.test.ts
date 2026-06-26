import { beforeEach, describe, expect, it, vi } from "vitest";

import { generationRepository } from "./generation.repository.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
} from "./generation.types.ts";

import type { VideoModelSpec } from "../model/model.types.ts";
import type {
  RetrieveSeedanceVideoTaskResult,
  StoredGenerationResultAssetReference,
  StoredGenerationResultPreviewReference,
} from "./generation.types.ts";

const mocks = vi.hoisted(() => ({
  selectRows: [] as unknown[],
  insertRows: [] as unknown[],
  insertRowsQueue: [] as unknown[][],
  updateRows: [] as unknown[],
  insertValues: vi.fn(),
  randomBytes: vi.fn(),
  randomUUID: vi.fn(),
  updateSet: vi.fn(),
  asc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
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
  generationResultPreviewTable: {
    resultId: "generation_result_preview.result_id",
    bucket: "generation_result_preview.bucket",
    objectKey: "generation_result_preview.object_key",
    contentType: "generation_result_preview.content_type",
    contentLength: "generation_result_preview.content_length",
    etag: "generation_result_preview.etag",
    checksumSha256: "generation_result_preview.checksum_sha256",
    frameTimeMs: "generation_result_preview.frame_time_ms",
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
  inArray: mocks.inArray,
  isNull: mocks.isNull,
  sql: mocks.sql,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => createInsertChain()),
    update: vi.fn(() => createUpdateChain()),
  },
  schema: {
    generationJob: {
      id: "generation_job.id",
      submissionId: "generation_job.submission_id",
      submissionIndex: "generation_job.submission_index",
      status: "generation_job.status",
      callbackTokenHash: "generation_job.callback_token_hash",
      providerId: "generation_job.provider_id",
      providerTaskId: "generation_job.provider_task_id",
      providerModelId: "generation_job.provider_model_id",
      terminalError: "generation_job.terminal_error",
      createdAt: "generation_job.created_at",
      updatedAt: "generation_job.updated_at",
    },
    generationSubmission: {
      id: "generation_submission.id",
      threadId: "generation_submission.thread_id",
      userId: "generation_submission.user_id",
      modelId: "generation_submission.model_id",
      modelSpecId: "generation_submission.model_spec_id",
      submittedInput: "generation_submission.submitted_input",
      requestedGenerations: "generation_submission.requested_generations",
      createdAt: "generation_submission.created_at",
      updatedAt: "generation_submission.updated_at",
    },
    generationAttachmentMedia: {
      id: "generation_attachment_media.id",
      userId: "generation_attachment_media.user_id",
      kind: "generation_attachment_media.kind",
      originalFileName: "generation_attachment_media.original_file_name",
      bucket: "generation_attachment_media.bucket",
      objectKey: "generation_attachment_media.object_key",
      contentType: "generation_attachment_media.content_type",
      contentLength: "generation_attachment_media.content_length",
      etag: "generation_attachment_media.etag",
      checksumSha256: "generation_attachment_media.checksum_sha256",
      metadata: "generation_attachment_media.metadata",
      createdAt: "generation_attachment_media.created_at",
      updatedAt: "generation_attachment_media.updated_at",
    },
    generationSubmissionAttachmentMedia: {
      id: "generation_submission_attachment_media.id",
      submissionId: "generation_submission_attachment_media.submission_id",
      attachmentMediaId:
        "generation_submission_attachment_media.attachment_media_id",
      fieldId: "generation_submission_attachment_media.field_id",
      role: "generation_submission_attachment_media.role",
      position: "generation_submission_attachment_media.position",
      createdAt: "generation_submission_attachment_media.created_at",
    },
    generationThread: {
      id: "generation_thread.id",
      projectId: "generation_thread.project_id",
      userId: "generation_thread.user_id",
      name: "generation_thread.name",
      createdAt: "generation_thread.created_at",
      updatedAt: "generation_thread.updated_at",
    },
    project: {
      id: "project.id",
      userId: "project.user_id",
      archivedAt: "project.archived_at",
    },
    generationResult: {
      id: "generation_result.id",
      jobId: "generation_result.job_id",
      providerId: "generation_result.provider_id",
      providerTaskId: "generation_result.provider_task_id",
      providerModelId: "generation_result.provider_model_id",
      providerStatus: "generation_result.provider_status",
      videoUrl: "generation_result.video_url",
      usage: "generation_result.usage",
      providerError: "generation_result.provider_error",
      rawPayload: "generation_result.raw_payload",
      receivedAt: "generation_result.received_at",
      createdAt: "generation_result.created_at",
      updatedAt: "generation_result.updated_at",
    },
    generationResultAsset: mocks.generationResultAssetTable,
    generationResultPreview: mocks.generationResultPreviewTable,
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
        spec: createModelSpec(),
      },
    ];
    mocks.insertRows = [createJob({ status: "queued" })];
    mocks.insertRowsQueue = [];
    mocks.updateRows = [createJob({ status: "creating_provider_task" })];
    mocks.insertValues.mockClear();
    mocks.updateSet.mockClear();
    mocks.asc.mockClear();
    mocks.eq.mockClear();
    mocks.inArray.mockClear();
    mocks.isNull.mockClear();
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
      spec: createModelSpec(),
    });
  });

  it("lists user generation threads without projects by most recently updated", async () => {
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
      generationRepository.listThreadsWithoutProjectForUser("user_1"),
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
    expect(mocks.isNull).toHaveBeenCalledWith("generation_thread.project_id");
    expect(mocks.desc).toHaveBeenCalledWith("generation_thread.updated_at");
  });

  it("lists user generation thread submissions oldest first with nested jobs", async () => {
    mocks.selectRows = [
      createThreadSubmissionListRow({
        submissionId: "submission_1",
        submissionCreatedAt: new Date("2026-06-05T00:00:00.000Z"),
        submissionUpdatedAt: new Date("2026-06-05T00:00:00.000Z"),
        submissionSubmittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        jobId: "job_1",
        jobSubmissionId: "submission_1",
        jobSubmissionIndex: 0,
        jobStatus: "queued",
        providerId: "byteplus",
        providerTaskId: null,
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        jobCreatedAt: new Date("2026-06-05T00:00:00.000Z"),
        jobUpdatedAt: new Date("2026-06-05T00:00:00.000Z"),
        resultId: null,
      }),
      createThreadSubmissionListRow({
        submissionId: "submission_2",
        submissionSubmittedInput: {
          prompt: "A lantern city at dusk",
          aspectRatio: "9:16",
          duration: 10,
          generateAudio: false,
        },
        submissionCreatedAt: new Date("2026-06-05T00:01:00.000Z"),
        submissionUpdatedAt: new Date("2026-06-05T00:02:00.000Z"),
        jobId: "job_2",
        jobSubmissionId: "submission_2",
        jobSubmissionIndex: 0,
        jobStatus: "succeeded",
        providerId: "byteplus",
        providerTaskId: "cgt-123",
        providerModelId: "dreamina-seedance-2-0-260128",
        terminalError: null,
        jobCreatedAt: new Date("2026-06-05T00:01:00.000Z"),
        jobUpdatedAt: new Date("2026-06-05T00:02:00.000Z"),
        resultId: "result_1",
        resultProviderId: "byteplus",
        resultProviderTaskId: "cgt-123",
        resultProviderModelId: "dreamina-seedance-2-0-260128",
        resultProviderStatus: "succeeded",
        resultVideoUrl: "https://assets.example/video.mp4",
        resultProviderError: null,
        resultReceivedAt: new Date("2026-06-05T00:02:00.000Z"),
        resultCreatedAt: new Date("2026-06-05T00:02:01.000Z"),
        resultUpdatedAt: new Date("2026-06-05T00:02:02.000Z"),
      }),
    ];

    await expect(
      generationRepository.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      {
        id: "submission_1",
        threadId: "thread_1",
        userId: "user_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        requestedGenerations: 1,
        attachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
        jobs: [
          {
            id: "job_1",
            submissionId: "submission_1",
            submissionIndex: 0,
            status: "queued",
            providerId: "byteplus",
            providerTaskId: null,
            providerModelId: "dreamina-seedance-2-0-260128",
            terminalError: null,
            createdAt: "2026-06-05T00:00:00.000Z",
            updatedAt: "2026-06-05T00:00:00.000Z",
            result: null,
          },
        ],
      },
      {
        id: "submission_2",
        threadId: "thread_1",
        userId: "user_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        submittedInput: {
          prompt: "A lantern city at dusk",
          aspectRatio: "9:16",
          duration: 10,
          generateAudio: false,
        },
        requestedGenerations: 1,
        attachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
        createdAt: "2026-06-05T00:01:00.000Z",
        updatedAt: "2026-06-05T00:02:00.000Z",
        jobs: [
          {
            id: "job_2",
            submissionId: "submission_2",
            submissionIndex: 0,
            status: "succeeded",
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
              previewImageUrl: null,
              mediaUrlExpiresAt: null,
              assets: [],
              preview: null,
              providerError: null,
              receivedAt: "2026-06-05T00:02:00.000Z",
              createdAt: "2026-06-05T00:02:01.000Z",
              updatedAt: "2026-06-05T00:02:02.000Z",
            },
          },
        ],
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_submission.user_id",
      "user_1",
    );
    expect(mocks.eq).toHaveBeenCalledWith(
      "generation_submission.thread_id",
      "thread_1",
    );
    expect(mocks.asc).toHaveBeenCalledWith("generation_submission.created_at");
    expect(mocks.asc).toHaveBeenCalledWith("generation_job.submission_index");
  });

  it("folds joined video asset rows into nested thread submission jobs", async () => {
    mocks.selectRows = [
      createThreadSubmissionListRow({
        submissionId: "submission_video",
        jobId: "job_video",
        jobSubmissionId: "submission_video",
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
      createThreadSubmissionListRow({
        submissionId: "submission_second_video",
        jobId: "job_second_video",
        jobSubmissionId: "submission_second_video",
        resultId: "result_second_video",
        assetResultId: "result_second_video",
        assetKind: "video",
        assetBucket: "remora-dev-media",
        assetObjectKey: "jobs/job_second_video/video.mp4",
        assetContentType: "video/mp4",
        assetContentLength: 2468,
        assetEtag: '"second-video-etag"',
        assetChecksumSha256: "second-video-sha256",
        assetSourceProviderUrl: "https://assets.example/second-video.mp4",
      }),
    ];

    await expect(
      generationRepository.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "submission_video",
        jobs: [
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
        ],
      }),
      expect.objectContaining({
        id: "submission_second_video",
        jobs: [
          expect.objectContaining({
            id: "job_second_video",
            result: expect.objectContaining({
              assets: [
                {
                  kind: "video",
                  bucket: "remora-dev-media",
                  objectKey: "jobs/job_second_video/video.mp4",
                  contentType: "video/mp4",
                  contentLength: 2468,
                  etag: '"second-video-etag"',
                  checksumSha256: "second-video-sha256",
                  sourceProviderUrl: "https://assets.example/second-video.mp4",
                },
              ],
            }),
          }),
        ],
      }),
    ]);
    expect(mocks.asc).toHaveBeenCalledWith("generation_submission.created_at");
    expect(mocks.asc).toHaveBeenCalledWith("generation_result_asset.kind");
  });

  it("folds joined preview rows into nested thread submission jobs", async () => {
    mocks.selectRows = [
      createThreadSubmissionListRow({
        submissionId: "submission_video",
        jobId: "job_video",
        jobSubmissionId: "submission_video",
        resultId: "result_video",
        previewResultId: "result_video",
        previewBucket: "remora-dev-media",
        previewObjectKey: "jobs/job_video/preview.jpg",
        previewContentType: "image/jpeg",
        previewContentLength: 3456,
        previewEtag: '"preview-etag"',
        previewChecksumSha256: "preview-sha256",
        previewFrameTimeMs: 1000,
      }),
    ];

    await expect(
      generationRepository.listSubmissionsFromThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "submission_video",
        jobs: [
          expect.objectContaining({
            id: "job_video",
            result: expect.objectContaining({
              previewImageUrl: null,
              preview: {
                bucket: "remora-dev-media",
                objectKey: "jobs/job_video/preview.jpg",
                contentType: "image/jpeg",
                contentLength: 3456,
                etag: '"preview-etag"',
                checksumSha256: "preview-sha256",
                frameTimeMs: 1000,
              },
            }),
          }),
        ],
      }),
    ]);
  });

  it("creates a new thread, generation submission, and queued jobs", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("thread_1")
      .mockReturnValueOnce("submission_1")
      .mockReturnValueOnce("job_1")
      .mockReturnValueOnce("job_2")
      .mockReturnValueOnce("job_3");
    mocks.insertRowsQueue = [
      [
        createSubmission({
          id: "submission_1",
          threadId: "thread_1",
          requestedGenerations: 3,
        }),
      ],
      [
        createJob({
          id: "job_3",
          submissionId: "submission_1",
          submissionIndex: 2,
          status: "queued",
        }),
        createJob({
          id: "job_1",
          submissionId: "submission_1",
          submissionIndex: 0,
          status: "queued",
        }),
        createJob({
          id: "job_2",
          submissionId: "submission_1",
          submissionIndex: 1,
          status: "queued",
        }),
      ],
    ];

    await expect(
      generationRepository.insertGenerationSubmission({
        userId: "user_1",
        input: {
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 3,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: [
          "callback-token-hash-1",
          "callback-token-hash-2",
          "callback-token-hash-3",
        ],
      }),
    ).resolves.toMatchObject({
      submission: {
        id: "submission_1",
        threadId: "thread_1",
        requestedGenerations: 3,
      },
      jobs: [
        {
          id: "job_1",
          submissionId: "submission_1",
          submissionIndex: 0,
          status: "queued",
        },
        {
          id: "job_2",
          submissionId: "submission_1",
          submissionIndex: 1,
          status: "queued",
        },
        {
          id: "job_3",
          submissionId: "submission_1",
          submissionIndex: 2,
          status: "queued",
        },
      ],
    });

    expect(mocks.insertValues).toHaveBeenNthCalledWith(1, {
      id: "thread_1",
      userId: "user_1",
      name: "Thread 1a2b3c4d",
    });
    expect(mocks.insertValues).toHaveBeenNthCalledWith(2, {
      id: "submission_1",
      threadId: "thread_1",
      userId: "user_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      submittedInput: {
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      requestedGenerations: 3,
    });
    expect(mocks.insertValues).toHaveBeenNthCalledWith(3, [
      {
        id: "job_1",
        submissionId: "submission_1",
        submissionIndex: 0,
        status: "queued",
        callbackTokenHash: "callback-token-hash-1",
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-260128",
      },
      {
        id: "job_2",
        submissionId: "submission_1",
        submissionIndex: 1,
        status: "queued",
        callbackTokenHash: "callback-token-hash-2",
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-260128",
      },
      {
        id: "job_3",
        submissionId: "submission_1",
        submissionIndex: 2,
        status: "queued",
        callbackTokenHash: "callback-token-hash-3",
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-260128",
      },
    ]);
  });

  it("creates new generation threads inside owned active projects", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("thread_1")
      .mockReturnValueOnce("submission_1")
      .mockReturnValueOnce("job_1");
    mocks.selectRows = [{ id: "project_1" }];
    mocks.insertRowsQueue = [
      [createSubmission({ id: "submission_1", threadId: "thread_1" })],
      [createJob({ id: "job_1", submissionId: "submission_1" })],
    ];

    await expect(
      generationRepository.insertGenerationSubmission({
        userId: "user_1",
        input: {
          projectId: "project_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: ["callback-token-hash"],
      }),
    ).resolves.toMatchObject({
      submission: {
        id: "submission_1",
        threadId: "thread_1",
      },
      jobs: [
        {
          id: "job_1",
          submissionId: "submission_1",
          status: "queued",
        },
      ],
    });

    expect(mocks.eq).toHaveBeenCalledWith("project.id", "project_1");
    expect(mocks.eq).toHaveBeenCalledWith("project.user_id", "user_1");
    expect(mocks.isNull).toHaveBeenCalledWith("project.archived_at");
    expect(mocks.insertValues).toHaveBeenNthCalledWith(1, {
      id: "thread_1",
      userId: "user_1",
      name: "Thread 1a2b3c4d",
      projectId: "project_1",
    });
  });

  it("rejects creating generation threads in missing or inactive projects", async () => {
    mocks.selectRows = [];

    await expect(
      generationRepository.insertGenerationSubmission({
        userId: "user_1",
        input: {
          projectId: "project_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: ["callback-token-hash"],
      }),
    ).rejects.toBeInstanceOf(GenerationProjectNotFoundError);

    expect(mocks.insertValues).not.toHaveBeenCalled();
  });

  it("appends queued generation submissions to owned threads", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("submission_1")
      .mockReturnValueOnce("job_1");
    mocks.insertRowsQueue = [
      [createSubmission({ id: "submission_1", threadId: "thread_1" })],
      [createJob({ submissionId: "submission_1", status: "queued" })],
    ];
    mocks.updateRows = [{ id: "thread_1" }];

    await expect(
      generationRepository.insertGenerationSubmission({
        userId: "user_1",
        input: {
          threadId: "thread_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: ["callback-token-hash"],
      }),
    ).resolves.toMatchObject({
      submission: {
        id: "submission_1",
        threadId: "thread_1",
      },
      jobs: [
        {
          id: "job_1",
          submissionId: "submission_1",
          status: "queued",
        },
      ],
    });

    expect(mocks.insertValues).toHaveBeenCalledTimes(2);
    expect(mocks.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
    });
    expect(mocks.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "submission_1",
        threadId: "thread_1",
        userId: "user_1",
      }),
    );
  });

  it("rejects appending jobs to missing or cross-user threads", async () => {
    mocks.updateRows = [];

    await expect(
      generationRepository.insertGenerationSubmission({
        userId: "user_1",
        input: {
          threadId: "thread_1",
          modelId: "seedance-2.0-video",
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        modelSpec: {
          id: "seedance-2.0-video-v1",
          modelId: "seedance-2.0-video",
          providerId: "byteplus",
          spec: createModelSpec(),
        },
        submittedInput: {
          prompt: "A quiet ocean studio",
          resolution: "720p",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
        callbackTokenHashes: ["callback-token-hash"],
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
  });

  it("stores a preview reference with an upserted generation result", async () => {
    mocks.randomUUID
      .mockReturnValueOnce("result_insert_1")
      .mockReturnValueOnce("preview_1");
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
        }),
        rawPayload: { id: "cgt-123", status: "succeeded" },
        receivedAt: new Date("2026-06-05T00:00:00.000Z"),
        storedPreview: createStoredPreview(),
      }),
    ).resolves.toMatchObject({
      id: "result_1",
      providerTaskId: "cgt-123",
    });

    expect(mocks.insertValues).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        id: "preview_1",
        resultId: "result_1",
        bucket: "remora-dev-media",
        objectKey: "jobs/job_1/preview.jpg",
        contentType: "image/jpeg",
        contentLength: 4321,
        frameTimeMs: 1000,
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

  it("stores final cost calculation failures with a distinct status", async () => {
    mocks.updateRows = [
      createJob({
        status: "final_cost_calculation_failure",
        terminalError: {
          source: "internal",
          code: "FINAL_COST_CALCULATION_FAILED",
          message: "Model rates unavailable",
        },
      }),
    ];

    await expect(
      generationRepository.markGenerationJobFinalCostCalculationFailed({
        jobId: "job_1",
        terminalError: {
          source: "internal",
          code: "FINAL_COST_CALCULATION_FAILED",
          message: "Model rates unavailable",
        },
      }),
    ).resolves.toMatchObject({
      status: "final_cost_calculation_failure",
      terminalError: {
        source: "internal",
        code: "FINAL_COST_CALCULATION_FAILED",
        message: "Model rates unavailable",
      },
    });

    expect(mocks.updateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "final_cost_calculation_failure",
        terminalError: {
          source: "internal",
          code: "FINAL_COST_CALCULATION_FAILED",
          message: "Model rates unavailable",
        },
      }),
    );
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
    usage: null,
    createdAt: 1780770000,
    updatedAt: 1780770060,
    providerError: null,
    ...overrides,
  };
}

function createThreadSubmissionListRow(
  overrides: Record<string, unknown> = {},
) {
  return {
    submissionId: "submission_1",
    submissionThreadId: "thread_1",
    submissionUserId: "user_1",
    submissionModelId: "seedance-2.0-video",
    submissionModelSpecId: "seedance-2.0-video-v1",
    submissionSubmittedInput: {
      prompt: "A lantern city at dusk",
      aspectRatio: "9:16",
      duration: 10,
      generateAudio: false,
    },
    submissionRequestedGenerations: 1,
    submissionCreatedAt: new Date("2026-06-05T00:01:00.000Z"),
    submissionUpdatedAt: new Date("2026-06-05T00:02:00.000Z"),
    jobId: "job_1",
    jobSubmissionId: "submission_1",
    jobSubmissionIndex: 0,
    jobStatus: "succeeded",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    jobCreatedAt: new Date("2026-06-05T00:01:00.000Z"),
    jobUpdatedAt: new Date("2026-06-05T00:02:00.000Z"),
    resultId: "result_1",
    resultProviderId: "byteplus",
    resultProviderTaskId: "cgt-123",
    resultProviderModelId: "dreamina-seedance-2-0-260128",
    resultProviderStatus: "succeeded",
    resultVideoUrl: "https://assets.example/video.mp4",
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
    previewResultId: null,
    previewBucket: null,
    previewObjectKey: null,
    previewContentType: null,
    previewContentLength: null,
    previewEtag: null,
    previewChecksumSha256: null,
    previewFrameTimeMs: null,
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
    objectKey: "jobs/job_1/video.mp4",
    contentType: "video/mp4",
    contentLength: 1234,
    etag: '"etag"',
    checksumSha256: "sha256-checksum",
    sourceProviderUrl: "https://assets.example/video.mp4",
    ...overrides,
  };
}

function createStoredPreview(
  overrides: Partial<StoredGenerationResultPreviewReference> = {},
): StoredGenerationResultPreviewReference {
  return {
    bucket: "remora-dev-media",
    objectKey: "jobs/job_1/preview.jpg",
    contentType: "image/jpeg",
    contentLength: 4321,
    etag: '"preview-etag"',
    checksumSha256: "preview-sha256",
    frameTimeMs: 1000,
    ...overrides,
  };
}

function createInsertChain() {
  const returning = vi.fn(async () =>
    mocks.insertRowsQueue.length > 0
      ? (mocks.insertRowsQueue.shift() ?? [])
      : mocks.insertRows,
  );

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
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "queued",
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

function createSubmission(overrides: Record<string, unknown> = {}) {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: 1,
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

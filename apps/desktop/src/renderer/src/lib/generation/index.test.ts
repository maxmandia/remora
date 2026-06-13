import { describe, expect, it } from "vitest";

import {
  findVideoPreviewOrFallback,
  generationVideoPreviewFallbackImageUrl,
  getDefaultGenerationSettings,
} from "./index.ts";

import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";

describe("generation preview helpers", () => {
  it("returns null for jobs that are not completed with displayable results", () => {
    expect(
      findVideoPreviewOrFallback(
        createThreadSubmission([
          createJob({
            id: "job_queued",
            submissionIndex: 0,
            status: "queued",
            result: createResult({
              previewImageUrl: "https://assets.example/queued.jpg",
            }),
          }),
          createJob({
            id: "job_failed",
            submissionIndex: 1,
            status: "failed",
            result: createResult({
              previewImageUrl: "https://assets.example/failed.jpg",
            }),
          }),
          createJob({
            id: "job_no_result",
            submissionIndex: 2,
            status: "succeeded",
            result: null,
          }),
        ]),
      ),
    ).toBeNull();
  });

  it("selects the first succeeded preview by submission index without mutating jobs", () => {
    const jobs = [
      createJob({
        id: "job_later",
        submissionIndex: 2,
        result: createResult({
          previewImageUrl: "https://assets.example/later.jpg",
        }),
      }),
      createJob({
        id: "job_first",
        submissionIndex: 1,
        result: createResult({
          previewImageUrl: "https://assets.example/first.jpg",
        }),
      }),
    ];
    const submission = createThreadSubmission(jobs);

    expect(findVideoPreviewOrFallback(submission)).toEqual({
      kind: "preview",
      previewImageUrl: "https://assets.example/first.jpg",
      videoUrl: "https://assets.example/video.mp4",
      job: jobs[1],
    });
    expect(submission.jobs.map((job) => job.id)).toEqual([
      "job_later",
      "job_first",
    ]);
  });

  it("skips a video missing its preview when a later succeeded preview exists", () => {
    expect(
      findVideoPreviewOrFallback(
        createThreadSubmission([
          createJob({
            id: "job_video_without_preview",
            submissionIndex: 0,
            result: createResult({
              videoUrl: "https://assets.example/video.mp4",
              previewImageUrl: null,
            }),
          }),
          createJob({
            id: "job_with_preview",
            submissionIndex: 1,
            result: createResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ]),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "preview",
        previewImageUrl: "https://assets.example/preview.jpg",
        videoUrl: "https://assets.example/video.mp4",
      }),
    );
  });

  it("returns the video fallback when succeeded videos have no preview", () => {
    expect(
      findVideoPreviewOrFallback(
        createThreadSubmission([
          createJob({
            id: "job_later_video",
            submissionIndex: 2,
            result: createResult({
              videoUrl: "https://assets.example/later.mp4",
              previewImageUrl: null,
            }),
          }),
          createJob({
            id: "job_first_video",
            submissionIndex: 1,
            result: createResult({
              videoUrl: "https://assets.example/first.mp4",
              previewImageUrl: null,
            }),
          }),
        ]),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "fallback",
        previewImageUrl: generationVideoPreviewFallbackImageUrl,
        videoUrl: "https://assets.example/first.mp4",
        reason: "missingVideoPreview",
        job: expect.objectContaining({ id: "job_first_video" }),
      }),
    );
  });

  it("treats a preview image without a video URL as an image preview", () => {
    expect(
      findVideoPreviewOrFallback(
        createThreadSubmission([
          createJob({
            result: createResult({
              videoUrl: null,
              previewImageUrl: "https://assets.example/image.jpg",
            }),
          }),
        ]),
      ),
    ).toEqual(
      expect.objectContaining({
        kind: "preview",
        previewImageUrl: "https://assets.example/image.jpg",
        videoUrl: null,
      }),
    );
  });
});

describe("generation settings helpers", () => {
  it("extracts defaults for composer settings from a published model", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
          createField({
            id: "duration",
            defaultValue: 5,
            valueKind: "integer",
          }),
          createField({
            id: "generateAudio",
            defaultValue: true,
            valueKind: "boolean",
          }),
        ]),
      ),
    ).toEqual({
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      requestedGenerations: 1,
    });
  });

  it("falls back to the first typed option when a default is missing", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            valueKind: "string",
            options: [{ label: "9:16", value: "9:16" }],
          }),
          createField({
            id: "duration",
            valueKind: "integer",
            options: [{ label: "10s", value: 10 }],
          }),
          createField({
            id: "generateAudio",
            valueKind: "boolean",
            options: [{ label: "Off", value: false }],
          }),
        ]),
      ),
    ).toEqual({
      aspectRatio: "9:16",
      duration: 10,
      generateAudio: false,
      requestedGenerations: 1,
    });
  });

  it("returns null when required composer settings are absent", () => {
    expect(
      getDefaultGenerationSettings(
        createModel([
          createField({
            id: "aspectRatio",
            defaultValue: "16:9",
            valueKind: "string",
          }),
        ]),
      ),
    ).toBeNull();
  });
});

function createThreadSubmission(
  jobs: GenerationThreadSubmissionJob[],
): GenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio.",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: jobs.length,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs,
  };
}

function createJob(
  overrides: Partial<GenerationThreadSubmissionJob> = {},
): GenerationThreadSubmissionJob {
  return {
    id: "job_1",
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "succeeded",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    result: createResult(),
    ...overrides,
  };
}

function createResult(
  overrides: Partial<NonNullable<GenerationThreadSubmissionJob["result"]>> = {},
): NonNullable<GenerationThreadSubmissionJob["result"]> {
  return {
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    providerStatus: "succeeded",
    videoUrl: "https://assets.example/video.mp4",
    previewImageUrl: null,
    mediaUrlExpiresAt: null,
    providerError: null,
    receivedAt: "2026-06-05T00:01:00.000Z",
    createdAt: "2026-06-05T00:01:01.000Z",
    updatedAt: "2026-06-05T00:01:02.000Z",
    ...overrides,
  };
}

function createField(overrides: Partial<VideoFieldSpec> = {}): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  };
}

function createModel(
  fields: [VideoFieldSpec, ...VideoFieldSpec[]],
): PublishedGenerationModelSummary {
  const fieldIds = fields.map((field) => field.id) as [
    VideoFieldSpec["id"],
    ...VideoFieldSpec["id"][],
  ];

  return {
    id: "test-model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Test Model",
    type: "video",
    latestSpecId: "test-model-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "test-model",
      provider: "byteplus",
      providerModelId: null,
      displayName: "Test Model",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/test",
      },
      modelParameter: {
        path: ["model"],
        source: "runtime",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds,
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

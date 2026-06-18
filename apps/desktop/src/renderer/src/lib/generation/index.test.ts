import { describe, expect, it } from "vitest";

import {
  buildVideoPreviewStack,
  buildVideoPreviewStackForJob,
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
  it("builds a single-layer preview stack for a succeeded job preview", () => {
    const job = createJob({
      id: "job_preview",
      result: createResult({
        previewImageUrl: "https://assets.example/preview.jpg",
      }),
    });

    expect(buildVideoPreviewStackForJob(job)).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/preview.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job,
        },
      ],
    });
  });

  it("builds a single-layer fallback stack when a job video is missing its preview", () => {
    const job = createJob({
      id: "job_fallback",
      result: createResult({
        videoUrl: "https://assets.example/no-preview.mp4",
        previewImageUrl: null,
      }),
    });

    expect(buildVideoPreviewStackForJob(job)).toEqual({
      layers: [
        {
          kind: "fallback",
          previewImageUrl: generationVideoPreviewFallbackImageUrl,
          videoUrl: "https://assets.example/no-preview.mp4",
          reason: "missingVideoPreview",
          job,
        },
      ],
    });
  });

  it("builds a single-layer image-only preview stack when a job has no video URL", () => {
    const job = createJob({
      id: "job_image",
      result: createResult({
        videoUrl: null,
        previewImageUrl: "https://assets.example/image.jpg",
      }),
    });

    expect(buildVideoPreviewStackForJob(job)).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/image.jpg",
          videoUrl: null,
          job,
        },
      ],
    });
  });

  it("returns null for queued, failed, or assetless jobs", () => {
    expect(
      buildVideoPreviewStackForJob(
        createJob({
          id: "job_queued",
          status: "queued",
          result: createResult({
            previewImageUrl: "https://assets.example/queued.jpg",
          }),
        }),
      ),
    ).toBeNull();
    expect(
      buildVideoPreviewStackForJob(
        createJob({
          id: "job_failed",
          status: "failed",
          result: createResult({
            previewImageUrl: "https://assets.example/failed.jpg",
          }),
        }),
      ),
    ).toBeNull();
    expect(
      buildVideoPreviewStackForJob(
        createJob({
          id: "job_without_result",
          result: null,
        }),
      ),
    ).toBeNull();
    expect(
      buildVideoPreviewStackForJob(
        createJob({
          id: "job_assetless",
          result: createResult({
            videoUrl: null,
            previewImageUrl: null,
          }),
        }),
      ),
    ).toBeNull();
  });

  it("returns null for jobs that are not completed with displayable results", () => {
    expect(
      buildVideoPreviewStack(
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

    expect(buildRequiredVideoPreviewStack(submission)).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/first.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job: jobs[1],
        },
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/later.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job: jobs[0],
        },
      ],
    });
    expect(submission.jobs.map((job) => job.id)).toEqual([
      "job_later",
      "job_first",
    ]);
  });

  it("duplicates the front preview for pending generation layers", () => {
    const jobs = [
      createJob({
        id: "job_done",
        submissionIndex: 0,
        result: createResult({
          previewImageUrl: "https://assets.example/done.jpg",
        }),
      }),
      createJob({
        id: "job_pending",
        submissionIndex: 1,
        status: "queued",
        result: null,
      }),
    ];

    expect(
      buildRequiredVideoPreviewStack(createThreadSubmission(jobs)),
    ).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/done.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job: jobs[0],
        },
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/done.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job: jobs[0],
        },
      ],
    });
  });

  it("uses distinct completed previews by submission index and caps visible layers", () => {
    const jobs = [
      createJob({
        id: "job_third",
        submissionIndex: 2,
        result: createResult({
          previewImageUrl: "https://assets.example/third.jpg",
        }),
      }),
      createJob({
        id: "job_first",
        submissionIndex: 0,
        result: createResult({
          previewImageUrl: "https://assets.example/first.jpg",
        }),
      }),
      createJob({
        id: "job_second",
        submissionIndex: 1,
        result: createResult({
          previewImageUrl: "https://assets.example/second.jpg",
        }),
      }),
      createJob({
        id: "job_fourth",
        submissionIndex: 3,
        result: createResult({
          previewImageUrl: "https://assets.example/fourth.jpg",
        }),
      }),
    ];
    const stack = buildRequiredVideoPreviewStack(createThreadSubmission(jobs));

    expect(stack.layers.map((layer) => layer.previewImageUrl)).toEqual([
      "https://assets.example/first.jpg",
      "https://assets.example/second.jpg",
      "https://assets.example/third.jpg",
    ]);
  });

  it("keeps the first succeeded preview in front when earlier jobs only have fallback video", () => {
    const jobs = [
      createJob({
        id: "job_video_without_preview",
        submissionIndex: 0,
        result: createResult({
          videoUrl: "https://assets.example/no-preview.mp4",
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
    ];

    expect(
      buildRequiredVideoPreviewStack(createThreadSubmission(jobs)),
    ).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/preview.jpg",
          videoUrl: "https://assets.example/video.mp4",
          job: jobs[1],
        },
        {
          kind: "fallback",
          previewImageUrl: generationVideoPreviewFallbackImageUrl,
          videoUrl: "https://assets.example/no-preview.mp4",
          reason: "missingVideoPreview",
          job: jobs[0],
        },
      ],
    });
  });

  it("returns fallback layers when succeeded videos have no preview", () => {
    const jobs = [
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
    ];

    expect(
      buildRequiredVideoPreviewStack(createThreadSubmission(jobs)),
    ).toEqual({
      layers: [
        {
          kind: "fallback",
          previewImageUrl: generationVideoPreviewFallbackImageUrl,
          videoUrl: "https://assets.example/first.mp4",
          reason: "missingVideoPreview",
          job: jobs[1],
        },
        {
          kind: "fallback",
          previewImageUrl: generationVideoPreviewFallbackImageUrl,
          videoUrl: "https://assets.example/later.mp4",
          reason: "missingVideoPreview",
          job: jobs[0],
        },
      ],
    });
  });

  it("treats a preview image without a video URL as an image preview", () => {
    expect(
      buildRequiredVideoPreviewStack(
        createThreadSubmission([
          createJob({
            result: createResult({
              videoUrl: null,
              previewImageUrl: "https://assets.example/image.jpg",
            }),
          }),
        ]),
      ),
    ).toEqual({
      layers: [
        {
          kind: "preview",
          previewImageUrl: "https://assets.example/image.jpg",
          videoUrl: null,
          job: expect.any(Object),
        },
      ],
    });
  });
});

function buildRequiredVideoPreviewStack(
  submission: GenerationThreadSubmission,
) {
  const stack = buildVideoPreviewStack(submission);

  if (!stack) {
    throw new Error("Expected submission to have a video preview stack.");
  }

  return stack;
}

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
	    referenceMedia: {
	      images: [],
	      videos: [],
	      audios: [],
	    },
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

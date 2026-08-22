import { describe, expect, it } from "vitest";

import {
  buildImagePreviewStack,
  buildImagePreviewStackForJob,
  buildModel3dPreviewStackForJob,
  buildVideoPreviewStack,
  buildVideoPreviewStackForJob,
  generationVideoPreviewFallbackImageUrl,
} from "./generation-preview.ts";

import type {
  GenerationThreadSubmissionJob,
  ImageGenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";

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

  it("builds image preview stacks from signed result assets", () => {
    const jobs = [
      createJob({
        id: "job_second",
        submissionIndex: 1,
        result: createResult({
          videoUrl: null,
          assets: [createImageAsset("https://assets.example/second.jpg")],
        }),
      }),
      createJob({
        id: "job_first",
        submissionIndex: 0,
        result: createResult({
          videoUrl: null,
          assets: [createImageAsset("https://assets.example/first.jpg")],
        }),
      }),
    ];

    expect(buildImagePreviewStackForJob(jobs[1]!)).toEqual({
      layers: [
        {
          generatedImage: {
            jobId: "job_first",
            url: "https://assets.example/first.jpg",
            contentLength: 1024,
            contentType: "image/jpeg",
          },
          kind: "image",
          previewImageUrl: "https://assets.example/first.jpg",
          imageUrl: "https://assets.example/first.jpg",
          job: jobs[1],
        },
      ],
    });
    expect(
      buildImagePreviewStack(createImageThreadSubmission(jobs))?.layers.map(
        (layer) => layer.imageUrl,
      ),
    ).toEqual([
      "https://assets.example/first.jpg",
      "https://assets.example/second.jpg",
    ]);
  });

  it("does not use legacy preview fields for image-model results", () => {
    expect(
      buildImagePreviewStackForJob(
        createJob({
          result: createResult({
            videoUrl: null,
            previewImageUrl: "https://assets.example/legacy.jpg",
            assets: [],
          }),
        }),
      ),
    ).toBeNull();
  });

  it("builds model3d previews from durable assets and keeps preview images optional", () => {
    const job = createJob({
      id: "job_model3d",
      result: createResult({
        videoUrl: null,
        assets: [
          createModel3dAsset("https://assets.example/model.glb"),
          createImageAsset("https://assets.example/model-preview.jpg"),
        ],
      }),
    });

    expect(buildModel3dPreviewStackForJob(job)).toEqual({
      layers: [
        {
          kind: "model3d",
          previewImageUrl: "https://assets.example/model-preview.jpg",
          modelUrl: "https://assets.example/model.glb",
          downloadUrl: "/api/generation/jobs/job_model3d/model3d-file",
          job,
        },
      ],
    });

    expect(
      buildModel3dPreviewStackForJob(
        createJob({
          result: createResult({
            videoUrl: null,
            assets: [createModel3dAsset("https://assets.example/plain.glb")],
          }),
        }),
      )?.layers[0]?.previewImageUrl,
    ).toBeNull();
  });
});

function buildRequiredVideoPreviewStack(
  submission: VideoGenerationThreadSubmission,
) {
  const stack = buildVideoPreviewStack(submission);

  if (!stack) {
    throw new Error("Expected submission to have a video preview stack.");
  }

  return stack;
}

function createThreadSubmission(
  jobs: GenerationThreadSubmissionJob[],
): VideoGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName: "Seedance 2.0",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio.",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: jobs.length,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs,
  };
}

function createImageThreadSubmission(
  jobs: GenerationThreadSubmissionJob[],
): ImageGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "nano-banana-2",
    modelDisplayName: "Nano Banana 2",
    modelType: "image",
    modelSpecId: "nano-banana-2-v1",
    submittedInput: {
      prompt: "A quiet ocean studio.",
      aspectRatio: "1:1",
      resolution: "1K",
    },
    requestedGenerations: jobs.length,
    attachmentMedia: {
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

function createImageAsset(url: string) {
  return {
    kind: "image" as const,
    bucket: "generation-results",
    objectKey: "image-result",
    contentType: "image/jpeg",
    contentLength: 1024,
    etag: null,
    checksumSha256: null,
    sourceProviderUrl: null,
    url,
    urlExpiresAt: "2026-06-05T00:06:00.000Z",
  };
}

function createModel3dAsset(url: string) {
  return {
    kind: "model3d" as const,
    bucket: "generation-results",
    objectKey: "model-result",
    contentType: "model/gltf-binary",
    contentLength: 4_096,
    etag: null,
    checksumSha256: null,
    sourceProviderUrl: null,
    url,
    urlExpiresAt: "2026-06-05T00:06:00.000Z",
  };
}

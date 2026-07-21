import { createHash } from "node:crypto";

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generationRouter,
  registerGenerationCallbackRoutes,
} from "./generation.router.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
} from "../generation-thread/generation-thread.types.ts";
import {
  GenerationInputValidationError,
  GenerationModelTypeMismatchError,
  GenerationProviderTaskMismatchError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  createImageGenerationSubmission: vi.fn(),
  createVideoGenerationSubmission: vi.fn(),
  finalizeUnsuccessfulGenerationJob: vi.fn(),
  getGenerationJobById: vi.fn(),
  listSignedAttachmentMediaFromSubmission: vi.fn(),
  listSubmissionsFromThread: vi.fn(),
  normalizeVideoGenerationProviderCallback: vi.fn(),
  signalVideoGenerationProviderCallback: vi.fn(),
  startGenerationWorkflow: vi.fn(),
  startGenerationThreadNameWorkflow: vi.fn(),
}));

vi.mock("../../app.service.ts", () => ({
  generationService: {
    createImageGenerationSubmission: mocks.createImageGenerationSubmission,
    createVideoGenerationSubmission: mocks.createVideoGenerationSubmission,
    finalizeUnsuccessfulGenerationJob: mocks.finalizeUnsuccessfulGenerationJob,
    listSubmissionsFromThread: mocks.listSubmissionsFromThread,
    normalizeVideoGenerationProviderCallback:
      mocks.normalizeVideoGenerationProviderCallback,
  },
  generationAttachmentMediaService: {
    listSignedAttachmentMediaFromSubmission:
      mocks.listSignedAttachmentMediaFromSubmission,
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getGenerationJobById: mocks.getGenerationJobById,
  },
}));

vi.mock("../../temporal/client.ts", () => ({
  signalVideoGenerationProviderCallback:
    mocks.signalVideoGenerationProviderCallback,
  startGenerationWorkflow: mocks.startGenerationWorkflow,
  startGenerationThreadNameWorkflow: mocks.startGenerationThreadNameWorkflow,
}));

describe("generation router", () => {
  beforeEach(() => {
    mocks.createImageGenerationSubmission.mockReset();
    mocks.createVideoGenerationSubmission.mockReset();
    mocks.finalizeUnsuccessfulGenerationJob.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.listSignedAttachmentMediaFromSubmission.mockReset();
    mocks.listSubmissionsFromThread.mockReset();
    mocks.normalizeVideoGenerationProviderCallback.mockReset();
    mocks.signalVideoGenerationProviderCallback.mockReset();
    mocks.startGenerationWorkflow.mockReset();
    mocks.startGenerationThreadNameWorkflow.mockReset();
    vi.stubEnv("API_PUBLIC_ORIGIN", "https://api.example.test");
    mocks.createVideoGenerationSubmission.mockResolvedValue({
      submission: {
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
      },
      jobs: [
        {
          job: {
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
          },
          callbackToken: "callback-token",
        },
      ],
      createdThread: null,
    });
    mocks.createImageGenerationSubmission.mockResolvedValue({
      submission: {
        id: "image_submission_1",
        threadId: "thread_1",
        userId: "user_1",
        modelId: "nano-banana-2",
        modelType: "image",
        modelSpecId: "nano-banana-2-v1",
        submittedInput: {
          prompt: "Glass flowers",
          resolution: "1K",
          aspectRatio: "1:1",
        },
        requestedGenerations: 1,
        attachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
      jobs: [
        {
          id: "image_job_1",
          submissionId: "image_submission_1",
          submissionIndex: 0,
          status: "queued",
          temporalWorkflowId: null,
          temporalRunId: null,
          callbackTokenHash: null,
          providerId: "google",
          providerTaskId: null,
          providerModelId: "gemini-3.1-flash-image",
          terminalError: null,
          createdAt: new Date("2026-06-05T00:00:00.000Z"),
          updatedAt: new Date("2026-06-05T00:00:00.000Z"),
        },
      ],
      createdThread: null,
    });
    mocks.startGenerationThreadNameWorkflow.mockResolvedValue({
      workflowId: "generation-thread-name:thread_1",
      runId: "thread-name-run_1",
      alreadyStarted: false,
    });
    mocks.startGenerationWorkflow.mockImplementation(
      ({ jobId }: { jobId: string }) =>
        Promise.resolve({
          workflowId: `generation-job:${jobId}`,
          runId: `${jobId}_run`,
        }),
    );
    mocks.normalizeVideoGenerationProviderCallback.mockImplementation(
      ({ rawPayload, receivedAt }) =>
        Promise.resolve({
          kind: "result",
          result: {
            provider: "byteplus",
            providerTaskId: "cgt-123",
            providerModelId: "dreamina-seedance-2-0-260128",
            status: "succeeded",
            videoUrl: "https://assets.example/video.mp4",
            usage: null,
            createdAt: null,
            updatedAt: null,
            providerError: null,
          },
          rawPayload,
          receivedAt,
        }),
    );
    mocks.finalizeUnsuccessfulGenerationJob.mockResolvedValue({
      id: "job_1",
      submissionId: "submission_1",
      submissionIndex: 0,
      status: "failed",
      temporalWorkflowId: null,
      temporalRunId: null,
      callbackTokenHash: "callback-token-hash",
      providerId: "byteplus",
      providerTaskId: null,
      providerModelId: "dreamina-seedance-2-0-260128",
      terminalError: {
        source: "internal",
        code: "WORKFLOW_START_FAILED",
        message: "Temporal is unavailable",
      },
      createdAt: new Date("2026-06-05T00:00:00.000Z"),
      updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    });
    mocks.getGenerationJobById.mockResolvedValue(createCallbackJob());
    mocks.listSubmissionsFromThread.mockResolvedValue([
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
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:01:00.000Z",
        jobs: [
          {
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
            result: {
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
            },
          },
        ],
      },
    ]);
    mocks.listSignedAttachmentMediaFromSubmission.mockResolvedValue([
      {
        id: "reference_image_1",
        kind: "image",
        fieldId: "images",
        role: "reference",
        originalFileName: "reference.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
        createdAt: "2026-06-05T00:00:00.000Z",
        url: "https://signed.example/reference.png",
        urlExpiresAt: "2026-06-05T00:17:00.000Z",
      },
    ]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("validates createVideo input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createVideoGenerationSubmission).not.toHaveBeenCalled();
  });

  it("creates image submissions and starts the synchronous image workflow", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());
    const input = {
      modelId: "nano-banana-2",
      modelSpecId: "nano-banana-2-v1",
      prompt: "Glass flowers",
      resolution: "1K",
      aspectRatio: "1:1",
      requestedGenerations: 1,
    };

    await expect(caller.createImage(input)).resolves.toEqual({
      submissionId: "image_submission_1",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "image_job_1",
          workflowId: "generation-job:image_job_1",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    expect(mocks.createImageGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input,
    });
    expect(mocks.startGenerationWorkflow).toHaveBeenCalledWith({
      jobId: "image_job_1",
      submissionId: "image_submission_1",
      modelId: "nano-banana-2",
      modelSpecId: "nano-banana-2-v1",
      providerId: "google",
      submittedInput: {
        prompt: "Glass flowers",
        resolution: "1K",
        aspectRatio: "1:1",
      },
      hasAttachmentMedia: false,
      providerExecution: {
        mode: "inline",
        outputKind: "image",
      },
    });
  });

  it("rejects video-only fields from image creation", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createImage({
        modelId: "nano-banana-2",
        modelSpecId: "nano-banana-2-v1",
        prompt: "Glass flowers",
        resolution: "1K",
        aspectRatio: "1:1",
        requestedGenerations: 1,
        duration: 5,
      } as unknown as Parameters<typeof caller.createImage>[0]),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createImageGenerationSubmission).not.toHaveBeenCalled();
  });

  it("requires createVideo resolution input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      } as unknown as Parameters<typeof caller.createVideo>[0]),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createVideoGenerationSubmission).not.toHaveBeenCalled();
  });

  it("accepts roleful createVideo attachment media input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
        attachmentMedia: {
          images: [{ id: "first_frame_1", role: "firstFrame" }],
          videos: [{ id: "reference_video_1", role: "reference" }],
          audios: [{ id: "reference_audio_1", role: "reference" }],
        },
      }),
    ).resolves.toMatchObject({
      submissionId: "submission_1",
      threadId: "thread_1",
    });
    expect(mocks.createVideoGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: expect.objectContaining({
        attachmentMedia: {
          images: [{ id: "first_frame_1", role: "firstFrame" }],
          videos: [{ id: "reference_video_1", role: "reference" }],
          audios: [{ id: "reference_audio_1", role: "reference" }],
        },
      }),
    });
  });

  it("rejects legacy attachment media id arrays", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
        attachmentMedia: {
          images: ["reference_image_1"],
        },
      } as unknown as Parameters<typeof caller.createVideo>[0]),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createVideoGenerationSubmission).not.toHaveBeenCalled();
  });

  it("validates requested generation count input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());
    const input = {
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    };

    await expect(
      caller.createVideo({
        ...input,
        requestedGenerations: 0,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.createVideo({
        ...input,
        requestedGenerations: 16,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      caller.createVideo({
        ...input,
        requestedGenerations: 1.5,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.createVideoGenerationSubmission).not.toHaveBeenCalled();
  });

  it("rejects createVideo requests that target both a thread and project", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        threadId: "thread_1",
        projectId: "project_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createVideoGenerationSubmission).not.toHaveBeenCalled();
  });

  it("validates listThreadSubmissions input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listSubmissionsFromThread({
        threadId: "",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.listSubmissionsFromThread).not.toHaveBeenCalled();
  });

  it("lists thread submissions for the signed-in user", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listSubmissionsFromThread({ threadId: "thread_1" }),
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
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:01:00.000Z",
        jobs: [
          {
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
            result: {
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
            },
          },
        ],
      },
    ]);
    expect(mocks.listSubmissionsFromThread).toHaveBeenCalledWith({
      userId: "user_1",
      threadId: "thread_1",
    });
  });

  it("lists signed attachment media for a signed-in user's submission", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listAttachmentMediaFromSubmission({
        submissionId: "submission_1",
      }),
    ).resolves.toEqual([
      {
        id: "reference_image_1",
        kind: "image",
        fieldId: "images",
        role: "reference",
        originalFileName: "reference.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
        createdAt: "2026-06-05T00:00:00.000Z",
        url: "https://signed.example/reference.png",
        urlExpiresAt: "2026-06-05T00:17:00.000Z",
      },
    ]);
    expect(mocks.listSignedAttachmentMediaFromSubmission).toHaveBeenCalledWith({
      submissionId: "submission_1",
      userId: "user_1",
    });
  });

  it("returns no attachment media for missing or inaccessible submissions", async () => {
    mocks.listSignedAttachmentMediaFromSubmission.mockResolvedValueOnce([]);
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listAttachmentMediaFromSubmission({
        submissionId: "cross_user_submission",
      }),
    ).resolves.toEqual([]);
  });

  it("rejects attachment media list requests without a signed-in user", async () => {
    const caller = generationRouter.createCaller(createSignedOutContext());

    await expect(
      caller.listAttachmentMediaFromSubmission({
        submissionId: "submission_1",
      }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(
      mocks.listSignedAttachmentMediaFromSubmission,
    ).not.toHaveBeenCalled();
  });

  it("rejects unsupported models with a user-readable message", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new UnsupportedGenerationModelError("kling-2.1-video"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "kling-2.1-video",
        modelSpecId: "kling-2.1-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Unsupported generation model: kling-2.1-video",
    });
    expect(mocks.createVideoGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        modelId: "kling-2.1-video",
        modelSpecId: "kling-2.1-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
  });

  it("rejects image models sent through the video mutation", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new GenerationModelTypeMismatchError("image-model", "video", "image"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "image-model",
        modelSpecId: "image-model-v1",
        prompt: "A quiet ocean studio",
        resolution: "2k",
        aspectRatio: "1:1",
        duration: 5,
        generateAudio: false,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Generation model image-model is image, not video",
    });
  });

  it("maps spec validation failures to a user-readable message", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new GenerationInputValidationError(
        "aspectRatio",
        "aspectRatio must match a supported model option",
      ),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "2:1",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "aspectRatio must match a supported model option",
    });
  });

  it("maps insufficient credit balance errors without starting workflows", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new InsufficientCreditBalanceError({
        userId: "user_1",
        requiredAmountUsdMicros: 420_000,
      }),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.startGenerationWorkflow).not.toHaveBeenCalled();
  });

  it("creates a local job and starts the video generation workflow", async () => {
    const createdSubmission = await mocks.createVideoGenerationSubmission();
    mocks.createVideoGenerationSubmission.mockClear();
    mocks.createVideoGenerationSubmission.mockResolvedValue({
      ...createdSubmission,
      createdThread: {
        id: "thread_1",
        projectId: null,
        userId: "user_1",
        name: "A quiet ocean studio",
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    });
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).resolves.toEqual({
      submissionId: "submission_1",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "job_1",
          workflowId: "generation-job:job_1",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    expect(mocks.createVideoGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
    expect(mocks.startGenerationWorkflow).toHaveBeenCalledWith({
      jobId: "job_1",
      submissionId: "submission_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      providerId: "byteplus",
      submittedInput: {
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      hasAttachmentMedia: false,
      providerExecution: {
        mode: "callback",
        outputKind: "video",
        callbackUrl:
          "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=callback-token",
      },
    });
    expect(mocks.startGenerationThreadNameWorkflow).toHaveBeenCalledWith({
      threadId: "thread_1",
      userId: "user_1",
      prompt: "A quiet ocean studio",
      provisionalName: "A quiet ocean studio",
    });
  });

  it("keeps submission creation successful when name workflow scheduling fails", async () => {
    const createdSubmission = await mocks.createVideoGenerationSubmission();
    mocks.createVideoGenerationSubmission.mockClear();
    mocks.createVideoGenerationSubmission.mockResolvedValue({
      ...createdSubmission,
      createdThread: {
        id: "thread_1",
        projectId: null,
        userId: "user_1",
        name: "A quiet ocean studio",
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    });
    mocks.startGenerationThreadNameWorkflow.mockRejectedValueOnce(
      new Error("Temporal unavailable"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).resolves.toMatchObject({
      submissionId: "submission_1",
      threadId: "thread_1",
    });
  });

  it("creates videos in new project threads", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        projectId: "project_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).resolves.toMatchObject({
      submissionId: "submission_1",
      threadId: "thread_1",
    });

    expect(mocks.createVideoGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        projectId: "project_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
  });

  it("creates videos in existing threads", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).resolves.toMatchObject({
      submissionId: "submission_1",
      threadId: "thread_1",
    });

    expect(mocks.createVideoGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
    expect(mocks.startGenerationThreadNameWorkflow).not.toHaveBeenCalled();
  });

  it("maps missing or cross-user threads to not found", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new GenerationThreadNotFoundError("thread_1"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Generation thread was not found: thread_1",
    });
  });

  it("maps missing or inactive projects to not found", async () => {
    mocks.createVideoGenerationSubmission.mockRejectedValueOnce(
      new GenerationProjectNotFoundError("project_1"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        projectId: "project_1",
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "Generation project was not found: project_1",
    });
  });

  it("starts requested jobs with distinct callback tokens", async () => {
    mocks.createVideoGenerationSubmission.mockResolvedValueOnce({
      submission: {
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
        requestedGenerations: 2,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
      jobs: [
        {
          job: {
            id: "job_1",
            submissionId: "submission_1",
            submissionIndex: 0,
            status: "queued",
            temporalWorkflowId: null,
            temporalRunId: null,
            callbackTokenHash: "callback-token-hash-1",
            providerId: "byteplus",
            providerTaskId: null,
            providerModelId: "dreamina-seedance-2-0-260128",
            terminalError: null,
            createdAt: new Date("2026-06-05T00:00:00.000Z"),
            updatedAt: new Date("2026-06-05T00:00:00.000Z"),
          },
          callbackToken: "callback-token-1",
        },
        {
          job: {
            id: "job_2",
            submissionId: "submission_1",
            submissionIndex: 1,
            status: "queued",
            temporalWorkflowId: null,
            temporalRunId: null,
            callbackTokenHash: "callback-token-hash-2",
            providerId: "byteplus",
            providerTaskId: null,
            providerModelId: "dreamina-seedance-2-0-260128",
            terminalError: null,
            createdAt: new Date("2026-06-05T00:00:00.000Z"),
            updatedAt: new Date("2026-06-05T00:00:00.000Z"),
          },
          callbackToken: "callback-token-2",
        },
      ],
    });
    mocks.startGenerationWorkflow
      .mockResolvedValueOnce({
        workflowId: "generation-job:job_1",
        runId: "run_1",
      })
      .mockResolvedValueOnce({
        workflowId: "generation-job:job_2",
        runId: "run_2",
      });
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 2,
      }),
    ).resolves.toEqual({
      submissionId: "submission_1",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "job_1",
          workflowId: "generation-job:job_1",
          status: "queued",
          terminalError: null,
        },
        {
          jobId: "job_2",
          workflowId: "generation-job:job_2",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    expect(mocks.startGenerationWorkflow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: "job_1",
        providerExecution: {
          mode: "callback",
          outputKind: "video",
          callbackUrl:
            "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=callback-token-1",
        },
      }),
    );
    expect(mocks.startGenerationWorkflow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: "job_2",
        providerExecution: {
          mode: "callback",
          outputKind: "video",
          callbackUrl:
            "https://api.example.test/api/generation-callbacks/byteplus/job_2?token=callback-token-2",
        },
      }),
    );
  });

  it("returns mixed job results when workflow starts fail best-effort", async () => {
    const workflowError = new Error("Temporal is unavailable");
    mocks.createVideoGenerationSubmission.mockResolvedValueOnce({
      submission: {
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
        requestedGenerations: 2,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
      jobs: [
        {
          job: {
            id: "job_1",
            submissionId: "submission_1",
            submissionIndex: 0,
            status: "queued",
            temporalWorkflowId: null,
            temporalRunId: null,
            callbackTokenHash: "callback-token-hash-1",
            providerId: "byteplus",
            providerTaskId: null,
            providerModelId: "dreamina-seedance-2-0-260128",
            terminalError: null,
            createdAt: new Date("2026-06-05T00:00:00.000Z"),
            updatedAt: new Date("2026-06-05T00:00:00.000Z"),
          },
          callbackToken: "callback-token-1",
        },
        {
          job: {
            id: "job_2",
            submissionId: "submission_1",
            submissionIndex: 1,
            status: "queued",
            temporalWorkflowId: null,
            temporalRunId: null,
            callbackTokenHash: "callback-token-hash-2",
            providerId: "byteplus",
            providerTaskId: null,
            providerModelId: "dreamina-seedance-2-0-260128",
            terminalError: null,
            createdAt: new Date("2026-06-05T00:00:00.000Z"),
            updatedAt: new Date("2026-06-05T00:00:00.000Z"),
          },
          callbackToken: "callback-token-2",
        },
      ],
    });
    mocks.startGenerationWorkflow
      .mockRejectedValueOnce(workflowError)
      .mockResolvedValueOnce({
        workflowId: "generation-job:job_2",
        runId: "run_2",
      });
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 2,
      }),
    ).resolves.toEqual({
      submissionId: "submission_1",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "job_1",
          workflowId: null,
          status: "failed",
          terminalError: {
            source: "internal",
            code: "WORKFLOW_START_FAILED",
            message: "Temporal is unavailable",
          },
        },
        {
          jobId: "job_2",
          workflowId: "generation-job:job_2",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    expect(mocks.finalizeUnsuccessfulGenerationJob).toHaveBeenCalledWith({
      jobId: "job_1",
      status: "failed",
      terminalError: {
        source: "internal",
        code: "WORKFLOW_START_FAILED",
        message: "Temporal is unavailable",
      },
    });
  });

  it("rejects callbacks with invalid tokens", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=wrong-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(401);
    expect(mocks.signalVideoGenerationProviderCallback).not.toHaveBeenCalled();
    await server.close();
  });

  it("rejects callbacks when the path provider does not match the job provider", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/kling/job_1?token=callback-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(404);
    expect(mocks.signalVideoGenerationProviderCallback).not.toHaveBeenCalled();
    await server.close();
  });

  it("delegates valid provider callbacks to the generation service and Temporal", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(202);
    expect(mocks.normalizeVideoGenerationProviderCallback).toHaveBeenCalledWith(
      {
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        expectedProviderTaskId: "cgt-123",
        rawPayload: createCallbackPayload(),
        receivedAt: expect.any(String),
      },
    );
    expect(mocks.signalVideoGenerationProviderCallback).toHaveBeenCalledWith({
      jobId: "job_1",
      callback: expect.objectContaining({
        kind: "result",
        result: expect.objectContaining({
          provider: "byteplus",
          providerTaskId: "cgt-123",
          status: "succeeded",
          videoUrl: "https://assets.example/video.mp4",
        }),
        rawPayload: createCallbackPayload(),
      }),
    });
    await server.close();
  });

  it("signals Temporal failure for valid authenticated malformed callbacks", async () => {
    mocks.normalizeVideoGenerationProviderCallback.mockImplementationOnce(
      ({ rawPayload, receivedAt }) =>
        Promise.resolve({
          kind: "malformed",
          terminalError: {
            source: "provider",
            code: "MALFORMED_PROVIDER_CALLBACK",
            message: "Provider callback payload could not be parsed",
          },
          rawPayload,
          receivedAt,
        }),
    );
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: {
        unexpected: true,
      },
    });

    expect(response.statusCode).toBe(202);
    expect(mocks.normalizeVideoGenerationProviderCallback).toHaveBeenCalledWith(
      {
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        expectedProviderTaskId: "cgt-123",
        rawPayload: {
          unexpected: true,
        },
        receivedAt: expect.any(String),
      },
    );
    expect(mocks.signalVideoGenerationProviderCallback).toHaveBeenCalledWith({
      jobId: "job_1",
      callback: expect.objectContaining({
        kind: "malformed",
        terminalError: {
          source: "provider",
          code: "MALFORMED_PROVIDER_CALLBACK",
          message: "Provider callback payload could not be parsed",
        },
        rawPayload: {
          unexpected: true,
        },
      }),
    });
    await server.close();
  });

  it("maps provider task id mismatches from the generation service to conflict", async () => {
    mocks.normalizeVideoGenerationProviderCallback.mockRejectedValueOnce(
      new GenerationProviderTaskMismatchError("cgt-123", "cgt-456"),
    );
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: {
        ...createCallbackPayload(),
        id: "cgt-456",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "Provider task id did not match generation job",
    });
    expect(mocks.normalizeVideoGenerationProviderCallback).toHaveBeenCalledWith(
      {
        modelId: "seedance-2.0-video",
        modelSpecId: "seedance-2.0-video-v1",
        expectedProviderTaskId: "cgt-123",
        rawPayload: {
          ...createCallbackPayload(),
          id: "cgt-456",
        },
        receivedAt: expect.any(String),
      },
    );
    expect(mocks.signalVideoGenerationProviderCallback).not.toHaveBeenCalled();
    await server.close();
  });

  it("accepts callbacks for jobs that already failed final cost calculation", async () => {
    mocks.getGenerationJobById.mockResolvedValueOnce(
      createCallbackJob({ status: "final_cost_calculation_failure" }),
    );
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(202);
    expect(mocks.signalVideoGenerationProviderCallback).not.toHaveBeenCalled();
    await server.close();
  });

  it("returns conflict when Temporal cannot accept a valid callback", async () => {
    mocks.signalVideoGenerationProviderCallback.mockRejectedValueOnce(
      new Error("Workflow closed"),
    );
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(409);
    await server.close();
  });
});

async function createServer() {
  const server = Fastify();

  await registerGenerationCallbackRoutes(server);

  return server;
}

function createCallbackJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job_1",
    submissionId: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    status: "waiting_for_provider_callback",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    temporalWorkflowId: "generation-job:job_1",
    temporalRunId: "run_1",
    callbackTokenHash: hashCallbackToken("callback-token"),
    ...overrides,
  };
}

function createCallbackPayload() {
  return {
    id: "cgt-123",
    model: "dreamina-seedance-2-0-260128",
    status: "succeeded",
    content: {
      video_url: "https://assets.example/video.mp4",
    },
  };
}

function hashCallbackToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}

function createSignedOutContext(): TRPCContext {
  return {
    session: null,
    user: null,
  } as TRPCContext;
}

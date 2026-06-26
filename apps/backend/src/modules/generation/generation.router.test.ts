import { createHash } from "node:crypto";

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generationRouter,
  registerGenerationCallbackRoutes,
} from "./generation.router.ts";
import { InsufficientCreditBalanceError } from "../credits/credits.types.ts";
import {
  GenerationInputValidationError,
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  createVideoGenerationSubmission: vi.fn(),
  finalizeUnsuccessfulGenerationJob: vi.fn(),
  getGenerationJobById: vi.fn(),
  listSignedAttachmentMediaFromSubmission: vi.fn(),
  listSubmissionsFromThread: vi.fn(),
  listThreadsWithoutProjectForUser: vi.fn(),
  signalSeedanceVideoGenerationProviderCallback: vi.fn(),
  startSeedanceVideoGenerationWorkflow: vi.fn(),
}));

vi.mock("../../app.service.ts", () => ({
  generationService: {
    createVideoGenerationSubmission: mocks.createVideoGenerationSubmission,
    finalizeUnsuccessfulGenerationJob: mocks.finalizeUnsuccessfulGenerationJob,
    listSubmissionsFromThread: mocks.listSubmissionsFromThread,
  },
  generationAttachmentMediaService: {
    listSignedAttachmentMediaFromSubmission:
      mocks.listSignedAttachmentMediaFromSubmission,
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getGenerationJobById: mocks.getGenerationJobById,
    listThreadsWithoutProjectForUser: mocks.listThreadsWithoutProjectForUser,
  },
}));

vi.mock("../../temporal/client.ts", () => ({
  signalSeedanceVideoGenerationProviderCallback:
    mocks.signalSeedanceVideoGenerationProviderCallback,
  startSeedanceVideoGenerationWorkflow:
    mocks.startSeedanceVideoGenerationWorkflow,
}));

describe("generation router", () => {
  beforeEach(() => {
    mocks.createVideoGenerationSubmission.mockReset();
    mocks.finalizeUnsuccessfulGenerationJob.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.listSignedAttachmentMediaFromSubmission.mockReset();
    mocks.listSubmissionsFromThread.mockReset();
    mocks.listThreadsWithoutProjectForUser.mockReset();
    mocks.signalSeedanceVideoGenerationProviderCallback.mockReset();
    mocks.startSeedanceVideoGenerationWorkflow.mockReset();
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
    });
    mocks.startSeedanceVideoGenerationWorkflow.mockResolvedValue({
      workflowId: "generation-job:job_1",
      runId: "run_1",
    });
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
    mocks.listThreadsWithoutProjectForUser.mockResolvedValue([
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

  it("requires createVideo resolution input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
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

  it("lists threads without a project for the signed-in user", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(caller.listThreadsWithoutProject()).resolves.toEqual([
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
    expect(mocks.listThreadsWithoutProjectForUser).toHaveBeenCalledWith(
      "user_1",
    );
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
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
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
    expect(mocks.startSeedanceVideoGenerationWorkflow).not.toHaveBeenCalled();
  });

  it("creates a local job and starts the Seedance workflow", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
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
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
    expect(mocks.startSeedanceVideoGenerationWorkflow).toHaveBeenCalledWith({
      jobId: "job_1",
      submissionId: "submission_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      hasAttachmentMedia: false,
      callbackUrl:
        "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=callback-token",
    });
  });

  it("creates videos in new project threads", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        projectId: "project_1",
        modelId: "seedance-2.0-video",
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
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 1,
      },
    });
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
    mocks.startSeedanceVideoGenerationWorkflow
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
    expect(mocks.startSeedanceVideoGenerationWorkflow).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jobId: "job_1",
        callbackUrl:
          "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=callback-token-1",
      }),
    );
    expect(mocks.startSeedanceVideoGenerationWorkflow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: "job_2",
        callbackUrl:
          "https://api.example.test/api/generation-callbacks/byteplus/job_2?token=callback-token-2",
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
    mocks.startSeedanceVideoGenerationWorkflow
      .mockRejectedValueOnce(workflowError)
      .mockResolvedValueOnce({
        workflowId: "generation-job:job_2",
        runId: "run_2",
      });
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
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
    expect(
      mocks.signalSeedanceVideoGenerationProviderCallback,
    ).not.toHaveBeenCalled();
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
    expect(
      mocks.signalSeedanceVideoGenerationProviderCallback,
    ).not.toHaveBeenCalled();
    await server.close();
  });

  it("signals Temporal for valid BytePlus callbacks", async () => {
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: createCallbackPayload(),
    });

    expect(response.statusCode).toBe(202);
    expect(
      mocks.signalSeedanceVideoGenerationProviderCallback,
    ).toHaveBeenCalledWith({
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
    const server = await createServer();

    const response = await server.inject({
      method: "POST",
      url: "/api/generation-callbacks/byteplus/job_1?token=callback-token",
      payload: {
        unexpected: true,
      },
    });

    expect(response.statusCode).toBe(202);
    expect(
      mocks.signalSeedanceVideoGenerationProviderCallback,
    ).toHaveBeenCalledWith({
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
    expect(
      mocks.signalSeedanceVideoGenerationProviderCallback,
    ).not.toHaveBeenCalled();
    await server.close();
  });

  it("returns conflict when Temporal cannot accept a valid callback", async () => {
    mocks.signalSeedanceVideoGenerationProviderCallback.mockRejectedValueOnce(
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
    threadId: "thread_1",
    status: "waiting_for_provider_callback",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    temporalWorkflowId: "generation-job:job_1",
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

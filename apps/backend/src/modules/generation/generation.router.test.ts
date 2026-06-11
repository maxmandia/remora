import { createHash } from "node:crypto";

import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generationRouter,
  registerGenerationCallbackRoutes,
} from "./generation.router.ts";
import {
  GenerationInputValidationError,
  GenerationThreadNotFoundError,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  createVideoGenerationJob: vi.fn(),
  getGenerationJobById: vi.fn(),
  listGenerationsFromThread: vi.fn(),
  listGenerationThreadsForUser: vi.fn(),
  markGenerationJobWorkflowStartFailed: vi.fn(),
  signalSeedanceVideoGenerationProviderCallback: vi.fn(),
  startSeedanceVideoGenerationWorkflow: vi.fn(),
}));

vi.mock("./generation.service.ts", () => ({
  generationService: {
    createVideoGenerationJob: mocks.createVideoGenerationJob,
    listGenerationsFromThread: mocks.listGenerationsFromThread,
  },
}));

vi.mock("./generation.repository.ts", () => ({
  generationRepository: {
    getGenerationJobById: mocks.getGenerationJobById,
    listGenerationThreadsForUser: mocks.listGenerationThreadsForUser,
    markGenerationJobWorkflowStartFailed:
      mocks.markGenerationJobWorkflowStartFailed,
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
    mocks.createVideoGenerationJob.mockReset();
    mocks.getGenerationJobById.mockReset();
    mocks.listGenerationsFromThread.mockReset();
    mocks.listGenerationThreadsForUser.mockReset();
    mocks.markGenerationJobWorkflowStartFailed.mockReset();
    mocks.signalSeedanceVideoGenerationProviderCallback.mockReset();
    mocks.startSeedanceVideoGenerationWorkflow.mockReset();
    vi.stubEnv("API_PUBLIC_ORIGIN", "https://api.example.test");
    mocks.createVideoGenerationJob.mockResolvedValue({
      job: {
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
      },
      callbackToken: "callback-token",
    });
    mocks.startSeedanceVideoGenerationWorkflow.mockResolvedValue({
      workflowId: "generation-job:job_1",
      runId: "run_1",
    });
    mocks.getGenerationJobById.mockResolvedValue(createCallbackJob());
    mocks.listGenerationThreadsForUser.mockResolvedValue([
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
    mocks.listGenerationsFromThread.mockResolvedValue([
      {
        id: "job_1",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "succeeded",
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
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
          mediaUrlExpiresAt: null,
          providerError: null,
          receivedAt: "2026-06-05T00:01:00.000Z",
          createdAt: "2026-06-05T00:01:01.000Z",
          updatedAt: "2026-06-05T00:01:02.000Z",
        },
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
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createVideoGenerationJob).not.toHaveBeenCalled();
  });

  it("lists threads for the signed-in user", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(caller.listThreads()).resolves.toEqual([
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
    expect(mocks.listGenerationThreadsForUser).toHaveBeenCalledWith("user_1");
  });

  it("validates listThreadJobs input", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listGenerationsFromThread({
        threadId: "",
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.listGenerationsFromThread).not.toHaveBeenCalled();
  });

  it("lists thread jobs for the signed-in user", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.listGenerationsFromThread({ threadId: "thread_1" }),
    ).resolves.toEqual([
      {
        id: "job_1",
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        status: "succeeded",
        submittedInput: {
          prompt: "A quiet ocean studio",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
        },
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
          mediaUrlExpiresAt: null,
          providerError: null,
          receivedAt: "2026-06-05T00:01:00.000Z",
          createdAt: "2026-06-05T00:01:01.000Z",
          updatedAt: "2026-06-05T00:01:02.000Z",
        },
      },
    ]);
    expect(mocks.listGenerationsFromThread).toHaveBeenCalledWith({
      userId: "user_1",
      threadId: "thread_1",
    });
  });

  it("rejects unsupported models with a typed error code", async () => {
    mocks.createVideoGenerationJob.mockRejectedValueOnce(
      new UnsupportedGenerationModelError("kling-2.1-video"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "kling-2.1-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "UNSUPPORTED_MODEL",
    });
    expect(mocks.createVideoGenerationJob).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        modelId: "kling-2.1-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
    });
  });

  it("maps spec validation failures to a typed error code", async () => {
    mocks.createVideoGenerationJob.mockRejectedValueOnce(
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
        aspectRatio: "2:1",
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "INVALID_GENERATION_INPUT",
    });
  });

  it("creates a local job and starts the Seedance workflow", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).resolves.toEqual({
      jobId: "job_1",
      threadId: "thread_1",
      workflowId: "generation-job:job_1",
      status: "queued",
    });
    expect(mocks.createVideoGenerationJob).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
    });
    expect(mocks.startSeedanceVideoGenerationWorkflow).toHaveBeenCalledWith({
      jobId: "job_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      callbackUrl:
        "https://api.example.test/api/generation-callbacks/byteplus/job_1?token=callback-token",
    });
  });

  it("creates videos in existing threads", async () => {
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).resolves.toMatchObject({
      jobId: "job_1",
      threadId: "thread_1",
    });

    expect(mocks.createVideoGenerationJob).toHaveBeenCalledWith({
      userId: "user_1",
      input: {
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
    });
  });

  it("maps missing or cross-user threads to not found", async () => {
    mocks.createVideoGenerationJob.mockRejectedValueOnce(
      new GenerationThreadNotFoundError("thread_1"),
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        threadId: "thread_1",
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
      message: "GENERATION_THREAD_NOT_FOUND",
    });
  });

  it("marks the local job failed when workflow start fails", async () => {
    const workflowError = new Error("Temporal is unavailable");
    mocks.startSeedanceVideoGenerationWorkflow.mockRejectedValueOnce(
      workflowError,
    );
    const caller = generationRouter.createCaller(createSignedInContext());

    await expect(
      caller.createVideo({
        modelId: "seedance-2.0-video",
        prompt: "A quiet ocean studio",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      }),
    ).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "Temporal is unavailable",
    });
    expect(mocks.createVideoGenerationJob).toHaveBeenCalled();
    expect(mocks.markGenerationJobWorkflowStartFailed).toHaveBeenCalledWith({
      jobId: "job_1",
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

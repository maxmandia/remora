import type {
  CreateImageGenerationInput,
  CreateVideoGenerationInput,
} from "@remora/domain/generation-submission/dto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  StartedGenerationThreadNameWorkflow,
  StartedGenerationWorkflow,
  startGenerationThreadNameWorkflow,
  startGenerationWorkflow,
} from "../../temporal/client.ts";
import { GenerationOrchestrationService } from "./generation-orchestration.service.ts";
import type {
  CreatedGenerationJobRecord,
  CreatedImageGenerationSubmission,
  CreatedVideoGenerationSubmission,
} from "./generation.types.ts";

const imageInput: CreateImageGenerationInput = {
  modelId: "nano-banana-2",
  modelSpecId: "nano-banana-2-v1",
  prompt: "Glass flowers",
  resolution: "1K",
  aspectRatio: "1:1",
  requestedGenerations: 1,
};

const videoInput: CreateVideoGenerationInput = {
  modelId: "seedance-2.0-video",
  modelSpecId: "seedance-2.0-video-v1",
  prompt: "A quiet ocean studio",
  resolution: "720p",
  aspectRatio: "16:9",
  duration: 5,
  generateAudio: true,
  requestedGenerations: 1,
};

describe("GenerationOrchestrationService", () => {
  let createImageGenerationSubmission: ReturnType<
    typeof vi.fn<
      (
        input: Parameters<
          ConstructorParameters<
            typeof GenerationOrchestrationService
          >[0]["createImageGenerationSubmission"]
        >[0],
      ) => Promise<CreatedImageGenerationSubmission>
    >
  >;
  let createVideoGenerationSubmission: ReturnType<
    typeof vi.fn<
      (
        input: Parameters<
          ConstructorParameters<
            typeof GenerationOrchestrationService
          >[0]["createVideoGenerationSubmission"]
        >[0],
      ) => Promise<CreatedVideoGenerationSubmission>
    >
  >;
  let finalizeUnsuccessfulGenerationJob: ReturnType<
    typeof vi.fn<
      ConstructorParameters<
        typeof GenerationOrchestrationService
      >[0]["finalizeUnsuccessfulGenerationJob"]
    >
  >;
  let startWorkflow: ReturnType<typeof vi.fn<typeof startGenerationWorkflow>>;
  let startThreadNameWorkflow: ReturnType<
    typeof vi.fn<typeof startGenerationThreadNameWorkflow>
  >;
  let service: GenerationOrchestrationService;

  beforeEach(() => {
    createImageGenerationSubmission = vi.fn();
    createVideoGenerationSubmission = vi.fn();
    finalizeUnsuccessfulGenerationJob = vi.fn();
    startWorkflow = vi.fn(async (input) =>
      startedWorkflow(`generation-job:${input.jobId}`),
    );
    startThreadNameWorkflow = vi.fn(async (input) =>
      startedThreadNameWorkflow(input.threadId),
    );
    service = new GenerationOrchestrationService(
      {
        createImageGenerationSubmission,
        createVideoGenerationSubmission,
        finalizeUnsuccessfulGenerationJob,
      },
      {
        startGenerationWorkflow: startWorkflow,
        startGenerationThreadNameWorkflow: startThreadNameWorkflow,
      },
    );
    vi.stubEnv("API_PUBLIC_ORIGIN", "https://api.example.test");
  });

  it("starts image jobs with the exact inline workflow input", async () => {
    createImageGenerationSubmission.mockResolvedValueOnce(
      createImageSubmission(),
    );

    await expect(
      service.createImage({
        userId: "user_1",
        requestId: "request_1",
        input: imageInput,
      }),
    ).resolves.toEqual({
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
    expect(createImageGenerationSubmission).toHaveBeenCalledWith({
      userId: "user_1",
      input: imageInput,
    });
    expect(startWorkflow).toHaveBeenCalledWith({
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

  it("fans out video jobs with their matching callback tokens", async () => {
    createVideoGenerationSubmission.mockResolvedValueOnce(
      createVideoSubmission({ jobCount: 2 }),
    );

    await expect(
      service.createVideo({
        userId: "user_1",
        requestId: "request_1",
        input: { ...videoInput, requestedGenerations: 2 },
      }),
    ).resolves.toMatchObject({
      submissionId: "video_submission_1",
      jobs: [
        { jobId: "video_job_1", workflowId: "generation-job:video_job_1" },
        { jobId: "video_job_2", workflowId: "generation-job:video_job_2" },
      ],
    });
    expect(startWorkflow).toHaveBeenNthCalledWith(1, {
      jobId: "video_job_1",
      submissionId: "video_submission_1",
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
          "https://api.example.test/api/generation-callbacks/byteplus/video_job_1?token=callback-token-1",
      },
    });
    expect(startWorkflow).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jobId: "video_job_2",
        providerExecution: {
          mode: "callback",
          outputKind: "video",
          callbackUrl:
            "https://api.example.test/api/generation-callbacks/byteplus/video_job_2?token=callback-token-2",
        },
      }),
    );
  });

  it("starts newly-created thread naming for either modality", async () => {
    createImageGenerationSubmission.mockResolvedValueOnce(
      createImageSubmission({ createdThread: true }),
    );
    createVideoGenerationSubmission.mockResolvedValueOnce(
      createVideoSubmission({ createdThread: true }),
    );

    await service.createImage({
      userId: "user_1",
      requestId: "image_request",
      input: imageInput,
    });
    await service.createVideo({
      userId: "user_1",
      requestId: "video_request",
      input: videoInput,
    });

    expect(startThreadNameWorkflow).toHaveBeenNthCalledWith(1, {
      threadId: "thread_1",
      userId: "user_1",
      prompt: "Glass flowers",
      provisionalName: "Provisional generation thread",
    });
    expect(startThreadNameWorkflow).toHaveBeenNthCalledWith(2, {
      threadId: "thread_1",
      userId: "user_1",
      prompt: "A quiet ocean studio",
      provisionalName: "Provisional generation thread",
    });
  });

  it("keeps generation creation successful when thread naming cannot start", async () => {
    createImageGenerationSubmission.mockResolvedValueOnce(
      createImageSubmission({ createdThread: true }),
    );
    startThreadNameWorkflow.mockRejectedValueOnce(
      new Error("Temporal unavailable"),
    );

    await expect(
      service.createImage({
        userId: "user_1",
        requestId: "request_1",
        input: imageInput,
      }),
    ).resolves.toMatchObject({ submissionId: "image_submission_1" });
    expect(finalizeUnsuccessfulGenerationJob).not.toHaveBeenCalled();
  });

  it("finalizes one failed workflow start and continues sequential fan-out", async () => {
    createImageGenerationSubmission.mockResolvedValueOnce(
      createImageSubmission({ jobCount: 2 }),
    );
    const workflowStartError = new Error("Temporal unavailable");
    startWorkflow
      .mockRejectedValueOnce(workflowStartError)
      .mockResolvedValueOnce(startedWorkflow("generation-job:image_job_2"));
    finalizeUnsuccessfulGenerationJob.mockResolvedValueOnce({
      ...createJob({
        id: "image_job_1",
        submissionId: "image_submission_1",
        providerId: "google",
        providerModelId: "gemini-3.1-flash-image",
      }),
      status: "failed",
      terminalError: {
        source: "internal",
        code: "WORKFLOW_START_FAILED",
        message: "Temporal unavailable",
      },
    });

    await expect(
      service.createImage({
        userId: "user_1",
        requestId: "request_1",
        input: { ...imageInput, requestedGenerations: 2 },
      }),
    ).resolves.toEqual({
      submissionId: "image_submission_1",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "image_job_1",
          workflowId: null,
          status: "failed",
          terminalError: {
            source: "internal",
            code: "WORKFLOW_START_FAILED",
            message: "Temporal unavailable",
          },
        },
        {
          jobId: "image_job_2",
          workflowId: "generation-job:image_job_2",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    expect(finalizeUnsuccessfulGenerationJob).toHaveBeenCalledWith({
      jobId: "image_job_1",
      status: "failed",
      terminalError: {
        source: "internal",
        code: "WORKFLOW_START_FAILED",
        message: "Temporal unavailable",
      },
    });
    expect(startWorkflow).toHaveBeenCalledTimes(2);
  });

  it("does not start the next job until the previous workflow start settles", async () => {
    createImageGenerationSubmission.mockResolvedValueOnce(
      createImageSubmission({ jobCount: 2 }),
    );
    const firstStart = createDeferred<StartedGenerationWorkflow>();
    startWorkflow
      .mockImplementationOnce(() => firstStart.promise)
      .mockResolvedValueOnce(startedWorkflow("generation-job:image_job_2"));

    const creation = service.createImage({
      userId: "user_1",
      requestId: "request_1",
      input: { ...imageInput, requestedGenerations: 2 },
    });

    await vi.waitFor(() => expect(startWorkflow).toHaveBeenCalledTimes(1));
    firstStart.resolve(startedWorkflow("generation-job:image_job_1"));
    await creation;

    expect(startWorkflow).toHaveBeenCalledTimes(2);
  });
});

function createImageSubmission({
  createdThread = false,
  jobCount = 1,
}: {
  createdThread?: boolean;
  jobCount?: number;
} = {}): CreatedImageGenerationSubmission {
  return {
    submission: {
      id: "image_submission_1",
      threadId: "thread_1",
      userId: "user_1",
      modelId: "nano-banana-2",
      modelSpecId: "nano-banana-2-v1",
      modelType: "image",
      submittedInput: {
        prompt: "Glass flowers",
        resolution: "1K",
        aspectRatio: "1:1",
      },
      requestedGenerations: jobCount,
      attachmentMedia: emptyAttachmentMedia(),
      createdAt: timestamp(),
      updatedAt: timestamp(),
    },
    jobs: Array.from({ length: jobCount }, (_, index) =>
      createJob({
        id: `image_job_${index + 1}`,
        submissionId: "image_submission_1",
        submissionIndex: index,
        providerId: "google",
        providerModelId: "gemini-3.1-flash-image",
      }),
    ),
    createdThread: createdThread ? createThread() : null,
  };
}

function createVideoSubmission({
  createdThread = false,
  jobCount = 1,
}: {
  createdThread?: boolean;
  jobCount?: number;
} = {}): CreatedVideoGenerationSubmission {
  return {
    submission: {
      id: "video_submission_1",
      threadId: "thread_1",
      userId: "user_1",
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      modelType: "video",
      submittedInput: {
        prompt: "A quiet ocean studio",
        resolution: "720p",
        aspectRatio: "16:9",
        duration: 5,
        generateAudio: true,
      },
      requestedGenerations: jobCount,
      attachmentMedia: emptyAttachmentMedia(),
      createdAt: timestamp(),
      updatedAt: timestamp(),
    },
    jobs: Array.from({ length: jobCount }, (_, index) => ({
      job: createJob({
        id: `video_job_${index + 1}`,
        submissionId: "video_submission_1",
        submissionIndex: index,
        providerId: "byteplus",
        providerModelId: "dreamina-seedance-2-0-260128",
      }),
      callbackToken: `callback-token-${index + 1}`,
    })),
    createdThread: createdThread ? createThread() : null,
  };
}

function createJob({
  id,
  submissionId,
  submissionIndex = 0,
  providerId,
  providerModelId,
}: {
  id: string;
  submissionId: string;
  submissionIndex?: number;
  providerId: string;
  providerModelId: string;
}): CreatedGenerationJobRecord {
  return {
    id,
    submissionId,
    submissionIndex,
    status: "queued",
    temporalWorkflowId: null,
    temporalRunId: null,
    callbackTokenHash: null,
    providerId,
    providerTaskId: null,
    providerModelId,
    terminalError: null,
    terminalAt: null,
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

function emptyAttachmentMedia() {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

function createThread() {
  return {
    id: "thread_1",
    projectId: null,
    userId: "user_1",
    name: "Provisional generation thread",
    createdAt: timestamp(),
    updatedAt: timestamp(),
  };
}

function startedWorkflow(workflowId: string): StartedGenerationWorkflow {
  return {
    workflowId,
    runId: `${workflowId}:run`,
  };
}

function startedThreadNameWorkflow(
  threadId: string,
): StartedGenerationThreadNameWorkflow {
  return {
    workflowId: `generation-thread-name:${threadId}`,
    runId: `generation-thread-name:${threadId}:run`,
    alreadyStarted: false,
  };
}

function timestamp() {
  return new Date("2026-06-05T00:00:00.000Z");
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

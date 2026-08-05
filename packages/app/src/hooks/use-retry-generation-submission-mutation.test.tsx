/** @vitest-environment jsdom */

import type {
  CreatedGenerationSubmission,
  GenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRetryGenerationSubmissionMutation } from "./use-retry-generation-submission-mutation.ts";

const mocks = vi.hoisted(() => ({
  retry: vi.fn(),
  retryMutationOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  projectListQueryOptions: vi.fn(),
}));

vi.mock("../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      retry: { mutationOptions: mocks.retryMutationOptions },
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
      },
    },
    generationThread: {
      listWithoutProject: { queryOptions: mocks.threadQueryOptions },
    },
    project: {
      listProjects: { queryOptions: mocks.projectListQueryOptions },
    },
  }),
}));

describe("useRetryGenerationSubmissionMutation", () => {
  beforeEach(() => {
    mocks.retry.mockReset();
    mocks.retryMutationOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.projectListQueryOptions.mockReset();
    mocks.retryMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.retry,
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation((input) => ({
      queryKey: ["generation", "listSubmissionsFromThread", input],
      queryFn: async () => [],
    }));
    mocks.threadQueryOptions.mockReturnValue({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    mocks.projectListQueryOptions.mockReturnValue({
      queryKey: ["project", "listProjects"],
    });
  });

  afterEach(() => cleanup());

  it("appends an exact optimistic retry and reconciles server ids", async () => {
    const deferred = createDeferred<CreatedGenerationSubmission>();
    const source = createSubmission();
    const { result, queryClient } = renderRetryHook();
    const queryKey = [
      "generation",
      "listSubmissionsFromThread",
      { threadId: "thread_1" },
    ];
    let retryPromise!: Promise<CreatedGenerationSubmission>;

    queryClient.setQueryData(queryKey, [source]);
    mocks.retry.mockReturnValueOnce(deferred.promise);

    act(() => {
      retryPromise = result.current.retryGeneration(source);
    });

    await waitFor(() => {
      const submissions =
        queryClient.getQueryData<GenerationThreadSubmission[]>(queryKey);

      expect(submissions).toHaveLength(2);
      expect(submissions?.[1]).toMatchObject({
        id: expect.stringMatching(/^optimistic-generation-submission:/),
        threadId: source.threadId,
        modelId: source.modelId,
        modelSpecId: source.modelSpecId,
        submittedInput: source.submittedInput,
        requestedGenerations: 2,
        attachmentMedia: source.attachmentMedia,
        jobs: [
          expect.objectContaining({ status: "queued", submissionIndex: 0 }),
          expect.objectContaining({ status: "queued", submissionIndex: 1 }),
        ],
      });
    });

    await act(async () => {
      deferred.resolve({
        submissionId: "submission_retry",
        threadId: "thread_1",
        jobs: [
          {
            jobId: "retry_job_1",
            workflowId: "workflow_1",
            status: "queued",
            terminalError: null,
          },
          {
            jobId: "retry_job_2",
            workflowId: "workflow_2",
            status: "queued",
            terminalError: null,
          },
        ],
      });
      await retryPromise;
    });

    expect(mocks.retry.mock.calls[0]?.[0]).toEqual({
      submissionId: "submission_1",
    });
    expect(
      queryClient.getQueryData<GenerationThreadSubmission[]>(queryKey),
    ).toEqual([
      source,
      expect.objectContaining({
        id: "submission_retry",
        jobs: [
          expect.objectContaining({ id: "retry_job_1" }),
          expect.objectContaining({ id: "retry_job_2" }),
        ],
      }),
    ]);
  });

  it("removes the optimistic retry when creation fails", async () => {
    const source = createSubmission();
    const { result, queryClient } = renderRetryHook();
    const queryKey = [
      "generation",
      "listSubmissionsFromThread",
      { threadId: "thread_1" },
    ];

    queryClient.setQueryData(queryKey, [source]);
    mocks.retry.mockRejectedValueOnce(new Error("Retry unavailable"));

    await act(async () => {
      await expect(result.current.retryGeneration(source)).rejects.toThrow(
        "Retry unavailable",
      );
    });

    expect(queryClient.getQueryData(queryKey)).toEqual([source]);
  });
});

function renderRetryHook() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = renderHook(() => useRetryGenerationSubmissionMutation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { ...rendered, queryClient };
}

function createSubmission(): VideoGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName: "Seedance 2.0",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "720p",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: 2,
    attachmentMedia: {
      images: [
        {
          id: "image_1",
          kind: "image",
          fieldId: "images",
          role: "firstFrame",
          originalFileName: "first.png",
          contentType: "image/png",
          contentLength: 1024,
          metadata: {
            widthPx: 1280,
            heightPx: 720,
            durationSec: null,
            fps: null,
          },
          createdAt: "2026-06-05T00:00:00.000Z",
        },
      ],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: [0, 1].map((submissionIndex) => ({
      id: `job_${submissionIndex + 1}`,
      submissionId: "submission_1",
      submissionIndex,
      status: "succeeded" as const,
      providerId: "byteplus",
      providerTaskId: `provider_${submissionIndex + 1}`,
      providerModelId: "seedance",
      terminalError: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:01:00.000Z",
      result: null,
    })),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

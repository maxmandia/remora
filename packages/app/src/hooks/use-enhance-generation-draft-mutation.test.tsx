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

import { useEnhanceGenerationDraftMutation } from "./use-enhance-generation-draft-mutation.ts";

const mocks = vi.hoisted(() => ({
  enhance: vi.fn(),
  enhanceMutationOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  projectListQueryOptions: vi.fn(),
  balanceQueryOptions: vi.fn(),
}));

vi.mock("../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      enhanceDraft: { mutationOptions: mocks.enhanceMutationOptions },
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
    credits: {
      getBalance: { queryOptions: mocks.balanceQueryOptions },
    },
  }),
}));

describe("useEnhanceGenerationDraftMutation", () => {
  beforeEach(() => {
    mocks.enhance.mockReset();
    mocks.enhanceMutationOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.projectListQueryOptions.mockReset();
    mocks.balanceQueryOptions.mockReset();
    mocks.enhanceMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.enhance,
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
    mocks.balanceQueryOptions.mockReturnValue({
      queryKey: ["credits", "getBalance"],
    });
  });

  afterEach(() => cleanup());

  it("optimistically inserts the eligible full-quality outputs and reconciles ids", async () => {
    const deferred = createDeferred<CreatedGenerationSubmission>();
    const source = createDraftSubmission();
    const { result, queryClient } = renderEnhancementHook();
    const queryKey = [
      "generation",
      "listSubmissionsFromThread",
      { threadId: "thread_1" },
    ];
    let enhancePromise!: Promise<CreatedGenerationSubmission>;

    queryClient.setQueryData(queryKey, [source]);
    mocks.enhance.mockReturnValueOnce(deferred.promise);

    act(() => {
      enhancePromise = result.current.enhanceDraft(source, 2);
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
        submittedInput: {
          ...source.submittedInput,
          draft: false,
        },
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
        submissionId: "submission_enhanced",
        threadId: "thread_1",
        jobs: [
          {
            jobId: "enhanced_job_1",
            workflowId: "workflow_1",
            status: "queued",
            terminalError: null,
          },
          {
            jobId: "enhanced_job_2",
            workflowId: "workflow_2",
            status: "queued",
            terminalError: null,
          },
        ],
      });
      await enhancePromise;
    });

    expect(mocks.enhance.mock.calls[0]?.[0]).toEqual({
      submissionId: "submission_1",
    });
    expect(
      queryClient.getQueryData<GenerationThreadSubmission[]>(queryKey),
    ).toEqual([
      source,
      expect.objectContaining({
        id: "submission_enhanced",
        submittedInput: expect.objectContaining({ draft: false }),
        jobs: [
          expect.objectContaining({ id: "enhanced_job_1" }),
          expect.objectContaining({ id: "enhanced_job_2" }),
        ],
      }),
    ]);
  });

  it("removes the optimistic enhancement when creation fails", async () => {
    const source = createDraftSubmission();
    const { result, queryClient } = renderEnhancementHook();
    const queryKey = [
      "generation",
      "listSubmissionsFromThread",
      { threadId: "thread_1" },
    ];

    queryClient.setQueryData(queryKey, [source]);
    mocks.enhance.mockRejectedValueOnce(new Error("Enhancement unavailable"));

    await act(async () => {
      await expect(result.current.enhanceDraft(source, 2)).rejects.toThrow(
        "Enhancement unavailable",
      );
    });

    expect(queryClient.getQueryData(queryKey)).toEqual([source]);
  });
});

function renderEnhancementHook() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const rendered = renderHook(() => useEnhanceGenerationDraftMutation(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { ...rendered, queryClient };
}

function createDraftSubmission(): VideoGenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "flux-3-video",
    modelDisplayName: "FLUX 3",
    modelType: "video",
    modelSpecId: "flux-3-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 8,
      generateAudio: false,
      draft: true,
    },
    requestedGenerations: 3,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: ["succeeded", "failed", "succeeded"].map(
      (status, submissionIndex) => ({
        id: `job_${submissionIndex + 1}`,
        submissionId: "submission_1",
        submissionIndex,
        status: status as "succeeded" | "failed",
        providerId: "bfl",
        providerTaskId: `provider_${submissionIndex + 1}`,
        providerModelId: "latest",
        terminalError: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:01:00.000Z",
        result: null,
      }),
    ),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

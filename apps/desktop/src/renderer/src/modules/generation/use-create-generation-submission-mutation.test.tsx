/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import type {
  GenerationJobStatus,
  GenerationJobTerminalError,
  GenerationAttachmentMediaUploadResult,
  GenerationThreadSubmission,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationSettingsValue } from "../../lib/generation/index.ts";
import type {
  GenerationAttachmentMediaItem,
  GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import {
  useCreateGenerationSubmissionMutation,
  type GenerationSubmissionDraft,
} from "./use-create-generation-submission-mutation.ts";

type CreatedGenerationSubmission = {
  submissionId: string;
  threadId: string;
  jobs: Array<{
    jobId: string;
    workflowId: string | null;
    status: GenerationJobStatus;
    terminalError?: GenerationJobTerminalError | null;
  }>;
};

const mocks = vi.hoisted(() => ({
  createVideo: vi.fn(),
  mutationOptions: vi.fn(),
  projectListQueryOptions: vi.fn(),
  attachmentMediaUpload: vi.fn(),
  threadQueryOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
      },
      createVideo: {
        mutationOptions: mocks.mutationOptions,
      },
    },
    generationThread: {
      listWithoutProject: {
        queryOptions: mocks.threadQueryOptions,
      },
    },
    project: {
      listProjects: {
        queryOptions: mocks.projectListQueryOptions,
      },
    },
  }),
}));

describe("useCreateGenerationSubmissionMutation", () => {
  beforeEach(() => {
    mocks.createVideo.mockReset();
    mocks.mutationOptions.mockReset();
    mocks.projectListQueryOptions.mockReset();
    mocks.attachmentMediaUpload.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.createVideo.mockResolvedValue(createCreatedGenerationSubmission());
    mocks.mutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createVideo,
    }));
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [],
    }));
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [],
      }),
    );
    mocks.attachmentMediaUpload.mockResolvedValue(
      mockAttachmentMediaUploadResult(),
    );
    Object.defineProperty(window, "remoraAttachmentMedia", {
      configurable: true,
      value: {
        upload: mocks.attachmentMediaUpload,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("places an existing-thread optimistic row before attachment media upload completes", async () => {
    const upload = createDeferred<GenerationAttachmentMediaUploadResult>();
    const rendered = renderMutationHook();
    let submitPromise!: Promise<CreatedGenerationSubmission>;

    mocks.attachmentMediaUpload.mockReturnValueOnce(upload.promise);

    await act(async () => {
      submitPromise = rendered.current.submitGeneration(
        createDraft({
          attachmentMedia: createAttachmentMediaWithImage(),
          target: { kind: "existing-thread", threadId: "thread_1" },
        }),
      );
    });

    await waitFor(() => {
      const submissions = rendered.queryClient.getQueryData<
        GenerationThreadSubmission[]
      >(["generation", "listSubmissionsFromThread", { threadId: "thread_1" }]);

      expect(submissions?.[0]).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^optimistic-generation-submission:\d+$/),
          threadId: "thread_1",
          submittedInput: expect.objectContaining({
            prompt: "A glass studio above the ocean",
          }),
        }),
      );
    });
    expect(mocks.attachmentMediaUpload).toHaveBeenCalledTimes(1);
    expect(mocks.createVideo).not.toHaveBeenCalled();

    await act(async () => {
      upload.resolve(mockAttachmentMediaUploadResult());
      await submitPromise;
    });
  });

  it("reconciles existing-thread optimistic rows with returned submission and job ids", async () => {
    const createVideo = createDeferred<CreatedGenerationSubmission>();
    const rendered = renderMutationHook();
    let submitPromise!: Promise<CreatedGenerationSubmission>;

    mocks.createVideo.mockReturnValueOnce(createVideo.promise);

    await act(async () => {
      submitPromise = rendered.current.submitGeneration(
        createDraft({
          target: { kind: "existing-thread", threadId: "thread_1" },
        }),
      );
    });

    await waitFor(() => {
      const submissions = rendered.queryClient.getQueryData<
        GenerationThreadSubmission[]
      >(["generation", "listSubmissionsFromThread", { threadId: "thread_1" }]);

      expect(submissions?.[0]?.id).toMatch(
        /^optimistic-generation-submission:\d+$/,
      );
    });

    await act(async () => {
      createVideo.resolve(
        createCreatedGenerationSubmission({
          submissionId: "submission_created",
          threadId: "thread_1",
          jobs: [
            {
              jobId: "job_created",
              workflowId: "workflow_1",
              status: "queued",
            },
          ],
        }),
      );
      await submitPromise;
    });

    expect(
      rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
        "generation",
        "listSubmissionsFromThread",
        { threadId: "thread_1" },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "submission_created",
        threadId: "thread_1",
        jobs: [
          expect.objectContaining({
            id: "job_created",
            submissionId: "submission_created",
            status: "queued",
          }),
        ],
      }),
    ]);
  });

  it("rolls back existing-thread optimistic rows when upload fails", async () => {
    const upload = createDeferred<GenerationAttachmentMediaUploadResult>();
    const rendered = renderMutationHook();
    let submitPromise!: Promise<CreatedGenerationSubmission>;

    mocks.attachmentMediaUpload.mockReturnValueOnce(upload.promise);

    await act(async () => {
      submitPromise = rendered.current.submitGeneration(
        createDraft({
          attachmentMedia: createAttachmentMediaWithImage(),
          target: { kind: "existing-thread", threadId: "thread_1" },
        }),
      );
    });

    await waitFor(() => {
      expect(
        rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
          "generation",
          "listSubmissionsFromThread",
          { threadId: "thread_1" },
        ])?.length,
      ).toBe(1);
    });

    await act(async () => {
      upload.reject(new Error("upload unavailable"));

      try {
        await submitPromise;
      } catch {
        // The hook owns rollback; this test only needs to flush the rejection.
      }
    });

    expect(
      rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
        "generation",
        "listSubmissionsFromThread",
        { threadId: "thread_1" },
      ]),
    ).toEqual([]);
    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it("rolls back existing-thread optimistic rows when creation fails", async () => {
    const createVideo = createDeferred<CreatedGenerationSubmission>();
    const rendered = renderMutationHook();
    let submitPromise!: Promise<CreatedGenerationSubmission>;
    let observedSubmitPromise!: Promise<void>;

    mocks.createVideo.mockReturnValueOnce(createVideo.promise);

    await act(async () => {
      submitPromise = rendered.current.submitGeneration(
        createDraft({
          target: { kind: "existing-thread", threadId: "thread_1" },
        }),
      );
      observedSubmitPromise = submitPromise.then(
        () => undefined,
        () => undefined,
      );
    });

    await waitFor(() => {
      expect(
        rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
          "generation",
          "listSubmissionsFromThread",
          { threadId: "thread_1" },
        ])?.length,
      ).toBe(1);
    });

    await act(async () => {
      createVideo.reject(new Error("generation unavailable"));
      await observedSubmitPromise;
    });

    expect(
      rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
        "generation",
        "listSubmissionsFromThread",
        { threadId: "thread_1" },
      ]),
    ).toEqual([]);
  });

  it("uses local fresh-thread pending state and seeds the real thread query after creation", async () => {
    const createVideo = createDeferred<CreatedGenerationSubmission>();
    const rendered = renderMutationHook();
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );
    let submitPromise!: Promise<CreatedGenerationSubmission>;

    mocks.createVideo.mockReturnValueOnce(createVideo.promise);

    await act(async () => {
      submitPromise = rendered.current.submitGeneration(
        createDraft({
          target: { kind: "new-thread", projectId: null },
        }),
      );
    });

    await waitFor(() => {
      expect(rendered.current.pendingFreshThreadSubmission).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^optimistic-generation-submission:\d+$/),
          submittedInput: expect.objectContaining({
            prompt: "A glass studio above the ocean",
          }),
        }),
      );
    });

    await act(async () => {
      createVideo.resolve(
        createCreatedGenerationSubmission({
          submissionId: "submission_created",
          threadId: "thread_created",
          jobs: [
            {
              jobId: "job_created",
              workflowId: "workflow_1",
              status: "queued",
            },
          ],
        }),
      );
      await submitPromise;
    });

    expect(rendered.current.pendingFreshThreadSubmission).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^optimistic-generation-submission:\d+$/),
      }),
    );
    expect(
      rendered.queryClient.getQueryData<GenerationThreadSubmission[]>([
        "generation",
        "listSubmissionsFromThread",
        { threadId: "thread_created" },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: "submission_created",
        threadId: "thread_created",
        jobs: [
          expect.objectContaining({
            id: "job_created",
            submissionId: "submission_created",
          }),
        ],
      }),
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["project", "listProjects"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        "generation",
        "listSubmissionsFromThread",
        { threadId: "thread_created" },
      ],
    });

    act(() => {
      rendered.current.clearPendingFreshThreadSubmission();
    });

    expect(rendered.current.pendingFreshThreadSubmission).toBeNull();
  });

  it("submits uploaded attachment media with roles preserved", async () => {
    const rendered = renderMutationHook();

    mocks.attachmentMediaUpload.mockReset();
    mocks.attachmentMediaUpload.mockResolvedValueOnce({
      id: "first_frame_1",
      kind: "image",
      originalFileName: "first.png",
      contentType: "image/png",
      contentLength: 5,
      metadata: {
        widthPx: 1024,
        heightPx: 576,
        durationSec: null,
        fps: null,
      },
    });

    await act(async () => {
      await rendered.current.submitGeneration(
        createDraft({
          attachmentMedia: {
            ...createEmptyAttachmentMedia(),
            images: [
              item(
                new File(["first"], "first.png", { type: "image/png" }),
                "firstFrame",
              ),
            ],
          },
        }),
      );
    });

    expect(mocks.createVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "720p",
        attachmentMedia: {
          images: [{ id: "first_frame_1", role: "firstFrame" }],
        },
      }),
      expect.any(Object),
    );
  });

  it("submits canonical settings that are not rendered in the composer", async () => {
    const rendered = renderMutationHook();

    await act(async () => {
      await rendered.current.submitGeneration(
        createDraft({
          settings: createSettings({
            resolution: "1080p",
            generateAudio: false,
          }),
        }),
      );
    });

    expect(mocks.createVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "1080p",
        generateAudio: false,
      }),
      expect.any(Object),
    );
  });
});

type HookValue = ReturnType<typeof useCreateGenerationSubmissionMutation>;

function renderMutationHook() {
  let current!: HookValue;
  const queryClient = createTestQueryClient();

  function TestComponent() {
    current = useCreateGenerationSubmissionMutation();

    return null;
  }

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <TestComponent />
    </QueryClientProvider>,
  );

  return {
    ...rendered,
    get current() {
      return current;
    },
    queryClient,
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createDraft(
  overrides: Partial<GenerationSubmissionDraft> = {},
): GenerationSubmissionDraft {
  return {
    model: createModel(),
    prompt: "A glass studio above the ocean",
    attachmentMedia: createEmptyAttachmentMedia(),
    settings: createSettings(),
    target: { kind: "new-thread", projectId: null },
    userId: "user_1",
    ...overrides,
  };
}

function createEmptyAttachmentMedia(): GenerationAttachmentMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

function createAttachmentMediaWithImage(): GenerationAttachmentMediaValue {
  return {
    ...createEmptyAttachmentMedia(),
    images: [item(new File(["image"], "reference.png", { type: "image/png" }))],
  };
}

function item(
  file: File,
  role: GenerationAttachmentMediaItem["role"] = "reference",
): GenerationAttachmentMediaItem {
  return { file, role };
}

function createCreatedGenerationSubmission(
  overrides: Partial<CreatedGenerationSubmission> = {},
): CreatedGenerationSubmission {
  return {
    submissionId: "submission_created",
    threadId: "thread_created",
    jobs: [
      { jobId: "job_created", workflowId: "workflow_1", status: "queued" },
    ],
    ...overrides,
  };
}

function mockAttachmentMediaUploadResult(
  overrides: Partial<GenerationAttachmentMediaUploadResult> = {},
): GenerationAttachmentMediaUploadResult {
  return {
    id: "attachment_media_1",
    kind: "image",
    originalFileName: "reference.png",
    contentType: "image/png",
    contentLength: 5,
    metadata: {
      widthPx: null,
      heightPx: null,
      durationSec: null,
      fps: null,
    },
    ...overrides,
  };
}

function createSettings(
  overrides: Partial<GenerationSettingsValue> = {},
): GenerationSettingsValue {
  return {
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    ...overrides,
  };
}

function createModel(): PublishedGenerationModelSummary {
  return {
    id: "seedance-2.0-video",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Seedance 2.0",
    type: "video",
    latestSpecId: "seedance-2.0-video-v1",
    latestSpecVersion: 1,
    spec: {
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
          id: "aspectRatio",
          label: "Aspect ratio",
          componentKind: "select",
          valueKind: "string",
          required: true,
          advanced: false,
          defaultValue: "16:9",
          omitWhenEmpty: false,
          omitWhenDefault: false,
          notes: [],
        },
      ],
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["aspectRatio"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules: ["seedance20ContentRules"],
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

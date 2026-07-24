/** @vitest-environment jsdom */

import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  ImageGenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { multiGenerationPanelOpenTransform } from "../../lib/generation/generation-preview.ts";
import { GenerationResultsSurface } from "./generation-results.tsx";

const mocks = vi.hoisted(() => ({
  queryOptions: vi.fn(),
  query: vi.fn<() => Promise<GenerationThreadSubmission[]>>(),
}));

vi.mock("../../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listSubmissionsFromThread: {
        queryOptions: mocks.queryOptions,
      },
    },
  }),
}));

vi.mock("./dot-field-skeleton.tsx", async () => {
  const React = await import("react");

  return {
    dotFieldSkeletonVisibleInset: "10%",
    DotFieldSkeleton: ({
      "aria-label": ariaLabel = "Generating",
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", {
        role: "status",
        "aria-label": ariaLabel,
        ...props,
      }),
  };
});

describe("GenerationResultsSurface", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.query.mockResolvedValue([]);
    mocks.queryOptions.mockReset();
    mocks.queryOptions.mockImplementation((input, options) => ({
      queryKey: ["generation", "listSubmissionsFromThread", input],
      queryFn: mocks.query,
      ...options,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a fresh optimistic submission without creating a thread query", () => {
    renderSurface({
      pendingFreshThreadSubmission: createVideoSubmission({
        prompt: "A glass studio above the ocean",
        jobs: [createJob({ status: "queued" })],
      }),
      threadId: null,
    });

    expect(screen.getAllByText("A glass studio above the ocean")).toHaveLength(
      2,
    );
    expect(screen.getByRole("status", { name: "Generating" })).toBeTruthy();
    expect(mocks.queryOptions).not.toHaveBeenCalled();
  });

  it("renders loading and retryable query error states", async () => {
    mocks.query
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce([
        createVideoSubmission({
          prompt: "Recovered generation",
          jobs: [createJob({ status: "queued" })],
        }),
      ]);

    renderSurface({ threadId: "thread_1" });

    expect(screen.getByText("Loading generations...")).toBeTruthy();
    expect(await screen.findByText("Unable to load generations.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findAllByText("Recovered generation")).toHaveLength(2);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("renders no surface for an empty resolved thread", async () => {
    const { container } = renderSurface({ threadId: "thread_1" });

    expect(screen.getByText("Loading generations...")).toBeTruthy();
    await waitFor(() => {
      expect(
        container.querySelector('[data-slot="generation-results"]'),
      ).toBeNull();
    });
  });

  it("preserves submission order and renders prompts and settings in flow", async () => {
    mocks.query.mockResolvedValue([
      createVideoSubmission({
        id: "submission_2",
        prompt: "Second submitted prompt",
        jobs: [createJob({ id: "job_2" })],
      }),
      createVideoSubmission({
        id: "submission_1",
        prompt: "First submitted prompt",
        jobs: [createJob({ id: "job_1" })],
      }),
    ]);

    const { container } = renderSurface({ threadId: "thread_1" });

    expect(await screen.findAllByText("Second submitted prompt")).toHaveLength(
      2,
    );
    const rows = container.querySelectorAll(
      '[data-slot="generation-submission-row"]',
    );

    expect(rows).toHaveLength(2);
    expect(
      within(rows[0] as HTMLElement).getAllByText("Second submitted prompt"),
    ).toHaveLength(2);
    expect(
      within(rows[1] as HTMLElement).getAllByText("First submitted prompt"),
    ).toHaveLength(2);
    expect((rows[0] as HTMLElement).className).toContain(
      "flex-nowrap items-start",
    );
    expect((rows[0] as HTMLElement).className).not.toContain("flex-col");
    expect(screen.getAllByText("Seedance 2.0")).toHaveLength(2);
    expect(screen.getAllByText("720p")).toHaveLength(2);
    expect(
      container
        .querySelector('[data-slot="generation-results"]')
        ?.getAttribute("data-variant"),
    ).toBe("flow");
    expect(
      container.querySelector('[data-slot="generation-results-bottom-spacer"]'),
    ).toBeNull();
  });

  it("renders every job in submission order as non-interactive previews", async () => {
    mocks.query.mockResolvedValue([
      createVideoSubmission({
        id: "video_submission",
        prompt: "Four video outcomes",
        jobs: [
          createJob({
            id: "job_fallback",
            submissionIndex: 3,
            status: "succeeded",
            result: createResult({
              previewImageUrl: null,
              videoUrl: "https://assets.example/fallback.mp4",
            }),
          }),
          createJob({
            id: "job_pending",
            submissionIndex: 0,
            status: "queued",
          }),
          createJob({
            id: "job_failed",
            submissionIndex: 1,
            status: "failed",
            terminalError: {
              source: "provider",
              code: "provider_error",
              message: "Provider unavailable",
            },
          }),
          createJob({
            id: "job_preview",
            submissionIndex: 2,
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
      createImageSubmission({
        id: "image_submission",
        prompt: "Generated still",
        jobs: [
          createJob({
            id: "job_image",
            status: "succeeded",
            result: createResult({
              assets: [
                createImageAsset("https://assets.example/generated.jpg"),
              ],
              videoUrl: null,
            }),
          }),
        ],
      }),
    ]);

    const { container } = renderSurface({ threadId: "thread_1" });

    expect(await screen.findAllByText("Four video outcomes")).toHaveLength(2);
    const videoGrid = container.querySelector(
      '[data-slot="generation-submission-preview-grid"]',
    );

    expect(videoGrid).toBeTruthy();
    expect(
      within(videoGrid as HTMLElement).getAllByTestId("generation-thread-job"),
    ).toHaveLength(4);
    expect(
      within(videoGrid as HTMLElement).getByRole("status", {
        name: "Generating",
      }),
    ).toBeTruthy();
    expect(
      within(videoGrid as HTMLElement).getByRole("status", {
        name: "Generation failed",
      }),
    ).toBeTruthy();
    expect(
      within(videoGrid as HTMLElement).getByAltText<HTMLImageElement>(
        "Generation preview",
      ).src,
    ).toBe("https://assets.example/preview.jpg");
    expect(
      within(videoGrid as HTMLElement).getByAltText(
        "Video preview unavailable",
      ),
    ).toBeTruthy();
    expect(screen.getByAltText<HTMLImageElement>("Generated image").src).toBe(
      "https://assets.example/generated.jpg",
    );
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("supports desktop output, metadata, and supplemental render slots", () => {
    const submission = createVideoSubmission({
      prompt: "Desktop-enhanced result",
      jobs: [createJob({ status: "queued" })],
    });
    const { container } = renderSurface({
      isSupplementalOpen: true,
      pendingFreshThreadSubmission: submission,
      renderMetadataAccessory: (currentSubmission) => (
        <span>Metadata for {currentSubmission.id}</span>
      ),
      renderOutputs: (currentSubmission) => (
        <span>Outputs for {currentSubmission.id}</span>
      ),
      renderSupplemental: (submissions) => (
        <aside>Supplemental for {submissions.length}</aside>
      ),
      threadId: null,
      variant: "overlay",
    });

    expect(screen.getByText("Outputs for submission_1")).toBeTruthy();
    expect(screen.getByText("Metadata for submission_1")).toBeTruthy();
    expect(screen.getByText("Supplemental for 1")).toBeTruthy();
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="generation-results-layout"]',
      )?.style.transform,
    ).toBe(multiGenerationPanelOpenTransform);
    expect(
      container.querySelector('[data-slot="generation-results-bottom-spacer"]'),
    ).toBeTruthy();
  });
});

function renderSurface(
  props: Partial<Parameters<typeof GenerationResultsSurface>[0]> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationResultsSurface
        pendingFreshThreadSubmission={null}
        threadId={null}
        variant="flow"
        {...props}
      />
    </QueryClientProvider>,
  );
}

function createVideoSubmission({
  id = "submission_1",
  jobs,
  prompt,
}: {
  id?: string;
  jobs: GenerationThreadSubmissionJob[];
  prompt: string;
}): VideoGenerationThreadSubmission {
  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName: "Seedance 2.0",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt,
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: jobs.length,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs,
  };
}

function createImageSubmission({
  id,
  jobs,
  prompt,
}: {
  id: string;
  jobs: GenerationThreadSubmissionJob[];
  prompt: string;
}): ImageGenerationThreadSubmission {
  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId: "nano-banana-2",
    modelDisplayName: "Nano Banana 2",
    modelType: "image",
    modelSpecId: "nano-banana-2-v1",
    submittedInput: {
      prompt,
      aspectRatio: "1:1",
      resolution: "1K",
    },
    requestedGenerations: jobs.length,
    attachmentMedia: { images: [], videos: [], audios: [] },
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
    status: "queued",
    providerId: null,
    providerTaskId: null,
    providerModelId: null,
    terminalError: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    result: null,
    ...overrides,
  };
}

function createResult(
  overrides: Partial<NonNullable<GenerationThreadSubmissionJob["result"]>> = {},
): NonNullable<GenerationThreadSubmissionJob["result"]> {
  return {
    providerId: "byteplus",
    providerTaskId: "provider-task",
    providerModelId: "provider-model",
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
    objectKey: "generated.jpg",
    contentType: "image/jpeg",
    contentLength: 1024,
    etag: null,
    checksumSha256: null,
    sourceProviderUrl: null,
    url,
    urlExpiresAt: "2026-06-05T00:06:00.000Z",
  };
}

/** @vitest-environment jsdom */

import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
  ImageGenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import type { SignedGenerationThreadAttachmentMedia } from "@remora/domain/generation-attachment-media/dto";
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
import { useState } from "react";

import { multiGenerationPanelOpenTransform } from "../../lib/generation/generation-preview.ts";
import { HotkeysProvider } from "../../providers/hotkeys-provider.tsx";
import { GenerationResultsSurface } from "./generation-results.tsx";

const mocks = vi.hoisted(() => ({
  attachmentMediaQuery:
    vi.fn<() => Promise<SignedGenerationThreadAttachmentMedia[]>>(),
  attachmentMediaQueryOptions: vi.fn(),
  queryOptions: vi.fn(),
  query: vi.fn<() => Promise<GenerationThreadSubmission[]>>(),
}));

vi.mock("../../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listAttachmentMediaFromSubmission: {
        queryOptions: mocks.attachmentMediaQueryOptions,
      },
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
    mocks.attachmentMediaQuery.mockReset();
    mocks.attachmentMediaQuery.mockResolvedValue([]);
    mocks.attachmentMediaQueryOptions.mockReset();
    mocks.attachmentMediaQueryOptions.mockImplementation((input, options) => ({
      queryKey: ["generation", "listAttachmentMediaFromSubmission", input],
      queryFn: mocks.attachmentMediaQuery,
      ...options,
    }));
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

  it("renders a preview stack and exposes every job in the generation panel", async () => {
    const submission = createVideoSubmission({
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
    });

    const { container } = renderControlledSurface(submission);

    expect(screen.getAllByText("Four video outcomes")).toHaveLength(2);
    const videoOutputs = container.querySelector(
      '[data-slot="generation-submission-outputs"]',
    );

    expect(videoOutputs).toBeTruthy();
    expect(videoOutputs?.className).toContain("w-40");
    expect(
      within(videoOutputs as HTMLElement).getByAltText<HTMLImageElement>(
        "Generation preview",
      ).src,
    ).toBe("https://assets.example/preview.jpg");
    expect(
      videoOutputs?.querySelectorAll(
        '[data-slot="generation-submission-preview-stack-layer"]',
      ),
    ).toHaveLength(2);
    const stackTrigger = within(videoOutputs as HTMLElement).getByRole(
      "button",
      { name: "Open generation stack" },
    );
    expect(stackTrigger.getAttribute("aria-controls")).toBe(
      "generation-stack-panel",
    );

    fireEvent.click(stackTrigger);

    const stackPanel = container.querySelector<HTMLElement>(
      '[data-slot="generation-stack-panel"]',
    );
    await waitFor(() => {
      expect(stackPanel?.getAttribute("data-state")).toBe("open");
    });
    expect(
      within(stackPanel!).getAllByTestId("generation-thread-job"),
    ).toHaveLength(4);
    expect(
      within(stackPanel!).getByRole("status", { name: "Generating" }),
    ).toBeTruthy();
    expect(
      within(stackPanel!).getByRole("status", { name: "Generation failed" }),
    ).toBeTruthy();
    expect(
      within(stackPanel!)
        .getAllByRole("img")
        .map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://assets.example/preview.jpg",
      expect.stringContaining("generation-video-preview-fallback"),
    ]);
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="generation-results-layout"]',
      )?.style.transform,
    ).toBe(multiGenerationPanelOpenTransform);
    expect(
      container.querySelector('[data-slot="generation-results-bottom-spacer"]'),
    ).toBeTruthy();

    fireEvent.click(
      within(stackPanel!).getByRole("button", {
        name: "Close generation panel",
      }),
    );
    await waitFor(() => {
      expect(stackPanel?.getAttribute("data-state")).toBe("closed");
    });
  });

  it("opens generated images with the shared image viewer", () => {
    renderControlledSurface(
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
    );

    fireEvent.click(
      screen.getByRole("button", { name: "View generated image" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Generated image viewer",
    });
    expect(
      within(dialog).getByRole("img", { name: "Generated image" }),
    ).toHaveProperty("src", "https://assets.example/generated.jpg");

    fireEvent.click(
      dialog.querySelector('[data-slot="generation-image-viewer-backdrop"]')!,
    );
    expect(
      screen.queryByRole("dialog", { name: "Generated image viewer" }),
    ).toBeNull();
  });

  it("opens generated videos with the shared browser playback viewer", () => {
    renderControlledSurface(
      createVideoSubmission({
        prompt: "Generated motion",
        jobs: [
          createJob({
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/preview.jpg",
              videoUrl: "https://assets.example/video.mp4",
            }),
          }),
        ],
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Play generated video" }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Generated video playback",
    });
    expect(dialog.style.top).toBe("0px");
    expect(
      dialog.querySelector('[data-slot="generation-video-playback-preview"]'),
    ).toHaveProperty("src", "https://assets.example/preview.jpg");
  });

  it("opens signed attachment media and views an image", async () => {
    const attachmentMedia = createAttachmentMediaValue();
    mocks.attachmentMediaQuery.mockResolvedValue([
      createSignedAttachmentMedia({
        id: "image_1",
        kind: "image",
        fieldId: "images",
        originalFileName: "reference.png",
        url: "https://signed.example/reference.png",
      }),
      createSignedAttachmentMedia({
        id: "video_1",
        kind: "video",
        fieldId: "videos",
        originalFileName: "motion.mp4",
        url: "https://signed.example/motion.mp4",
      }),
      createSignedAttachmentMedia({
        id: "audio_1",
        kind: "audio",
        fieldId: "audios",
        originalFileName: "sound.wav",
        url: "https://signed.example/sound.wav",
      }),
    ]);

    const { container } = renderControlledSurface(
      createVideoSubmission({
        attachmentMedia,
        jobs: [createJob()],
        prompt: "A submitted scene",
      }),
    );

    expect(mocks.attachmentMediaQueryOptions).toHaveBeenCalledWith(
      { submissionId: "" },
      { enabled: false },
    );
    const attachmentButton = screen.getByRole("button", {
      name: "Open attachments",
    });

    fireEvent.click(attachmentButton);

    const attachmentPanel = container.querySelector<HTMLElement>(
      '[data-slot="submitted-attachment-media-panel"]',
    );

    await waitFor(() => {
      expect(attachmentButton.getAttribute("aria-expanded")).toBe("true");
      expect(attachmentPanel?.getAttribute("data-state")).toBe("open");
    });
    expect(mocks.attachmentMediaQueryOptions).toHaveBeenLastCalledWith(
      { submissionId: "submission_1" },
      { enabled: true },
    );
    expect(
      await within(attachmentPanel!).findByRole("img", {
        name: "Attachment image: reference.png",
      }),
    ).toHaveProperty("src", "https://signed.example/reference.png");
    expect(
      within(attachmentPanel!).getByLabelText("Attachment video: motion.mp4"),
    ).toHaveProperty("controls", true);
    expect(
      within(attachmentPanel!).getByLabelText("Attachment audio: sound.wav"),
    ).toHaveProperty("controls", true);

    fireEvent.click(
      within(attachmentPanel!).getByRole("button", {
        name: "View attachment image: reference.png",
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Attachment image viewer",
    });

    expect(
      within(dialog).getByRole("img", {
        name: "Attachment image: reference.png",
      }),
    ).toHaveProperty("src", "https://signed.example/reference.png");

    fireEvent.click(
      dialog.querySelector('[data-slot="generation-image-viewer-backdrop"]')!,
    );
    expect(
      screen.queryByRole("dialog", { name: "Attachment image viewer" }),
    ).toBeNull();
    expect(attachmentPanel?.getAttribute("data-state")).toBe("open");
  });
});

function renderSurface(
  props: Partial<Parameters<typeof GenerationResultsSurface>[0]> = {},
) {
  const {
    activePanel = null,
    attachmentMediaPanelId = "attachment-media-panel",
    onActivePanelToggle = () => undefined,
    stackPanelId = "generation-stack-panel",
    ...surfaceProps
  } = props;
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
        activePanel={activePanel}
        attachmentMediaPanelId={attachmentMediaPanelId}
        pendingFreshThreadSubmission={null}
        stackPanelId={stackPanelId}
        threadId={null}
        variant="flow"
        onActivePanelToggle={onActivePanelToggle}
        {...surfaceProps}
      />
    </QueryClientProvider>,
  );
}

function createVideoSubmission({
  attachmentMedia = { images: [], videos: [], audios: [] },
  id = "submission_1",
  jobs,
  prompt,
}: {
  attachmentMedia?: GenerationThreadSubmission["attachmentMedia"];
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
    attachmentMedia,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs,
  };
}

function renderControlledSurface(submission: GenerationThreadSubmission) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function ControlledSurface() {
    const [activePanel, setActivePanel] =
      useState<Parameters<typeof GenerationResultsSurface>[0]["activePanel"]>(
        null,
      );

    return (
      <GenerationResultsSurface
        activePanel={activePanel}
        attachmentMediaPanelId="attachment-media-panel"
        pendingFreshThreadSubmission={submission}
        stackPanelId="generation-stack-panel"
        threadId={null}
        variant="overlay"
        onActivePanelToggle={(panel) =>
          setActivePanel((currentPanel) =>
            currentPanel &&
            panel &&
            currentPanel.kind === panel.kind &&
            currentPanel.submissionId === panel.submissionId
              ? null
              : panel,
          )
        }
      />
    );
  }

  return render(
    <HotkeysProvider>
      <QueryClientProvider client={queryClient}>
        <ControlledSurface />
      </QueryClientProvider>
    </HotkeysProvider>,
  );
}

function createAttachmentMediaValue(): GenerationThreadSubmission["attachmentMedia"] {
  return {
    images: [
      {
        ...createThreadAttachmentMedia({
          id: "image_1",
          kind: "image",
          fieldId: "images",
          originalFileName: "reference.png",
        }),
      },
    ],
    videos: [
      createThreadAttachmentMedia({
        id: "video_1",
        kind: "video",
        fieldId: "videos",
        originalFileName: "motion.mp4",
      }),
    ],
    audios: [
      createThreadAttachmentMedia({
        id: "audio_1",
        kind: "audio",
        fieldId: "audios",
        originalFileName: "sound.wav",
      }),
    ],
  };
}

function createSignedAttachmentMedia(
  overrides: Partial<SignedGenerationThreadAttachmentMedia> = {},
): SignedGenerationThreadAttachmentMedia {
  return {
    ...createThreadAttachmentMedia(),
    url: "https://signed.example/attachment",
    urlExpiresAt: "2026-06-05T00:17:00.000Z",
    ...overrides,
  };
}

function createThreadAttachmentMedia(
  overrides: Partial<
    GenerationThreadSubmission["attachmentMedia"]["images"][number]
  > = {},
): GenerationThreadSubmission["attachmentMedia"]["images"][number] {
  return {
    id: "attachment_1",
    kind: "image",
    fieldId: "images",
    role: "reference",
    originalFileName: "attachment.png",
    contentType: "image/png",
    contentLength: 1024,
    metadata: {
      widthPx: 512,
      heightPx: 512,
      durationSec: null,
      fps: null,
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
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

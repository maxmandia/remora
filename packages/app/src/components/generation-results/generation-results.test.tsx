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
import { GenerationVideoPlaybackModal } from "./generation-video-playback-modal.tsx";

const mocks = vi.hoisted(() => ({
  attachmentMediaQuery:
    vi.fn<() => Promise<SignedGenerationThreadAttachmentMedia[]>>(),
  attachmentMediaQueryOptions: vi.fn(),
  queryOptions: vi.fn(),
  query: vi.fn<() => Promise<GenerationThreadSubmission[]>>(),
  retry: vi.fn(),
  retryMutationOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  projectListQueryOptions: vi.fn(),
  enhanceDialogProps: vi.fn(),
}));

vi.mock("../../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      retry: {
        mutationOptions: mocks.retryMutationOptions,
      },
      listAttachmentMediaFromSubmission: {
        queryOptions: mocks.attachmentMediaQueryOptions,
      },
      listSubmissionsFromThread: {
        queryOptions: mocks.queryOptions,
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

vi.mock("./enhance-generation-draft-dialog.tsx", () => ({
  EnhanceGenerationDraftDialog: ({
    open,
    sourceJobId,
  }: {
    open: boolean;
    sourceJobId?: string;
  }) => {
    mocks.enhanceDialogProps({ open, sourceJobId });

    return open ? (
      <div
        aria-label="Enhance draft"
        data-source-job-id={sourceJobId}
        role="dialog"
      />
    ) : null;
  },
}));

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
    mocks.retry.mockReset();
    mocks.retryMutationOptions.mockReset();
    mocks.retryMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.retry,
    }));
    mocks.threadQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReturnValue({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    mocks.projectListQueryOptions.mockReset();
    mocks.projectListQueryOptions.mockReturnValue({
      queryKey: ["project", "listProjects"],
    });
    mocks.enhanceDialogProps.mockReset();
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

    const { container } = renderSurface({
      threadId: "thread_1",
      variant: "overlay",
    });

    expect(screen.getByText("Loading generations...")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="generation-results"]')?.className,
    ).toContain("bottom-[var(--remora-generation-results-bottom-reserve)]");
    expect(await screen.findByText("Unable to load generations.")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="generation-results"]')?.className,
    ).toContain("bottom-[var(--remora-generation-results-bottom-reserve)]");

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
    expect((rows[0] as HTMLElement).className).toContain("shrink-0");
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

  it("renders bottom-right actions and allows repeating active submissions", async () => {
    const submissions = [
      createVideoSubmission({
        id: "submission_succeeded",
        prompt: "Succeeded submission",
        jobs: [createJob({ id: "job_succeeded", status: "succeeded" })],
      }),
      createVideoSubmission({
        id: "submission_failed",
        prompt: "Failed submission",
        jobs: [createJob({ id: "job_failed", status: "failed" })],
      }),
      createVideoSubmission({
        id: "submission_active",
        prompt: "Active submission",
        jobs: [createJob({ id: "job_active", status: "queued" })],
      }),
    ];
    mocks.query.mockResolvedValue(submissions);
    mocks.retry.mockResolvedValue({
      submissionId: "submission_retry",
      threadId: "thread_1",
      jobs: [
        {
          jobId: "job_retry",
          workflowId: "workflow_retry",
          status: "queued",
          terminalError: null,
        },
      ],
    });
    const { container } = renderSurface({ threadId: "thread_1" });
    const actionButtons = await screen.findAllByRole("button", {
      name: "Submission actions",
    });
    const rows = container.querySelectorAll(
      '[data-slot="generation-submission-row"]',
    );

    expect(actionButtons).toHaveLength(3);
    for (const row of rows) {
      const actions = row.lastElementChild;

      expect(actions?.getAttribute("data-slot")).toBe(
        "generation-submission-actions",
      );
      expect(actions?.className).toContain("self-end");
      expect(actions?.className).toContain("mb-3");
    }

    fireEvent.click(actionButtons[0]!);
    expect(screen.getByRole("menuitem", { name: "Retry" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(actionButtons[1]!);
    expect(screen.getByRole("menuitem", { name: "Retry" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(actionButtons[2]!);
    const activeAction = screen.getByRole("menuitem", { name: "Retry" });
    expect(activeAction.getAttribute("aria-disabled")).not.toBe("true");
    fireEvent.click(activeAction);

    await waitFor(() => {
      expect(mocks.retry.mock.calls[0]?.[0]).toEqual({
        submissionId: "submission_active",
      });
    });
  });

  it("disables repeating temporary optimistic submissions", () => {
    renderSurface({
      pendingFreshThreadSubmission: createVideoSubmission({
        id: "optimistic-generation-submission:temporary",
        prompt: "Temporary submission",
        jobs: [createJob({ status: "queued" })],
      }),
    });

    fireEvent.click(screen.getByRole("button", { name: "Submission actions" }));

    expect(
      screen
        .getByRole("menuitem", { name: "Retry" })
        .getAttribute("aria-disabled"),
    ).toBe("true");
  });

  it("labels completed FLUX drafts and offers enhancement independently of retry", () => {
    renderControlledSurface(
      createVideoSubmission({
        draft: true,
        modelId: "flux-3-video",
        modelDisplayName: "FLUX 3",
        modelSpecId: "flux-3-video-v1",
        prompt: "Draft motion",
        jobs: [
          createJob({ status: "succeeded" }),
          createJob({ id: "job_failed", submissionIndex: 1, status: "failed" }),
        ],
      }),
    );

    expect(screen.getByText("Draft")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Submission actions" }));
    expect(screen.getByRole("menuitem", { name: "Retry" })).toBeTruthy();
    const enhanceDraftAction = screen.getByRole("menuitem", {
      name: "Enhance draft",
    });
    const actionMenu = document.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-content"]',
    );

    expect(actionMenu?.className).toContain("w-max");
    expect(enhanceDraftAction.className).toContain("whitespace-nowrap");

    fireEvent.click(enhanceDraftAction);
    expect(screen.getByRole("dialog", { name: "Enhance draft" })).toBeTruthy();
  });

  it("labels full-quality FLUX submissions without labeling other models", () => {
    const fluxSurface = renderControlledSurface(
      createVideoSubmission({
        modelId: "flux-3-video",
        modelDisplayName: "FLUX 3",
        modelSpecId: "flux-3-video-v1",
        prompt: "Full-quality motion",
        jobs: [createJob({ status: "succeeded" })],
      }),
    );

    expect(screen.getByText("Full quality")).toBeTruthy();

    fluxSurface.unmount();
    renderControlledSurface(
      createVideoSubmission({
        prompt: "Seedance motion",
        jobs: [createJob({ status: "succeeded" })],
      }),
    );

    expect(screen.queryByText("Full quality")).toBeNull();
  });

  it("does not offer enhancement until a FLUX draft is terminal", () => {
    renderControlledSurface(
      createVideoSubmission({
        draft: true,
        modelId: "flux-3-video",
        modelDisplayName: "FLUX 3",
        modelSpecId: "flux-3-video-v1",
        prompt: "Active draft motion",
        jobs: [createJob({ status: "queued" })],
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Submission actions" }));
    expect(
      screen.queryByRole("menuitem", { name: "Enhance draft" }),
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
    ).toBeNull();
    const results = container.querySelector<HTMLElement>(
      '[data-slot="generation-results"]',
    );
    const resultsList = container.querySelector<HTMLElement>(
      '[data-slot="generation-results-list"]',
    );
    expect(results?.className).toContain(
      "bottom-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(results?.className).toContain("min-h-0");
    expect(results?.className).toContain("overflow-hidden");
    expect(resultsList?.className).toContain("min-h-0");
    expect(resultsList?.className).toContain("flex-1");
    expect(resultsList?.className).toContain("overflow-y-auto");
    expect(resultsList?.className).toContain("overscroll-contain");
    expect(resultsList?.contains(stackPanel)).toBe(false);

    fireEvent.click(
      within(stackPanel!).getByRole("button", {
        name: "Close generation panel",
      }),
    );
    await waitFor(() => {
      expect(stackPanel?.getAttribute("data-state")).toBe("closed");
    });
  });

  it("enhances one completed FLUX draft from the expanded panel context menu", async () => {
    const { container } = renderControlledSurface(
      createVideoSubmission({
        draft: true,
        modelId: "flux-3-video",
        modelDisplayName: "FLUX 3",
        modelSpecId: "flux-3-video-v1",
        prompt: "Choose one draft",
        jobs: [
          createJob({
            id: "job_1",
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/draft-1.jpg",
            }),
          }),
          createJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/draft-2.jpg",
            }),
          }),
          createJob({
            id: "job_3",
            submissionIndex: 2,
            status: "queued",
          }),
        ],
      }),
    );
    const stackTrigger = screen.getByRole("button", {
      name: "Open generation stack",
    });

    fireEvent.contextMenu(stackTrigger);
    expect(
      screen.queryByRole("menuitem", { name: "Enhance draft" }),
    ).toBeNull();

    fireEvent.click(stackTrigger);
    const stackPanel = container.querySelector<HTMLElement>(
      '[data-slot="generation-stack-panel"]',
    );
    await waitFor(() => {
      expect(stackPanel?.getAttribute("data-state")).toBe("open");
    });
    const draftTiles = within(stackPanel!).getAllByRole("button", {
      name: "Play generated video",
    });

    fireEvent.contextMenu(draftTiles[1]!, { clientX: 20, clientY: 30 });
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Enhance draft" }),
    );

    const dialog = screen.getByRole("dialog", { name: "Enhance draft" });
    expect(dialog.getAttribute("data-source-job-id")).toBe("job_2");
  });

  it("does not add draft enhancement to non-FLUX generation tiles", async () => {
    const { container } = renderControlledSurface(
      createVideoSubmission({
        prompt: "Seedance alternatives",
        jobs: [
          createJob({
            id: "job_1",
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/seedance-1.jpg",
            }),
          }),
          createJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createResult({
              previewImageUrl: "https://assets.example/seedance-2.jpg",
            }),
          }),
        ],
      }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open generation stack" }),
    );
    const stackPanel = container.querySelector<HTMLElement>(
      '[data-slot="generation-stack-panel"]',
    );
    await waitFor(() => {
      expect(stackPanel?.getAttribute("data-state")).toBe("open");
    });

    fireEvent.contextMenu(
      within(stackPanel!).getAllByRole("button", {
        name: "Play generated video",
      })[0]!,
    );
    expect(
      screen.queryByRole("menuitem", { name: "Enhance draft" }),
    ).toBeNull();
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
    expect(
      within(dialog).getByRole("button", { name: "Close generated video" }),
    ).toBeTruthy();
  });

  it("uses the local video as the transition preview when no poster is available", () => {
    render(
      <HotkeysProvider>
        <GenerationVideoPlaybackModal
          closeAriaLabel="Close attachment video"
          dialogAriaLabel="Attachment video viewer"
          playback={{
            aspectRatio: 16 / 9,
            originRect: { height: 80, left: 24, top: 40, width: 80 },
            videoUrl: "blob:motion.mp4",
          }}
          onClosed={vi.fn()}
          onCloseStart={vi.fn()}
        />
      </HotkeysProvider>,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Attachment video viewer",
    });
    const preview = dialog.querySelector(
      '[data-slot="generation-video-playback-preview"]',
    );

    expect(preview?.tagName).toBe("VIDEO");
    expect(preview).toHaveProperty("src", "blob:motion.mp4");
    expect(preview?.getAttribute("aria-hidden")).toBe("true");
    expect(
      within(dialog).getByRole("button", { name: "Close attachment video" }),
    ).toBeTruthy();
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
  draft = false,
  id = "submission_1",
  jobs,
  modelDisplayName = "Seedance 2.0",
  modelId = "seedance-2.0-video",
  modelSpecId = "seedance-2.0-video-v1",
  prompt,
}: {
  attachmentMedia?: GenerationThreadSubmission["attachmentMedia"];
  draft?: boolean;
  id?: string;
  jobs: GenerationThreadSubmissionJob[];
  modelDisplayName?: string;
  modelId?: string;
  modelSpecId?: string;
  prompt: string;
}): VideoGenerationThreadSubmission {
  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId,
    modelDisplayName,
    modelType: "video",
    modelSpecId,
    submittedInput: {
      prompt,
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      draft,
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

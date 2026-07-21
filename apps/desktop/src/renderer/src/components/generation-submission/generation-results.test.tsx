/** @vitest-environment jsdom */

import type { SignedGenerationThreadAttachmentMedia } from "@remora/domain/generation-attachment-media/dto";
import type {
  GenerationThreadSubmission,
  ImageGenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  generationVideoPreviewFallbackImageUrl,
  multiGenerationPanelClosedTransform,
  multiGenerationPanelOpenTransform,
} from "../../lib/generation/index.ts";
import { HotkeysProvider } from "../../providers/hotkeys-provider.tsx";
import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";
import {
  GenerationResults,
  type GenerationResultsActivePanel,
} from "./generation-results.tsx";

const mocks = vi.hoisted(() => ({
  attachmentMedia: {
    current: [] as SignedGenerationThreadAttachmentMedia[],
  },
  submissions: {
    current: [] as GenerationThreadSubmission[],
  },
  attachmentMediaQueryOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
      },
      listAttachmentMediaFromSubmission: {
        queryOptions: mocks.attachmentMediaQueryOptions,
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

describe("GenerationResults", () => {
  beforeEach(() => {
    useDesktopPreferencesStore.setState({ sidebarOpen: true });
    mocks.attachmentMedia.current = [];
    mocks.submissions.current = [];
    mocks.attachmentMediaQueryOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.attachmentMediaQueryOptions.mockImplementation((input, options) => ({
      queryKey: ["generation", "listAttachmentMediaFromSubmission", input],
      queryFn: async () => mocks.attachmentMedia.current,
      ...options,
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation((input) => ({
      queryKey: ["generation", "listSubmissionsFromThread", input],
      queryFn: async () => mocks.submissions.current,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("expands and collapses overflowing submitted prompts inline", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt:
          "A quiet ocean studio with tall glass walls, layered linen curtains, dense prop tables, reflective floor tiles, and a long cinematic treatment that keeps describing the scene past the available result row height.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");
    await measurePromptOverflow(container, {
      clientHeight: 100,
      scrollHeight: 180,
    });

    const showMoreButton = await screen.findByRole("button", {
      name: "Show more",
    });

    expect(showMoreButton.getAttribute("aria-expanded")).toBe("false");
    expect(showMoreButton.className).not.toContain("float-right");
    expect(showMoreButton.className).not.toContain("absolute");
    const promptOverlay = container.querySelector(
      '[data-slot="generation-result-prompt-overflow-overlay"]',
    );

    expect(promptOverlay).not.toBeNull();
    expect(promptOverlay?.contains(showMoreButton)).toBe(true);
    expect(
      container.querySelector('[data-slot="submitted-generation-model"]')
        ?.textContent,
    ).toBe("Seedance 2.0");

    fireEvent.click(showMoreButton);

    const showLessButton = screen.getByRole("button", {
      name: "Show less",
    });

    expect(showLessButton.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector('[data-slot="submitted-generation-model"]')
        ?.textContent,
    ).toBe("Seedance 2.0");

    fireEvent.click(showLessButton);

    expect(
      screen
        .getByRole("button", { name: "Show more" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("does not show an overflow toggle for prompts that fit", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");
    await measurePromptOverflow(container, {
      clientHeight: 100,
      scrollHeight: 80,
    });

    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("bottom-aligns submitted metadata to the skeleton last dot row", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");

    const submittedSettings = container.querySelector<HTMLElement>(
      '[data-slot="submitted-generation-settings"]',
    );
    const submittedMetadata = submittedSettings?.parentElement;

    expect(submittedSettings).not.toBeNull();
    expect(submittedMetadata?.className).toContain("top-36");
    expect(submittedMetadata?.className).toContain("-translate-y-full");
    expect(submittedMetadata?.className).not.toContain("-translate-y-1/2");
  });

  it("does not render an attachment media badge for empty submitted media", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
      }),
    ];

    renderGenerationResults();

    await screen.findByTestId("generation-thread-job");

    expect(
      screen.queryByRole("button", { name: "Open attachments" }),
    ).toBeNull();
  });

  it("reserves deterministic preview widths without wrapping submitted rows", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        id: "single_submission",
        prompt: "A quiet ocean studio.",
        requestedGenerations: 1,
      }),
      createThreadSubmission({
        id: "multi_submission",
        prompt: "A lantern city at dusk.",
        requestedGenerations: 4,
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findAllByTestId("generation-thread-job");

    const rows = container.querySelectorAll<HTMLElement>(
      '[data-slot="generation-submission-row"]',
    );
    const outputs = container.querySelectorAll<HTMLElement>(
      '[data-slot="generation-submission-outputs"]',
    );
    const submittedInputs = container.querySelectorAll<HTMLElement>(
      '[data-slot="generation-result-submitted-input"]',
    );

    expect(rows).toHaveLength(2);
    expect(outputs).toHaveLength(2);
    expect(submittedInputs).toHaveLength(2);
    expect(
      Array.from(rows).every((row) => row.className.includes("flex-nowrap")),
    ).toBe(true);
    expect(outputs[0]?.className).toContain("w-40");
    expect(outputs[0]?.className).toContain("shrink-0");
    expect(outputs[1]?.className).toContain(
      "w-[calc(10rem+var(--remora-preview-stack-overflow-inset))]",
    );
    expect(outputs[1]?.className).toContain("shrink-0");
    expect(
      Array.from(submittedInputs).every(
        (input) =>
          input.className.includes("min-w-0") &&
          input.className.includes("flex-1"),
      ),
    ).toBe(true);
  });

  it("opens a signed attachments panel from the submitted media badge", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        attachmentMedia: createAttachmentMediaValue(),
      }),
    ];
    mocks.attachmentMedia.current = [
      createSignedAttachmentMedia({
        id: "reference_image_1",
        kind: "image",
        fieldId: "images",
        originalFileName: "reference.png",
        url: "https://signed.example/reference.png",
      }),
      createSignedAttachmentMedia({
        id: "reference_video_1",
        kind: "video",
        fieldId: "videos",
        originalFileName: "motion.mp4",
        contentType: "video/mp4",
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: 5,
          fps: 24,
        },
        url: "https://signed.example/motion.mp4",
      }),
      createSignedAttachmentMedia({
        id: "reference_audio_1",
        kind: "audio",
        fieldId: "audios",
        originalFileName: "sound.wav",
        contentType: "audio/wav",
        metadata: {
          widthPx: null,
          heightPx: null,
          durationSec: 3,
          fps: null,
        },
        url: "https://signed.example/sound.wav",
      }),
    ];

    const { container } = renderGenerationResults();

    const mediaButton = await screen.findByRole("button", {
      name: "Open attachments",
    });
    const resultsLayout = getGenerationResultsLayout(container);
    const attachmentMediaPanel = getAttachmentMediaPanel(container);
    const attachmentMediaPanelItems = getAttachmentMediaPanelItems(container);

    expect(mediaButton.textContent).toContain("Attachments");
    expect(mediaButton.getAttribute("aria-controls")).toBe(
      "attachment-media-panel",
    );
    expect(mediaButton.getAttribute("aria-expanded")).toBe("false");
    expect(attachmentMediaPanel.getAttribute("data-state")).toBe("closed");
    expect(attachmentMediaPanel.getAttribute("aria-hidden")).toBe("true");
    expect(attachmentMediaPanel.className).toContain(
      "left-[calc(100%+var(--remora-generation-stack-panel-gap))]",
    );
    expect(attachmentMediaPanel.className).toContain(
      "w-[var(--remora-generation-stack-panel-width)]",
    );
    expect(attachmentMediaPanelItems.className).toContain("auto-rows-max");
    expect(attachmentMediaPanelItems.className).toContain("content-start");
    expect(attachmentMediaPanelItems.className).toContain("overflow-y-auto");

    fireEvent.click(mediaButton);

    await waitFor(() => {
      expect(mediaButton.getAttribute("aria-expanded")).toBe("true");
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe("open");
      expect(resultsLayout.style.transform).toBe(
        multiGenerationPanelOpenTransform,
      );
      expect(attachmentMediaPanel.getAttribute("data-state")).toBe("open");
      expect(attachmentMediaPanel.getAttribute("aria-hidden")).toBe("false");
      expect(
        attachmentMediaPanel.getAttribute("data-active-submission-id"),
      ).toBe("submission_1");
    });
    expect(mocks.attachmentMediaQueryOptions).toHaveBeenCalledWith(
      { submissionId: "submission_1" },
      { enabled: true },
    );

    const image = await within(attachmentMediaPanel).findByRole("img", {
      name: "Attachment image: reference.png",
    });
    const video = attachmentMediaPanel.querySelector<HTMLVideoElement>(
      'video[aria-label="Attachment video: motion.mp4"]',
    );
    const audio = attachmentMediaPanel.querySelector<HTMLAudioElement>(
      'audio[aria-label="Attachment audio: sound.wav"]',
    );

    expect(image.getAttribute("src")).toBe(
      "https://signed.example/reference.png",
    );
    expect(video?.getAttribute("src")).toBe(
      "https://signed.example/motion.mp4",
    );
    expect(video?.hasAttribute("controls")).toBe(true);
    expect(video?.getAttribute("preload")).toBe("metadata");
    expect(audio?.getAttribute("src")).toBe("https://signed.example/sound.wav");
    expect(audio?.hasAttribute("controls")).toBe(true);

    fireEvent.click(
      within(attachmentMediaPanel).getByRole("button", {
        name: "Close attachments panel",
      }),
    );

    await waitFor(() => {
      expect(mediaButton.getAttribute("aria-expanded")).toBe("false");
      expect(attachmentMediaPanel.getAttribute("data-state")).toBe("closed");
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
    });
  });

  it("switches from attachment media to the generation stack panel", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        attachmentMedia: createAttachmentMediaValue(),
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
        ],
      }),
    ];
    mocks.attachmentMedia.current = [
      createSignedAttachmentMedia({
        id: "reference_image_1",
        url: "https://signed.example/reference.png",
      }),
    ];

    const { container } = renderGenerationResults();

    const mediaButton = await screen.findByRole("button", {
      name: "Open attachments",
    });
    const stackTrigger = await screen.findByRole("button", {
      name: "Open generation stack",
    });
    const attachmentMediaPanel = getAttachmentMediaPanel(container);
    const stackPanel = getStackPanel(container);

    fireEvent.click(mediaButton);

    await waitFor(() => {
      expect(attachmentMediaPanel.getAttribute("data-state")).toBe("open");
    });

    fireEvent.click(stackTrigger);

    await waitFor(() => {
      expect(attachmentMediaPanel.getAttribute("data-state")).toBe("closed");
      expect(stackPanel.getAttribute("data-state")).toBe("open");
      expect(
        screen
          .getByRole("button", { name: "Close generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
      expect(mediaButton.getAttribute("aria-expanded")).toBe("false");
    });
  });

  it("keeps skeleton output placeholders when no completed preview or fallback exists", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobCount: 3,
      }),
    ];

    renderGenerationResults();

    expect(await screen.findAllByTestId("generation-thread-job")).toHaveLength(
      1,
    );
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("renders a failed output for a single failed generation", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "failed",
            terminalError: {
              source: "provider",
              code: "SEED_PROVIDER_REJECTION",
              message: "Seeded provider rejection",
            },
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const failedOutput = await screen.findByRole("status", {
      name: "Generation failed",
    });
    const failedOutputContainer = failedOutput.parentElement;

    expect(failedOutput.className).toContain("bg-card");
    expect(failedOutputContainer?.className).toContain("size-40");
    expect(failedOutput.className).toContain("rounded-md");
    expect(failedOutput.style.inset).toBe("10%");
    expect(failedOutput.getAttribute("aria-description")).toBe(
      "Seeded provider rejection",
    );
    expect(
      failedOutput.querySelector(
        '[data-slot="generation-submission-failed-output-icon"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '[data-slot="generation-submission-failed-output"]',
      ),
    ).toBe(failedOutput);
    expect(screen.queryByRole("status", { name: "Generating" })).toBeNull();

    fireEvent.mouseEnter(failedOutput);

    await waitFor(() => {
      expect(failedOutput.hasAttribute("data-popup-open")).toBe(true);
    });
  });

  it("renders a completed preview image", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    const preview = await screen.findByRole("img", {
      name: "Generation preview",
    });
    const previewTile = container.querySelector<HTMLElement>(
      '[data-slot="generation-submission-preview-tile"]',
    );
    const previewFrame = container.querySelector<HTMLElement>(
      '[data-slot="generation-submission-preview-frame"]',
    );

    expect(previewTile).not.toBeNull();
    expect(previewFrame).not.toBeNull();
    expect(previewTile?.contains(previewFrame)).toBe(true);
    expect(previewFrame?.contains(preview)).toBe(true);
    expect(previewTile?.className).toContain(
      "-mt-[var(--remora-preview-stack-overflow-inset)]",
    );
    expect(previewTile?.className).not.toContain(
      "pr-[var(--remora-preview-stack-overflow-inset)]",
    );
    expect(previewFrame?.parentElement?.className).toContain("size-40");
    expect(previewFrame?.className).toContain("absolute");
    expect(previewFrame?.style.inset).toBe("10%");
    expect(preview.className).toContain("size-full");
    expect(preview.getAttribute("src")).toBe(
      "https://assets.example/first.jpg",
    );
    expect(
      screen.getByRole("button", { name: "Play generated video" }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("generation-thread-job")).toHaveLength(1);
  });

  it("renders stacked preview layers for multi-generation submissions", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_3",
            submissionIndex: 2,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/third.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_4",
            submissionIndex: 3,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/fourth.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    const preview = await screen.findByRole("img", {
      name: "Generation preview",
    });
    const stackLayers = container.querySelectorAll<HTMLElement>(
      '[data-slot="generation-submission-preview-stack-layer"]',
    );
    const stackImages = container.querySelectorAll<HTMLImageElement>(
      '[data-slot="generation-submission-preview-stack-image"]',
    );

    expect(preview.getAttribute("src")).toBe(
      "https://assets.example/first.jpg",
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(stackLayers).toHaveLength(2);
    expect(stackImages).toHaveLength(2);
    expect(stackLayers[0]?.style.transform).toBe(
      "translate(calc(9px + var(--remora-preview-stack-hover-x, 0px)), calc(-9px + var(--remora-preview-stack-hover-y, 0px)))",
    );
    expect(stackLayers[1]?.style.transform).toBe(
      "translate(calc(18px + var(--remora-preview-stack-hover-x, 0px)), calc(-18px + var(--remora-preview-stack-hover-y, 0px)))",
    );
    expect(stackLayers[0]?.className).toContain("duration-500");
    expect(stackLayers[0]?.className).toContain(
      "ease-[cubic-bezier(0.22,1,0.36,1)]",
    );
    expect(stackLayers[0]?.className).toContain(
      "group-hover:[--remora-preview-stack-hover-x:3px]",
    );
    expect(stackLayers[1]?.className).toContain(
      "group-hover:[--remora-preview-stack-hover-x:6px]",
    );
    const previewTile = container.querySelector<HTMLElement>(
      '[data-slot="generation-submission-preview-tile"]',
    );

    expect(previewTile?.className).toContain(
      "pr-[var(--remora-preview-stack-overflow-inset)]",
    );
    expect(stackImages[0]?.getAttribute("src")).toBe(
      "https://assets.example/second.jpg",
    );
    expect(stackImages[1]?.getAttribute("src")).toBe(
      "https://assets.example/third.jpg",
    );
    expect(stackImages[0]?.getAttribute("aria-hidden")).toBe("true");
    expect(stackImages[0]?.getAttribute("alt")).toBe("");
    expect(
      screen.queryByRole("button", { name: "Play generated video" }),
    ).toBeNull();
    const stackTrigger = screen.getByRole("button", {
      name: "Open generation stack",
    });

    expect(stackTrigger.getAttribute("aria-controls")).toBe(
      "generation-stack-panel",
    );
    expect(stackTrigger.getAttribute("aria-expanded")).toBe("false");
    expect(stackTrigger.className).toContain("outline-none");
    expect(stackTrigger.className).not.toContain("focus-visible:ring");
    expect(screen.getAllByTestId("generation-thread-job")).toHaveLength(1);
  });

  it("toggles the stack panel state and nudges results from multi-generation stack clicks", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    const stackTrigger = await screen.findByRole("button", {
      name: "Open generation stack",
    });
    const results = getGenerationResults(container);
    const resultsLayout = getGenerationResultsLayout(container);
    const resultsList = getGenerationResultsList(container);
    const resultsBottomSpacer = getGenerationResultsBottomSpacer(container);
    const stackPanel = getStackPanel(container);
    const stackPanelJobs = getStackPanelJobs(container);

    expect(results.contains(resultsLayout)).toBe(true);
    expect(resultsLayout.contains(stackPanel)).toBe(true);
    expect(stackPanel.contains(stackPanelJobs)).toBe(true);
    expect(results.className).toContain("absolute");
    expect(results.className).toContain("inset-0");
    expect(results.className).toContain("z-[2]");
    expect(results.className).toContain("min-h-[inherit]");
    expect(results.className).toContain("flex-col");
    expect(results.className).toContain("overflow-x-hidden");
    expect(results.className).toContain("overflow-y-auto");
    expect(results.className).not.toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(results.className).not.toContain(
      "pb-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(resultsLayout.className).toContain("mx-auto");
    expect(resultsLayout.className).toContain("flex-1");
    expect(resultsLayout.className).toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(resultsList.contains(resultsBottomSpacer)).toBe(true);
    expect(resultsList.className).not.toContain("overflow-y-auto");
    expect(resultsBottomSpacer.className).toContain(
      "h-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(resultsBottomSpacer.className).toContain("shrink-0");
    expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe("closed");
    expect(resultsLayout.style.transform).toBe(
      multiGenerationPanelClosedTransform,
    );
    expect(stackPanel.getAttribute("data-state")).toBe("closed");
    expect(stackPanel.getAttribute("aria-hidden")).toBe("true");
    expect(stackPanel.className).toContain("absolute");
    expect(stackPanel.className).toContain("top-0");
    expect(stackPanel.className).not.toContain("h-full");
    expect(stackPanel.className).toContain(
      "bottom-[var(--remora-generation-composer-bottom-inset)]",
    );
    expect(stackPanel.className).toContain(
      "left-[calc(100%+var(--remora-generation-stack-panel-gap))]",
    );
    expect(stackPanel.className).toContain(
      "w-[var(--remora-generation-stack-panel-width)]",
    );
    expect(stackPanel.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-[var(--remora-generation-stack-panel-expanded-width)]",
    );
    expect(stackPanelJobs.className).toContain("auto-rows-max");
    expect(stackPanelJobs.className).toContain("content-start");
    expect(stackPanelJobs.className).toContain("-mr-2");
    expect(stackPanelJobs.className).toContain("pr-2");
    expect(stackPanelJobs.className).toContain("overflow-y-auto");

    fireEvent.click(stackTrigger);

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Close generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe("open");
      expect(resultsLayout.style.transform).toBe(
        multiGenerationPanelOpenTransform,
      );
      expect(stackPanel.getAttribute("data-state")).toBe("open");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("false");
      expect(stackPanel.getAttribute("data-active-submission-id")).toBe(
        "submission_1",
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Close generation stack" }),
    );

    await waitFor(() => {
      expect(
        screen
          .getByRole("button", { name: "Open generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
      expect(resultsLayout.style.transform).toBe(
        multiGenerationPanelClosedTransform,
      );
      expect(stackPanel.getAttribute("data-state")).toBe("closed");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("renders one non-stacked preview tile per completed panel job by submission index", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_3",
            submissionIndex: 2,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/third.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const stackPanel = await openStackPanel(container);
    const panelImages = within(stackPanel).getAllByRole("img", {
      name: "Generation preview",
    });

    expect(panelImages.map((image) => image.getAttribute("src"))).toEqual([
      "https://assets.example/first.jpg",
      "https://assets.example/second.jpg",
      "https://assets.example/third.jpg",
    ]);
    expect(
      within(stackPanel).getAllByTestId("generation-thread-job"),
    ).toHaveLength(3);
    expect(
      Array.from(
        stackPanel.querySelectorAll<HTMLElement>(
          '[data-slot="generation-submission-preview-tile"]',
        ),
      ).every(
        (previewTile) =>
          previewTile.className.includes("w-full") &&
          previewTile.className.includes("max-w-40") &&
          previewTile.firstElementChild?.className.includes("aspect-square"),
      ),
    ).toBe(true);
    expect(
      Array.from(
        stackPanel.querySelectorAll<HTMLElement>(
          '[data-slot="generation-submission-preview-tile"]',
        ),
      ).every(
        (previewTile) =>
          !previewTile.className.includes(
            "pr-[var(--remora-preview-stack-overflow-inset)]",
          ),
      ),
    ).toBe(true);
    expect(
      stackPanel.querySelectorAll(
        '[data-slot="generation-submission-preview-stack-layer"]',
      ),
    ).toHaveLength(0);
    expect(
      within(stackPanel).queryByRole("button", {
        name: /generation stack/i,
      }),
    ).toBeNull();
  });

  it("keeps queued panel jobs as skeletons and renders failed jobs", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "queued",
            result: null,
          }),
          createGenerationJob({
            id: "job_3",
            submissionIndex: 2,
            status: "failed",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/failed.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const stackPanel = await openStackPanel(container);

    expect(
      within(stackPanel).getAllByTestId("generation-thread-job"),
    ).toHaveLength(3);
    expect(
      within(stackPanel).getAllByRole("status", { name: "Generating" }),
    ).toHaveLength(1);
    const failedOutput = within(stackPanel).getByRole("status", {
      name: "Generation failed",
    });
    const failedOutputContainer = failedOutput.parentElement;

    expect(failedOutput.className).toContain("bg-card");
    expect(failedOutput.style.inset).toBe("10%");
    expect(failedOutputContainer?.className).toContain("aspect-square");
    expect(failedOutputContainer?.className).toContain("w-full");
    expect(failedOutputContainer?.className).toContain("max-w-40");
    expect(failedOutputContainer?.className).not.toContain("size-40");
    expect(
      within(stackPanel)
        .getByRole("img", { name: "Generation preview" })
        .getAttribute("src"),
    ).toBe("https://assets.example/first.jpg");
  });

  it("renders three previews and one failed output in a four-job panel", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_3",
            submissionIndex: 2,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/third.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_4",
            submissionIndex: 3,
            status: "failed",
            terminalError: {
              source: "provider",
              code: "SEED_PROVIDER_REJECTION",
              message: "Seeded provider rejection",
            },
            result: createGenerationResult({
              providerStatus: "failed",
              previewImageUrl: null,
              videoUrl: null,
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const stackPanel = await openStackPanel(container);

    expect(
      within(stackPanel).getAllByRole("img", { name: "Generation preview" }),
    ).toHaveLength(3);
    expect(
      within(stackPanel).getByRole("status", { name: "Generation failed" }),
    ).toBeTruthy();
    expect(
      within(stackPanel).queryByRole("status", { name: "Generating" }),
    ).toBeNull();
  });

  it("opens playback from completed panel job tiles", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: "https://assets.example/first.mp4",
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: "https://assets.example/second.mp4",
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const stackPanel = await openStackPanel(container);
    const panelFrames = stackPanel.querySelectorAll<HTMLElement>(
      '[data-slot="generation-submission-preview-frame"]',
    );

    expect(panelFrames).toHaveLength(2);
    mockViewportSize({ height: 768, width: 1024 });
    mockElementRect(panelFrames[0]!, {
      height: 72,
      left: 320,
      top: 80,
      width: 128,
    });

    fireEvent.click(
      within(stackPanel).getAllByRole("button", {
        name: "Play generated video",
      })[0]!,
    );

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);
    expect(
      screen.getByRole("dialog", { name: "Generated video playback" }),
    ).toBeTruthy();
  });

  it("switches the active stack panel selection from one stack to another", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        id: "submission_1",
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionId: "submission_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionId: "submission_1",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/second.jpg",
            }),
          }),
        ],
      }),
      createThreadSubmission({
        id: "submission_2",
        prompt: "A lantern city at dusk.",
        jobs: [
          createGenerationJob({
            id: "job_3",
            submissionId: "submission_2",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/third.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_4",
            submissionId: "submission_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/fourth.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    const stackTriggers = await screen.findAllByRole("button", {
      name: "Open generation stack",
    });

    fireEvent.click(stackTriggers[0]!);

    await waitFor(() => {
      const triggerElements = getStackTriggers(container);

      expect(triggerElements[0]?.getAttribute("aria-expanded")).toBe("true");
      expect(triggerElements[1]?.getAttribute("aria-expanded")).toBe("false");
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Open generation stack" }),
    );

    await waitFor(() => {
      const triggerElements = getStackTriggers(container);

      expect(triggerElements[0]?.getAttribute("aria-expanded")).toBe("false");
      expect(triggerElements[1]?.getAttribute("aria-expanded")).toBe("true");
      expect(
        screen.getAllByRole("button", {
          name: "Close generation stack",
        }),
      ).toHaveLength(1);
    });
  });

  it("renders stacked duplicate previews when only one generation has completed", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/first.jpg",
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "queued",
            result: null,
          }),
          createGenerationJob({
            id: "job_3",
            submissionIndex: 2,
            status: "queued",
            result: null,
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    const preview = await screen.findByRole("img", {
      name: "Generation preview",
    });
    const stackImages = container.querySelectorAll<HTMLImageElement>(
      '[data-slot="generation-submission-preview-stack-image"]',
    );

    expect(preview.getAttribute("src")).toBe(
      "https://assets.example/first.jpg",
    );
    expect(
      Array.from(stackImages).map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://assets.example/first.jpg",
      "https://assets.example/first.jpg",
    ]);
    expect(
      screen.queryByRole("button", { name: "Play generated video" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open generation stack" }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("generation-thread-job")).toHaveLength(1);
  });

  it("does not render a playback button for image-only previews", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: null,
              previewImageUrl: "https://assets.example/image.jpg",
            }),
          }),
        ],
      }),
    ];

    renderGenerationResults();

    await screen.findByRole("img", { name: "Generation preview" });

    expect(
      screen.queryByRole("button", { name: "Play generated video" }),
    ).toBeNull();
  });

  it("renders signed image result assets and opens a full-screen viewer", async () => {
    mocks.submissions.current = [
      createImageThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              providerId: "google",
              providerTaskId: "interaction_1",
              providerModelId: "gemini-3.1-flash-image",
              videoUrl: null,
              previewImageUrl: null,
              assets: [
                createImageResultAsset("https://assets.example/image.jpg"),
              ],
            }),
          }),
        ],
      }),
    ];

    renderGenerationResults();

    const preview = await screen.findByRole("img", {
      name: "Generated image",
    });

    expect(preview.getAttribute("src")).toBe(
      "https://assets.example/image.jpg",
    );
    expect(
      screen.queryByRole("button", { name: "Play generated video" }),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "View generated image" }),
    );

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);
    const dialog = screen.getByRole("dialog", {
      name: "Generated image viewer",
    });
    const viewerContent = dialog.querySelector<HTMLElement>(
      '[data-slot="generation-image-viewer-content"]',
    );
    const viewerBackdrop = dialog.querySelector<HTMLButtonElement>(
      '[data-slot="generation-image-viewer-backdrop"]',
    );
    const viewerImage = within(dialog).getByRole("img", {
      name: "Generated image",
    });

    expect(dialog).toBeTruthy();
    expect(viewerContent).not.toBeNull();
    expect(viewerBackdrop).not.toBeNull();
    expect(viewerContent?.className).toContain("size-full");
    expect(viewerContent?.className).toContain("min-h-0");
    expect(viewerContent?.className).toContain("min-w-0");
    expect(viewerContent?.className).toContain("pointer-events-none");
    expect(viewerImage.getAttribute("src")).toBe(
      "https://assets.example/image.jpg",
    );
    expect(viewerImage.className).toContain("max-h-full");
    expect(viewerImage.className).toContain("max-w-full");
    expect(viewerImage.className).toContain("object-contain");
    expect(viewerImage.className).toContain("pointer-events-auto");

    fireEvent.click(viewerBackdrop!);

    expect(
      screen.queryByRole("dialog", { name: "Generated image viewer" }),
    ).toBeNull();
    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);

    fireEvent.click(
      screen.getByRole("button", { name: "View generated image" }),
    );

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(
      screen.queryByRole("dialog", { name: "Generated image viewer" }),
    ).toBeNull();
    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);
  });

  it("renders each signed image in the multi-generation panel", async () => {
    mocks.submissions.current = [
      createImageThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            id: "job_1",
            submissionIndex: 0,
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: null,
              assets: [
                createImageResultAsset("https://assets.example/first.jpg"),
              ],
            }),
          }),
          createGenerationJob({
            id: "job_2",
            submissionIndex: 1,
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: null,
              assets: [
                createImageResultAsset("https://assets.example/second.jpg"),
              ],
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    fireEvent.click(
      await screen.findByRole("button", { name: "Open generation stack" }),
    );

    const stackPanel = getStackPanel(container);

    await waitFor(() => {
      expect(stackPanel.getAttribute("data-state")).toBe("open");
    });

    expect(
      within(stackPanel)
        .getAllByRole("img", { name: "Generated image" })
        .map((image) => image.getAttribute("src")),
    ).toEqual([
      "https://assets.example/first.jpg",
      "https://assets.example/second.jpg",
    ]);
  });

  it("renders the video fallback image when a completed video is missing its preview", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: "https://assets.example/video.mp4",
              previewImageUrl: null,
            }),
          }),
        ],
      }),
    ];

    renderGenerationResults();

    const preview = await screen.findByRole("img", {
      name: "Video preview unavailable",
    });

    expect(preview.getAttribute("src")).toBe(
      generationVideoPreviewFallbackImageUrl,
    );
    expect(
      screen.getByRole("button", { name: "Play generated video" }),
    ).toBeTruthy();
    expect(screen.getAllByTestId("generation-thread-job")).toHaveLength(1);
  });

  it("opens the playback modal from the preview frame bounds", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByRole("img", { name: "Generation preview" });
    mockViewportSize({ height: 768, width: 1024 });
    mockElementRect(getPreviewFrame(container), {
      height: 72,
      left: 64,
      top: 80,
      width: 128,
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Play generated video" }),
    );

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    const dialog = screen.getByRole("dialog", {
      name: "Generated video playback",
    });
    const backdrop = getPlaybackBackdrop();
    const surface = getPlaybackSurface();

    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.style.outline).toBe("none");
    expect(dialog.style.top).toBe("var(--remora-titlebar-height)");
    expect(backdrop.style.opacity).toBe("0");
    expect(backdrop.style.transition).toBe(
      "opacity 320ms cubic-bezier(0.22,1,0.36,1)",
    );
    expect(surface.style.left).toBe("0px");
    expect(surface.style.top).toBe("118px");
    expect(surface.style.width).toBe("1024px");
    expect(surface.style.height).toBe("576px");
    expect(surface.style.transition).toBe(
      "transform 320ms cubic-bezier(0.22,1,0.36,1)",
    );
    expect(surface.style.transform).toBe(
      "translate3d(64px, -38px, 0) scale(0.125, 0.125)",
    );
  });

  it("renders the actual video URL after the opening transition completes", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              videoUrl: "https://assets.example/playable.mp4",
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const surface = await openPlaybackModal(container);

    await completeOpeningTransition(surface);

    const video = screen.getByTestId("generation-video-playback-video");

    expect(video.getAttribute("src")).toBe(
      "https://assets.example/playable.mp4",
    );
    expect(video.hasAttribute("controls")).toBe(true);
  });

  it("temporarily collapses an initially open sidebar while the playback modal is open", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const surface = await openPlaybackModal(container);

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    await completeOpeningTransition(surface);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);
    expect(
      screen.getByRole("dialog", { name: "Generated video playback" }),
    ).toBeTruthy();

    fireEvent.transitionEnd(surface, { propertyName: "transform" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Generated video playback" }),
      ).toBeNull();
      expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);
    });
  });

  it("keeps the sidebar collapsed during StrictMode playback remount checks", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults({ strictMode: true });

    await openPlaybackModal(container);
    await act(async () => {});

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);
  });

  it("keeps an initially collapsed sidebar collapsed after the playback modal closes", async () => {
    useDesktopPreferencesStore.setState({ sidebarOpen: false });
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const surface = await openPlaybackModal(container);

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    await completeOpeningTransition(surface);

    fireEvent.click(getPlaybackBackdrop());

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    fireEvent.transitionEnd(surface, { propertyName: "transform" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Generated video playback" }),
      ).toBeNull();
      expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);
    });
  });

  it("closes the playback modal with Escape", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const surface = await openPlaybackModal(container);

    await completeOpeningTransition(surface);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);

    await waitFor(() => {
      expect(getPlaybackBackdrop().style.opacity).toBe("0");
    });

    fireEvent.transitionEnd(surface, { propertyName: "transform" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Generated video playback" }),
      ).toBeNull();
    });
  });

  it("closes the playback modal from an outside click", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobs: [
          createGenerationJob({
            status: "succeeded",
            result: createGenerationResult({
              previewImageUrl: "https://assets.example/preview.jpg",
            }),
          }),
        ],
      }),
    ];

    const { container } = renderGenerationResults();
    const surface = await openPlaybackModal(container);

    await completeOpeningTransition(surface);

    fireEvent.click(getPlaybackBackdrop());

    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);

    fireEvent.transitionEnd(surface, { propertyName: "transform" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Generated video playback" }),
      ).toBeNull();
    });
  });

  it("renders the requested generation count in submitted settings", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt: "A quiet ocean studio.",
        jobCount: 1,
        requestedGenerations: 4,
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");

    const submittedSettings = container.querySelector<HTMLElement>(
      '[data-slot="submitted-generation-settings"]',
    );

    if (!submittedSettings) {
      throw new Error("Expected submitted generation settings to be rendered.");
    }

    const requestedGenerationsBadge = within(submittedSettings).getByText("4");

    expect(requestedGenerationsBadge).toBeTruthy();
    expect(requestedGenerationsBadge.className).toContain("bg-surface-strong");
    expect(requestedGenerationsBadge.className).toContain(
      "text-secondary-foreground",
    );
    expect(requestedGenerationsBadge.className).not.toContain("bg-primary");
    expect(screen.getAllByTestId("generation-thread-job")).toHaveLength(1);
  });

  it("renders the model used by each submission", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        id: "submission_seedance",
        modelDisplayName: "Seedance 2.0",
        prompt: "A quiet ocean studio.",
      }),
      createThreadSubmission({
        id: "submission_kling",
        modelDisplayName: "Kling 3.0",
        prompt: "A lantern city at dusk.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findAllByTestId("generation-thread-job");

    const modelPills = Array.from(
      container.querySelectorAll('[data-slot="submitted-generation-settings"]'),
      (settings) =>
        settings.querySelector<HTMLElement>(
          '[data-slot="submitted-generation-model"]',
        ),
    );

    expect(modelPills.map((modelPill) => modelPill?.textContent)).toEqual([
      "Seedance 2.0",
      "Kling 3.0",
    ]);
    expect(
      modelPills.every((modelPill) =>
        modelPill?.className.includes("bg-surface-strong"),
      ),
    ).toBe(true);
  });

  it("reserves space between collapsed prompts and submitted settings", async () => {
    mocks.submissions.current = [
      createThreadSubmission({
        prompt:
          "A quiet ocean studio with a long prompt that should stop before the submitted setting badges.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");

    const collapsedPrompt = container.querySelector<HTMLElement>(
      '[data-slot="generation-result-prompt-collapsed"]',
    );
    const promptMeasure = container.querySelector<HTMLElement>(
      '[data-slot="generation-result-prompt-measure"]',
    );

    expect(collapsedPrompt).not.toBeNull();
    expect(promptMeasure).not.toBeNull();
    expect(collapsedPrompt?.className).toContain("h-[5rem]");
    expect(promptMeasure?.className).toContain("h-[5rem]");
    expect(collapsedPrompt?.className).not.toContain("h-[6.25rem]");
    expect(promptMeasure?.className).not.toContain("h-[6.25rem]");
  });
});

function renderGenerationResults({
  strictMode = false,
}: { strictMode?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const results = (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <GenerationResultsTestHarness />
      </HotkeysProvider>
    </QueryClientProvider>
  );

  return render(strictMode ? <StrictMode>{results}</StrictMode> : results);
}

function GenerationResultsTestHarness() {
  const [activePanel, setActivePanel] =
    useState<GenerationResultsActivePanel | null>(null);

  return (
    <GenerationResults
      activePanel={activePanel}
      attachmentMediaPanelId="attachment-media-panel"
      stackPanelId="generation-stack-panel"
      threadId="thread_1"
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

async function measurePromptOverflow(
  container: HTMLElement,
  measurements: {
    clientHeight: number;
    scrollHeight: number;
  },
) {
  const viewport = container.querySelector<HTMLElement>(
    '[data-slot="generation-result-prompt-measure"]',
  );
  const content = container.querySelector<HTMLElement>(
    '[data-slot="generation-result-prompt-measure-content"]',
  );

  if (!viewport || !content) {
    throw new Error("Expected prompt measurement elements to be rendered.");
  }

  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    value: measurements.clientHeight,
  });
  Object.defineProperty(content, "scrollHeight", {
    configurable: true,
    value: measurements.scrollHeight,
  });

  await act(async () => {
    window.dispatchEvent(new Event("resize"));
  });

  await waitFor(() => {
    expect(content.scrollHeight).toBe(measurements.scrollHeight);
  });
}

async function openStackPanel(container: HTMLElement) {
  fireEvent.click(
    await screen.findByRole("button", { name: "Open generation stack" }),
  );

  const stackPanel = getStackPanel(container);

  await waitFor(() => {
    expect(stackPanel.getAttribute("data-state")).toBe("open");
  });

  return stackPanel;
}

async function openPlaybackModal(container: HTMLElement) {
  await screen.findByRole("img", { name: "Generation preview" });
  mockViewportSize({ height: 768, width: 1024 });
  mockElementRect(getPreviewFrame(container), {
    height: 72,
    left: 64,
    top: 80,
    width: 128,
  });

  fireEvent.click(screen.getByRole("button", { name: "Play generated video" }));

  return getPlaybackSurface();
}

async function completeOpeningTransition(surface: HTMLElement) {
  await waitFor(() => {
    expect(surface.style.transform).toBe("translate3d(0, 0, 0) scale(1)");
  });

  fireEvent.transitionEnd(surface, { propertyName: "transform" });

  await screen.findByTestId("generation-video-playback-video");
}

function getPreviewFrame(container: HTMLElement) {
  const previewFrame = container.querySelector<HTMLElement>(
    '[data-slot="generation-submission-preview-frame"]',
  );

  if (!previewFrame) {
    throw new Error("Expected preview frame to be rendered.");
  }

  return previewFrame;
}

function getGenerationResults(container: HTMLElement) {
  const results = container.querySelector<HTMLElement>(
    '[data-slot="generation-results"]',
  );

  if (!results) {
    throw new Error("Expected generation results to be rendered.");
  }

  return results;
}

function getGenerationResultsLayout(container: HTMLElement) {
  const resultsLayout = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-layout"]',
  );

  if (!resultsLayout) {
    throw new Error("Expected generation results layout to be rendered.");
  }

  return resultsLayout;
}

function getGenerationResultsList(container: HTMLElement) {
  const resultsList = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-list"]',
  );

  if (!resultsList) {
    throw new Error("Expected generation results list to be rendered.");
  }

  return resultsList;
}

function getGenerationResultsBottomSpacer(container: HTMLElement) {
  const spacer = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-bottom-spacer"]',
  );

  if (!spacer) {
    throw new Error(
      "Expected generation results bottom spacer to be rendered.",
    );
  }

  return spacer;
}

function getStackPanel(container: HTMLElement) {
  const stackPanel = container.querySelector<HTMLElement>(
    '[data-slot="generation-stack-panel"]',
  );

  if (!stackPanel) {
    throw new Error("Expected generation stack panel to be rendered.");
  }

  return stackPanel;
}

function getStackPanelJobs(container: HTMLElement) {
  const stackPanelJobs = container.querySelector<HTMLElement>(
    '[data-slot="generation-stack-panel-jobs"]',
  );

  if (!stackPanelJobs) {
    throw new Error("Expected generation stack panel jobs to be rendered.");
  }

  return stackPanelJobs;
}

function getAttachmentMediaPanel(container: HTMLElement) {
  const attachmentMediaPanel = container.querySelector<HTMLElement>(
    '[data-slot="submitted-attachment-media-panel"]',
  );

  if (!attachmentMediaPanel) {
    throw new Error("Expected submitted attachments panel to be rendered.");
  }

  return attachmentMediaPanel;
}

function getAttachmentMediaPanelItems(container: HTMLElement) {
  const attachmentMediaPanelItems = container.querySelector<HTMLElement>(
    '[data-slot="submitted-attachment-media-panel-items"]',
  );

  if (!attachmentMediaPanelItems) {
    throw new Error(
      "Expected submitted attachments panel items to be rendered.",
    );
  }

  return attachmentMediaPanelItems;
}

function getStackTriggers(container: HTMLElement) {
  const triggers = container.querySelectorAll<HTMLButtonElement>(
    '[data-slot="generation-submission-preview-stack-trigger"]',
  );

  if (triggers.length === 0) {
    throw new Error("Expected stack triggers to be rendered.");
  }

  return triggers;
}

function getPlaybackSurface() {
  const surface = document.body.querySelector<HTMLElement>(
    '[data-slot="generation-video-playback-surface"]',
  );

  if (!surface) {
    throw new Error("Expected playback surface to be rendered.");
  }

  return surface;
}

function getPlaybackBackdrop() {
  const backdrop = document.body.querySelector<HTMLElement>(
    '[data-slot="generation-video-playback-backdrop"]',
  );

  if (!backdrop) {
    throw new Error("Expected playback backdrop to be rendered.");
  }

  return backdrop;
}

function mockElementRect(
  element: HTMLElement,
  rect: {
    height: number;
    left: number;
    top: number;
    width: number;
  },
) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: rect.top + rect.height,
        height: rect.height,
        left: rect.left,
        right: rect.left + rect.width,
        top: rect.top,
        width: rect.width,
        x: rect.left,
        y: rect.top,
        toJSON: () => rect,
      }) as DOMRect,
  );
}

function mockViewportSize(size: { height: number; width: number }) {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: size.height,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: size.width,
  });
}

function createThreadSubmission({
  id = "submission_1",
  modelDisplayName = "Seedance 2.0",
  prompt,
  jobCount = 1,
  requestedGenerations,
  attachmentMedia,
  jobs,
}: {
  id?: string;
  modelDisplayName?: string;
  prompt: string;
  jobCount?: number;
  requestedGenerations?: number;
  attachmentMedia?: GenerationThreadSubmission["attachmentMedia"];
  jobs?: GenerationThreadSubmission["jobs"];
}): VideoGenerationThreadSubmission {
  const createdJobs =
    jobs ??
    Array.from({ length: jobCount }, (_, index) =>
      createGenerationJob({
        id: index === 0 ? "job_1" : `job_${index + 1}`,
        submissionId: id,
        submissionIndex: index,
      }),
    );

  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName,
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt,
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: requestedGenerations ?? createdJobs.length,
    attachmentMedia: attachmentMedia ?? {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: createdJobs,
  };
}

function createImageThreadSubmission({
  id = "submission_1",
  prompt,
  jobs,
}: {
  id?: string;
  prompt: string;
  jobs: GenerationThreadSubmission["jobs"];
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
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs,
  };
}

function createGenerationJob(
  overrides: Partial<GenerationThreadSubmission["jobs"][number]> = {},
): GenerationThreadSubmission["jobs"][number] {
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

function createGenerationResult(
  overrides: Partial<
    NonNullable<GenerationThreadSubmission["jobs"][number]["result"]>
  > = {},
): NonNullable<GenerationThreadSubmission["jobs"][number]["result"]> {
  return {
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
    ...overrides,
  };
}

function createImageResultAsset(url: string) {
  return {
    kind: "image" as const,
    bucket: "generation-results",
    objectKey: "image-result",
    contentType: "image/jpeg",
    contentLength: 1024,
    etag: null,
    checksumSha256: null,
    sourceProviderUrl: null,
    url,
    urlExpiresAt: "2026-06-05T00:06:00.000Z",
  };
}

function createAttachmentMediaValue(
  overrides: Partial<GenerationThreadSubmission["attachmentMedia"]> = {},
): GenerationThreadSubmission["attachmentMedia"] {
  return {
    images: [
      createThreadAttachmentMedia({
        id: "reference_image_1",
        kind: "image",
        fieldId: "images",
        originalFileName: "reference.png",
      }),
    ],
    videos: [
      createThreadAttachmentMedia({
        id: "reference_video_1",
        kind: "video",
        fieldId: "videos",
        originalFileName: "motion.mp4",
        contentType: "video/mp4",
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: 5,
          fps: 24,
        },
      }),
    ],
    audios: [
      createThreadAttachmentMedia({
        id: "reference_audio_1",
        kind: "audio",
        fieldId: "audios",
        originalFileName: "sound.wav",
        contentType: "audio/wav",
        metadata: {
          widthPx: null,
          heightPx: null,
          durationSec: 3,
          fps: null,
        },
      }),
    ],
    ...overrides,
  };
}

function createThreadAttachmentMedia(
  overrides: Partial<
    GenerationThreadSubmission["attachmentMedia"]["images"][number]
  > = {},
): GenerationThreadSubmission["attachmentMedia"]["images"][number] {
  return {
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
    ...overrides,
  };
}

function createSignedAttachmentMedia(
  overrides: Partial<SignedGenerationThreadAttachmentMedia> = {},
): SignedGenerationThreadAttachmentMedia {
  return {
    ...createThreadAttachmentMedia(overrides),
    url: "https://signed.example/reference.png",
    urlExpiresAt: "2026-06-05T00:17:00.000Z",
    ...overrides,
  };
}

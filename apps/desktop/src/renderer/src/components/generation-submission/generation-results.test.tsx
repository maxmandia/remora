/** @vitest-environment jsdom */

import type { GenerationThreadSubmission } from "@remora/backend/types";
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
import { GenerationResults } from "./generation-results.tsx";

const mocks = vi.hoisted(() => ({
  submissions: {
    current: [] as GenerationThreadSubmission[],
  },
  threadSubmissionsQueryOptions: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
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
    mocks.submissions.current = [];
    mocks.threadSubmissionsQueryOptions.mockReset();
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

    fireEvent.click(showMoreButton);

    const showLessButton = screen.getByRole("button", {
      name: "Show less",
    });

    expect(showLessButton.getAttribute("aria-expanded")).toBe("true");

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

  it("bottom-aligns submitted settings to the skeleton last dot row", async () => {
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

    expect(submittedSettings).not.toBeNull();
    expect(submittedSettings?.className).toContain("top-36");
    expect(submittedSettings?.className).toContain("-translate-y-full");
    expect(submittedSettings?.className).not.toContain("-translate-y-1/2");
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

    stackTrigger.focus();
    expect(document.activeElement).toBe(stackTrigger);

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
      expect(document.activeElement).not.toBe(stackTrigger);
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

  it("renders skeleton placeholders for non-displayable panel jobs", async () => {
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
    ).toHaveLength(2);
    expect(
      within(stackPanel)
        .getByRole("img", { name: "Generation preview" })
        .getAttribute("src"),
    ).toBe("https://assets.example/first.jpg");
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
  const [activeStackSubmissionId, setActiveStackSubmissionId] = useState<
    string | null
  >(null);

  return (
    <GenerationResults
      activeStackSubmissionId={activeStackSubmissionId}
      stackPanelId="generation-stack-panel"
      threadId="thread_1"
      onStackSubmissionToggle={(submissionId) =>
        setActiveStackSubmissionId((currentSubmissionId) =>
          currentSubmissionId === submissionId ? null : submissionId,
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
  prompt,
  jobCount = 1,
  requestedGenerations,
  jobs,
}: {
  id?: string;
  prompt: string;
  jobCount?: number;
  requestedGenerations?: number;
  jobs?: GenerationThreadSubmission["jobs"];
}): GenerationThreadSubmission {
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
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt,
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: requestedGenerations ?? createdJobs.length,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: createdJobs,
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

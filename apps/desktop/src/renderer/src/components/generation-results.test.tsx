/** @vitest-environment jsdom */

import type { GenerationThreadJob } from "@remora/backend/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationResults } from "./generation-results.tsx";

const mocks = vi.hoisted(() => ({
  jobs: {
    current: [] as GenerationThreadJob[],
  },
  threadJobsQueryOptions: vi.fn(),
}));

vi.mock("../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listGenerationsFromThread: {
        queryOptions: mocks.threadJobsQueryOptions,
      },
    },
  }),
}));

vi.mock("./dot-field-skeleton.tsx", async () => {
  const React = await import("react");

  return {
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
    mocks.jobs.current = [];
    mocks.threadJobsQueryOptions.mockReset();
    mocks.threadJobsQueryOptions.mockImplementation((input) => ({
      queryKey: ["generation", "listGenerationsFromThread", input],
      queryFn: async () => mocks.jobs.current,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("expands and collapses overflowing submitted prompts inline", async () => {
    mocks.jobs.current = [
      createThreadJob({
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
    mocks.jobs.current = [
      createThreadJob({
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
    mocks.jobs.current = [
      createThreadJob({
        prompt: "A quiet ocean studio.",
      }),
    ];

    const { container } = renderGenerationResults();

    await screen.findByTestId("generation-thread-job");

    const submittedSettings = container.querySelector<HTMLElement>(
      '[data-slot="submitted-generation-settings"]',
    );

    expect(submittedSettings).not.toBeNull();
    expect(submittedSettings?.className).toContain("top-[8.5rem]");
    expect(submittedSettings?.className).toContain("-translate-y-full");
    expect(submittedSettings?.className).not.toContain("-translate-y-1/2");
  });

  it("reserves space between collapsed prompts and submitted settings", async () => {
    mocks.jobs.current = [
      createThreadJob({
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

function renderGenerationResults() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <GenerationResults threadId="thread_1" />
    </QueryClientProvider>,
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

function createThreadJob({ prompt }: { prompt: string }): GenerationThreadJob {
  return {
    id: "job_1",
    threadId: "thread_1",
    modelId: "seedance-2.0-video",
    status: "succeeded",
    submittedInput: {
      prompt,
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
      lastFrameUrl: null,
      mediaUrlExpiresAt: null,
      providerError: null,
      receivedAt: "2026-06-05T00:01:00.000Z",
      createdAt: "2026-06-05T00:01:01.000Z",
      updatedAt: "2026-06-05T00:01:02.000Z",
    },
  };
}

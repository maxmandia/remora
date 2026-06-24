/** @vitest-environment jsdom */

import type {
  EstimateGenerationCostInput,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationSettingsValue } from "../../lib/generation/index.ts";
import {
  type AttachmentMediaFieldId,
  type GenerationAttachmentMediaItem,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { GenerationCommandInput } from "./generation-command-input.tsx";

const mocks = vi.hoisted(() => ({
  estimateGenerationCost: vi.fn(),
  estimateGenerationCostQueryOptions: vi.fn(),
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    modelRates: {
      estimateGenerationCost: {
        queryOptions: mocks.estimateGenerationCostQueryOptions,
      },
    },
  }),
}));

describe("GenerationCommandInput", () => {
  beforeEach(() => {
    mocks.estimateGenerationCost.mockReset();
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    });
    mocks.estimateGenerationCostQueryOptions.mockReset();
    mocks.estimateGenerationCostQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["modelRates", "estimateGenerationCost", input],
        queryFn: async () => mocks.estimateGenerationCost(input),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("requests a generation cost estimate from selected pricing fields", async () => {
    renderPromptInputWithEstimate({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
        videos: [createAttachmentMediaItem("motion.mp4", "video/mp4")],
      }),
    });

    await waitFor(() => {
      expect(mocks.estimateGenerationCost).toHaveBeenCalledWith(
        createSeedanceEstimateInput({
          attachmentMedia: {
            images: [{ role: "reference" }],
            videos: [{ role: "reference" }],
          },
        }),
      );
    });
  });

  it("does not request a new generation cost estimate when only the prompt changes", async () => {
    const promptInput = renderPromptInputWithEstimate({
      attachmentMediaValue: createAttachmentMediaValue(),
    });

    await waitFor(() => {
      expect(mocks.estimateGenerationCost).toHaveBeenCalledWith(
        createSeedanceEstimateInput(),
      );
    });

    mocks.estimateGenerationCost.mockClear();

    fireEvent.change(promptInput, {
      target: { value: "A glass studio under the ocean" },
    });

    await waitFor(() => {
      expect(promptInput.value).toBe("A glass studio under the ocean");
    });
    expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
  });

  it("opens attachment references when typing an @ token", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [
          createAttachmentMediaItem("first.png", "image/png"),
          createAttachmentMediaItem("second.png", "image/png"),
        ],
        videos: [createAttachmentMediaItem("clip.mp4", "video/mp4")],
        audios: [createAttachmentMediaItem("voice.wav", "audio/wav")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();
    expect(screen.getByRole("option", { name: "Image2" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Video1" })).not.toBeNull();
    expect(screen.getByRole("option", { name: "Audio1" })).not.toBeNull();
  });

  it("filters attachment references by the active @ query", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
        videos: [createAttachmentMediaItem("motion.mp4", "video/mp4")],
      }),
    });

    focusPromptAt(promptInput, "@vi", 3);

    expect(
      await screen.findByRole("option", { name: "Video1" }),
    ).not.toBeNull();
    expect(screen.queryByRole("option", { name: "Image1" })).toBeNull();
  });

  it("positions attachment references at the active @ token", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function mockElementRect(this: HTMLElement) {
        return {
          bottom: 0,
          height: 0,
          left: 0,
          right: 32,
          top: 0,
          width:
            this.tagName === "SPAN" && this.textContent === "Use " ? 32 : 0,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    Object.defineProperty(promptInput, "clientWidth", {
      configurable: true,
      value: 320,
    });

    focusPromptAt(promptInput, "Use @", 5);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();

    await waitFor(() => {
      expect(
        document.querySelector<HTMLElement>(
          '[data-slot="attachment-reference-menu"]',
        )?.style.left,
      ).toBe("32px");
    });
  });

  it("inserts a clicked attachment reference and restores the caret", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    focusPromptAt(promptInput, "Use @im near the water", 7);

    const option = await screen.findByRole("option", { name: "Image1" });

    fireEvent.mouseDown(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(promptInput.value).toBe("Use @Image1 near the water");
      expect(promptInput.selectionStart).toBe(12);
      expect(promptInput.selectionEnd).toBe(12);
    });
  });

  it("supports keyboard navigation and selection", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
        videos: [createAttachmentMediaItem("motion.mp4", "video/mp4")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      (await screen.findByRole("option", { name: "Image1" })).getAttribute(
        "aria-selected",
      ),
    ).toBe("true");

    fireEvent.keyDown(promptInput, { key: "ArrowDown" });

    expect(
      screen
        .getByRole("option", { name: "Video1" })
        .getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.keyDown(promptInput, { key: "Enter" });

    await waitFor(() => {
      expect(promptInput.value).toBe("@Video1 ");
      expect(promptInput.selectionStart).toBe(8);
      expect(promptInput.selectionEnd).toBe(8);
    });
  });

  it("closes attachment references with Escape", async () => {
    const promptInput = renderPromptInput({
      attachmentMediaValue: createAttachmentMediaValue({
        images: [createAttachmentMediaItem("still.png", "image/png")],
      }),
    });

    focusPromptAt(promptInput, "@", 1);

    expect(
      await screen.findByRole("option", { name: "Image1" }),
    ).not.toBeNull();

    fireEvent.keyDown(promptInput, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not show attachment references without attachments or a valid @ token", () => {
    const { rerender } = render(
      <ControlledGenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue()}
      />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    ) as HTMLInputElement;

    focusPromptAt(promptInput, "@", 1);

    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <ControlledGenerationCommandInput
        attachmentMediaValue={createAttachmentMediaValue({
          images: [createAttachmentMediaItem("still.png", "image/png")],
        })}
      />,
    );

    focusPromptAt(promptInput, "hello@", 6);

    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

function renderPromptInput({
  attachmentMediaValue,
  initialPrompt = "",
  generationSettings = null,
  selectedModel = null,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings?: GenerationSettingsValue | null;
  initialPrompt?: string;
  selectedModel?: PublishedGenerationModelSummary | null;
}) {
  render(
    <ControlledGenerationCommandInput
      attachmentMediaValue={attachmentMediaValue}
      generationSettings={generationSettings}
      initialPrompt={initialPrompt}
      selectedModel={selectedModel}
    />,
  );

  return screen.getByPlaceholderText(
    "A castle in the sky with...",
  ) as HTMLInputElement;
}

function renderPromptInputWithEstimate({
  attachmentMediaValue,
  generationSettings = createGenerationSettings(),
  selectedModel = createModel(),
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings?: GenerationSettingsValue;
  selectedModel?: PublishedGenerationModelSummary;
}) {
  const queryClient = createTestQueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <ControlledGenerationCommandInput
        attachmentMediaValue={attachmentMediaValue}
        generationSettings={generationSettings}
        selectedModel={selectedModel}
      />
    </QueryClientProvider>,
  );

  return screen.getByPlaceholderText(
    "A castle in the sky with...",
  ) as HTMLInputElement;
}

function ControlledGenerationCommandInput({
  attachmentMediaValue,
  generationSettings = null,
  initialPrompt = "",
  selectedModel = null,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings?: GenerationSettingsValue | null;
  initialPrompt?: string;
  selectedModel?: PublishedGenerationModelSummary | null;
}) {
  const [prompt, setPrompt] = useState(initialPrompt);

  return (
    <GenerationCommandInput
      attachmentMediaValue={attachmentMediaValue}
      generationSettings={generationSettings}
      prompt={prompt}
      selectedModel={selectedModel}
      onPromptChange={setPrompt}
    />
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createGenerationSettings(): GenerationSettingsValue {
  return {
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
  };
}

function createSeedanceEstimateInput(
  overrides: Partial<EstimateGenerationCostInput> = {},
): EstimateGenerationCostInput {
  return {
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
    attachmentMedia: {},
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
          id: "prompt",
          label: "Prompt",
          componentKind: "promptTextarea",
          valueKind: "string",
          required: true,
          advanced: false,
          omitWhenEmpty: false,
          omitWhenDefault: false,
          notes: [],
        },
      ],
      groups: [
        {
          id: "main",
          label: "Main",
          fieldIds: ["prompt"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function focusPromptAt(
  promptInput: HTMLInputElement,
  prompt: string,
  caretPosition: number,
) {
  fireEvent.focus(promptInput);
  fireEvent.change(promptInput, { target: { value: prompt } });
  promptInput.setSelectionRange(caretPosition, caretPosition);
  fireEvent.keyUp(promptInput);
}

function createAttachmentMediaValue(
  overrides: Partial<
    Record<AttachmentMediaFieldId, GenerationAttachmentMediaItem[]>
  > = {},
): GenerationAttachmentMediaValue {
  return {
    images: overrides.images ?? [],
    videos: overrides.videos ?? [],
    audios: overrides.audios ?? [],
  };
}

function createAttachmentMediaItem(
  name: string,
  type: string,
): GenerationAttachmentMediaItem {
  return {
    file: new File(["media"], name, { type }),
    role: "reference",
  };
}

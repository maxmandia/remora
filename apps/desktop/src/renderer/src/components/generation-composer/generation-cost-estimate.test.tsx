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
import { GenerationCostEstimate } from "./generation-cost-estimate.tsx";

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

describe("GenerationCostEstimate", () => {
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
    renderCostEstimate({
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
    renderCostEstimateWithPrompt({
      attachmentMediaValue: createAttachmentMediaValue(),
    });

    await waitFor(() => {
      expect(mocks.estimateGenerationCost).toHaveBeenCalledWith(
        createSeedanceEstimateInput(),
      );
    });

    mocks.estimateGenerationCost.mockClear();

    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A glass studio under the ocean" },
    });

    expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
  });

  it("does not request a generation cost estimate until model and settings are selected", async () => {
    renderCostEstimate({
      attachmentMediaValue: createAttachmentMediaValue(),
      generationSettings: null,
      selectedModel: null,
    });

    expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
  });

  it("formats the estimated cost with cents precision", async () => {
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 831_600,
      currencyCode: "USD",
    });

    renderCostEstimate({
      attachmentMediaValue: createAttachmentMediaValue(),
    });

    expect(await screen.findByText("~ $0.83")).toBeTruthy();
  });
});

function renderCostEstimate({
  attachmentMediaValue,
  generationSettings = createGenerationSettings(),
  selectedModel = createModel(),
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  generationSettings?: GenerationSettingsValue | null;
  selectedModel?: PublishedGenerationModelSummary | null;
}) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <GenerationCostEstimate
        attachmentMediaValue={attachmentMediaValue}
        generationSettings={generationSettings}
        selectedModel={selectedModel}
      />
    </QueryClientProvider>,
  );
}

function renderCostEstimateWithPrompt({
  attachmentMediaValue,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
}) {
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <CostEstimateWithPrompt attachmentMediaValue={attachmentMediaValue} />
    </QueryClientProvider>,
  );
}

function CostEstimateWithPrompt({
  attachmentMediaValue,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
}) {
  const [prompt, setPrompt] = useState("");

  return (
    <>
      <input
        aria-label="Prompt"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      <GenerationCostEstimate
        attachmentMediaValue={attachmentMediaValue}
        generationSettings={createGenerationSettings()}
        selectedModel={createModel()}
      />
    </>
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

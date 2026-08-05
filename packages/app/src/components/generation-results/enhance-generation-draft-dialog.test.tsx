/** @vitest-environment jsdom */

import type { VideoGenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EnhanceGenerationDraftDialog } from "./enhance-generation-draft-dialog.tsx";

const mocks = vi.hoisted(() => ({
  quote: vi.fn(),
  quoteQueryOptions: vi.fn(),
  balance: vi.fn(),
  balanceQueryOptions: vi.fn(),
  enhanceDraft: vi.fn(),
  reset: vi.fn(),
  enhancementState: {
    error: null as Error | null,
    isPending: false,
  },
}));

vi.mock("../../trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      getDraftEnhancementQuote: {
        queryOptions: mocks.quoteQueryOptions,
      },
    },
    credits: {
      getBalance: { queryOptions: mocks.balanceQueryOptions },
    },
  }),
}));

vi.mock("../../hooks/use-enhance-generation-draft-mutation.ts", () => ({
  useEnhanceGenerationDraftMutation: () => ({
    enhanceDraft: mocks.enhanceDraft,
    reset: mocks.reset,
    ...mocks.enhancementState,
  }),
}));

describe("EnhanceGenerationDraftDialog", () => {
  beforeEach(() => {
    mocks.quote.mockReset();
    mocks.quoteQueryOptions.mockReset();
    mocks.balance.mockReset();
    mocks.balanceQueryOptions.mockReset();
    mocks.enhanceDraft.mockReset();
    mocks.reset.mockReset();
    mocks.enhancementState.error = null;
    mocks.enhancementState.isPending = false;
    mocks.quoteQueryOptions.mockImplementation((input, options) => ({
      queryKey: ["generation", "getDraftEnhancementQuote", input],
      queryFn: mocks.quote,
      ...options,
    }));
    mocks.balanceQueryOptions.mockImplementation((_input, options) => ({
      queryKey: ["credits", "getBalance"],
      queryFn: mocks.balance,
      ...options,
    }));
  });

  afterEach(() => cleanup());

  it("confirms enhancing every completed draft with the total estimate", async () => {
    const onOpenChange = vi.fn();
    const submission = createDraftSubmission();
    mocks.quote.mockResolvedValue({
      eligibleDraftCount: 2,
      estimatedCostUsdMicros: 580_000,
      currencyCode: "USD",
    });
    mocks.balance.mockResolvedValue({
      availableCreditAmountUsdMicros: 5_000_000,
    });
    mocks.enhanceDraft.mockResolvedValue({
      submissionId: "submission_enhanced",
      threadId: "thread_1",
      jobs: [],
    });

    renderDialog({ onOpenChange, submission });

    expect(
      await screen.findByText(
        "All 2 completed drafts will be rendered at full quality using their original settings. Estimated cost is $0.58.",
      ),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.enhanceDraft).toHaveBeenCalledWith({
        eligibleDraftCount: 2,
        submission,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("uses singular copy and disables confirmation for insufficient credits", async () => {
    mocks.quote.mockResolvedValue({
      eligibleDraftCount: 1,
      estimatedCostUsdMicros: 1_360_000,
      currencyCode: "USD",
    });
    mocks.balance.mockResolvedValue({
      availableCreditAmountUsdMicros: 1_000_000,
    });

    renderDialog({ submission: createDraftSubmission() });

    expect(
      await screen.findByText(
        "This draft will be rendered at full quality using its original settings. Estimated cost is $1.36.",
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        "Your available credit balance is too low for this enhancement.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Enhance" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("quotes and enhances a selected source job", async () => {
    const submission = createDraftSubmission();
    mocks.quote.mockResolvedValue({
      eligibleDraftCount: 1,
      estimatedCostUsdMicros: 290_000,
      currencyCode: "USD",
    });
    mocks.balance.mockResolvedValue({
      availableCreditAmountUsdMicros: 5_000_000,
    });
    mocks.enhanceDraft.mockResolvedValue({
      submissionId: "submission_enhanced",
      threadId: "thread_1",
      jobs: [],
    });

    renderDialog({ sourceJobId: "job_2", submission });

    await screen.findByText(
      "This draft will be rendered at full quality using its original settings. Estimated cost is $0.29.",
    );
    expect(mocks.quoteQueryOptions).toHaveBeenCalledWith(
      { submissionId: "submission_1", sourceJobId: "job_2" },
      { enabled: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Enhance" }));

    await waitFor(() => {
      expect(mocks.enhanceDraft).toHaveBeenCalledWith({
        eligibleDraftCount: 1,
        sourceJobId: "job_2",
        submission,
      });
    });
  });

  it("keeps confirmation disabled when eligibility cannot be confirmed", async () => {
    mocks.quote.mockRejectedValue(new Error("No eligible draft caches"));
    mocks.balance.mockResolvedValue({
      availableCreditAmountUsdMicros: 5_000_000,
    });

    renderDialog({ submission: createDraftSubmission() });

    expect(await screen.findByText("No eligible draft caches")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Enhance" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

function renderDialog({
  onOpenChange = vi.fn(),
  sourceJobId,
  submission,
}: {
  onOpenChange?: (open: boolean) => void;
  sourceJobId?: string;
  submission: VideoGenerationThreadSubmission;
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <EnhanceGenerationDraftDialog
        open
        sourceJobId={sourceJobId}
        submission={submission}
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>,
  );
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
    requestedGenerations: 2,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: [0, 1].map((submissionIndex) => ({
      id: `job_${submissionIndex + 1}`,
      submissionId: "submission_1",
      submissionIndex,
      status: "succeeded" as const,
      providerId: "bfl",
      providerTaskId: `provider_${submissionIndex + 1}`,
      providerModelId: "latest",
      terminalError: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:01:00.000Z",
      result: null,
    })),
  };
}

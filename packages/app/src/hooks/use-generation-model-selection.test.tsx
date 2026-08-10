/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationModelSelection } from "./use-generation-model-selection.ts";

const mocks = vi.hoisted(() => {
  const listPublished = vi.fn();
  const queryOptions = vi.fn(
    (_input: unknown, options?: Record<string, unknown>) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: listPublished,
    }),
  );

  return {
    authStatus: {
      current: "signed-out" as "loading" | "signed-in" | "signed-out",
    },
    listPublished,
    queryOptions,
  };
});

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    error: null,
    requestAuth: vi.fn(),
    signOut: vi.fn(),
    status: mocks.authStatus.current,
    user:
      mocks.authStatus.current === "signed-in"
        ? {
            id: "user_1",
            name: "Remora User",
            email: "user@example.com",
            image: null,
          }
        : null,
  }),
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    model: {
      listPublished: {
        queryOptions: mocks.queryOptions,
      },
    },
  }),
}));

describe("useGenerationModelSelection", () => {
  beforeEach(() => {
    mocks.authStatus.current = "signed-out";
    mocks.listPublished.mockReset();
    mocks.queryOptions.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("loads published models while signed out", async () => {
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    mocks.listPublished.mockResolvedValue([model]);
    const { result } = renderSelection();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(mocks.queryOptions).toHaveBeenCalledWith(undefined, {
      enabled: true,
      staleTime: 5 * 60 * 1000,
    });
    expect(mocks.listPublished).toHaveBeenCalledOnce();
    expect(result.current.models).toEqual([model]);
    expect(result.current.selectedModel).toBe(model);
  });

  it("waits for session resolution before loading published models", async () => {
    mocks.authStatus.current = "loading";
    const { result } = renderSelection();

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(mocks.queryOptions).toHaveBeenCalledWith(undefined, {
      enabled: false,
      staleTime: 5 * 60 * 1000,
    });
    expect(mocks.listPublished).not.toHaveBeenCalled();
  });

  it("loads published models for signed-in users", async () => {
    let resolveModels: (
      models: PublishedGenerationModelSummary[],
    ) => void = () => undefined;
    mocks.authStatus.current = "signed-in";
    mocks.listPublished.mockReturnValue(
      new Promise<PublishedGenerationModelSummary[]>((resolve) => {
        resolveModels = resolve;
      }),
    );

    const { result } = renderSelection();

    expect(result.current.isPending).toBe(true);
    expect(mocks.queryOptions).toHaveBeenCalledWith(undefined, {
      enabled: true,
      staleTime: 5 * 60 * 1000,
    });

    await act(async () => {
      resolveModels([createModel("seedance-2.0-video", "Seedance 2.0")]);
    });

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
      expect(result.current.models).toHaveLength(1);
    });
  });

  it("prefers Seedance 2.0 and falls back to the first published model", async () => {
    const seedanceModel = createModel("seedance-2.0-video", "Seedance 2.0");
    const fluxModel = createModel("flux-3-video", "FLUX 3 Video (Preview)");
    mocks.authStatus.current = "signed-in";
    mocks.listPublished.mockResolvedValue([fluxModel, seedanceModel]);

    const preferredSelection = renderSelection();

    await waitFor(() => {
      expect(preferredSelection.result.current.selectedModel).toBe(
        seedanceModel,
      );
    });

    act(() => {
      preferredSelection.result.current.setSelectedModel(null);
    });

    await waitFor(() => {
      expect(preferredSelection.result.current.selectedModel).toBe(
        seedanceModel,
      );
    });

    preferredSelection.unmount();
    mocks.listPublished.mockResolvedValue([fluxModel]);

    const fallbackSelection = renderSelection();

    await waitFor(() => {
      expect(fallbackSelection.result.current.selectedModel).toBe(fluxModel);
    });
  });

  it("honors an explicit preferred model", async () => {
    const seedanceModel = createModel("seedance-2.0-video", "Seedance 2.0");
    const fluxModel = createModel("flux-3-video", "FLUX 3 Video (Preview)");
    mocks.listPublished.mockResolvedValue([fluxModel, seedanceModel]);

    const { result } = renderSelection("flux-3-video");

    await waitFor(() => {
      expect(result.current.selectedModel).toBe(fluxModel);
    });
  });

  it("exposes failures and retries model loading", async () => {
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    mocks.authStatus.current = "signed-in";
    mocks.listPublished
      .mockRejectedValueOnce(new Error("Models unavailable"))
      .mockResolvedValueOnce([model]);

    const { result } = renderSelection();

    await waitFor(() => {
      expect(result.current.error).toEqual(
        expect.objectContaining({ message: "Models unavailable" }),
      );
    });

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.selectedModel).toBe(model);
    });
    expect(mocks.listPublished).toHaveBeenCalledTimes(2);
  });
});

function renderSelection(preferredModelId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return renderHook(() => useGenerationModelSelection(preferredModelId), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
}

function createModel(
  id: string,
  displayName: string,
): PublishedGenerationModelSummary {
  return {
    id,
    displayName,
  } as PublishedGenerationModelSummary;
}

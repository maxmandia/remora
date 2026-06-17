/** @vitest-environment jsdom */

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

import { BootstrapGate } from "./bootstrap-gate.tsx";

const mocks = vi.hoisted(() => {
  const modelQueryFn = vi.fn();
  const threadQueryFn = vi.fn();
  const modelQueryOptions = vi.fn(
    (input: unknown, opts?: Record<string, unknown>) => ({
      ...(opts ?? {}),
      queryKey: ["model", "listPublished", input],
      queryFn: modelQueryFn,
    }),
  );
  const threadQueryOptions = vi.fn(
    (input?: unknown, opts?: Record<string, unknown>) => ({
      ...(opts ?? {}),
      queryKey: ["generation", "listThreadsWithoutProject", input],
      queryFn: threadQueryFn,
    }),
  );
  const modelQueryFilter = vi.fn(() => ({
    queryKey: ["model", "listPublished"],
  }));
  const threadQueryFilter = vi.fn(() => ({
    queryKey: ["generation", "listThreadsWithoutProject"],
  }));
  const projectQueryFilter = vi.fn(() => ({
    queryKey: ["project", "listProjects"],
  }));

  return {
    authState: {
      current: null as {
        user: { id: string } | null;
        status: "loading" | "signed-in" | "signed-out";
        error: string | null;
        requestAuth: () => Promise<void>;
        signOut: () => Promise<void>;
      } | null,
    },
    modelQueryFn,
    modelQueryOptions,
    modelQueryFilter,
    threadQueryFn,
    threadQueryOptions,
    threadQueryFilter,
    projectQueryFilter,
    signOut: vi.fn(),
    trpc: {
      generation: {
        listThreadsWithoutProject: {
          queryOptions: threadQueryOptions,
          queryFilter: threadQueryFilter,
        },
      },
      model: {
        listPublished: {
          queryOptions: modelQueryOptions,
          queryFilter: modelQueryFilter,
        },
      },
      project: {
        listProjects: {
          queryFilter: projectQueryFilter,
        },
      },
    },
  };
});

vi.mock("./auth-provider.tsx", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("../lib/trpc.ts", () => ({
  useTRPC: () => mocks.trpc,
}));

describe("BootstrapGate", () => {
  beforeEach(() => {
    mocks.modelQueryFn.mockReset();
    mocks.modelQueryFn.mockResolvedValue([]);
    mocks.modelQueryOptions.mockClear();
    mocks.modelQueryFilter.mockClear();
    mocks.threadQueryFn.mockReset();
    mocks.threadQueryFn.mockResolvedValue([]);
    mocks.threadQueryOptions.mockClear();
    mocks.threadQueryFilter.mockClear();
    mocks.projectQueryFilter.mockClear();
    mocks.signOut.mockReset();
    mocks.authState.current = createAuthState("loading");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders children immediately when signed out", () => {
    mocks.authState.current = createAuthState("signed-out");

    renderBootstrapGate();

    expect(screen.getByText("Ready route")).toBeTruthy();
    expect(mocks.modelQueryOptions).not.toHaveBeenCalled();
    expect(mocks.threadQueryOptions).not.toHaveBeenCalled();
    expect(mocks.modelQueryFn).not.toHaveBeenCalled();
    expect(mocks.threadQueryFn).not.toHaveBeenCalled();
  });

  it("waits for models and threads before rendering signed-in children", async () => {
    let resolveModels: () => void = () => undefined;
    let resolveThreads: () => void = () => undefined;
    mocks.modelQueryFn.mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveModels = () => resolve([]);
      }),
    );
    mocks.threadQueryFn.mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveThreads = () => resolve([]);
      }),
    );
    mocks.authState.current = createAuthState("signed-in", {
      id: "user_1",
    });

    const { container } = renderBootstrapGate();

    expect(
      container.querySelector('[data-auth-status="signed-in"]'),
    ).not.toBeNull();
    expect(screen.queryByText("Ready route")).toBeNull();

    await waitFor(() => {
      expect(mocks.modelQueryFn).toHaveBeenCalledTimes(1);
      expect(mocks.threadQueryFn).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveModels();
      await Promise.resolve();
    });

    expect(screen.queryByText("Ready route")).toBeNull();

    await act(async () => {
      resolveThreads();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Ready route")).toBeTruthy();
    });
    expect(mocks.modelQueryOptions).toHaveBeenCalledWith(undefined, {
      staleTime: 5 * 60 * 1000,
    });
    expect(mocks.threadQueryOptions).toHaveBeenCalledWith();
  });

  it("shows retry and sign-out actions when model bootstrap fails", async () => {
    mocks.modelQueryFn.mockRejectedValue(new Error("models unavailable"));
    mocks.authState.current = createAuthState("signed-in", {
      id: "user_1",
    });

    renderBootstrapGate();

    expect(await screen.findByText("Unable to prepare Remora.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("shows retry and sign-out actions when thread bootstrap fails", async () => {
    mocks.threadQueryFn.mockRejectedValue(new Error("threads unavailable"));
    mocks.authState.current = createAuthState("signed-in", {
      id: "user_1",
    });

    renderBootstrapGate();

    expect(await screen.findByText("Unable to prepare Remora.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it("clears model, thread, and project caches when the signed-in user changes", async () => {
    mocks.authState.current = createAuthState("signed-in", {
      id: "user_1",
    });

    const { rerenderBootstrapGate } = renderBootstrapGate();

    await waitFor(() => {
      expect(mocks.modelQueryFilter).toHaveBeenCalledTimes(1);
      expect(mocks.threadQueryFilter).toHaveBeenCalledTimes(1);
      expect(mocks.projectQueryFilter).toHaveBeenCalledTimes(1);
    });

    mocks.authState.current = createAuthState("signed-in", {
      id: "user_2",
    });
    rerenderBootstrapGate();

    await waitFor(() => {
      expect(mocks.modelQueryFilter).toHaveBeenCalledTimes(2);
      expect(mocks.threadQueryFilter).toHaveBeenCalledTimes(2);
      expect(mocks.projectQueryFilter).toHaveBeenCalledTimes(2);
    });
  });
});

function renderBootstrapGate() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderResult = render(createBootstrapGateElement(queryClient));

  return {
    ...renderResult,
    queryClient,
    rerenderBootstrapGate: () => {
      renderResult.rerender(createBootstrapGateElement(queryClient));
    },
  };
}

function createBootstrapGateElement(queryClient: QueryClient) {
  return (
    <QueryClientProvider client={queryClient}>
      <BootstrapGate>
        <div>Ready route</div>
      </BootstrapGate>
    </QueryClientProvider>
  );
}

function createAuthState(
  status: "loading" | "signed-in" | "signed-out",
  user: { id: string } | null = null,
) {
  return {
    user,
    status,
    error: null,
    requestAuth: async () => undefined,
    signOut: mocks.signOut,
  };
}

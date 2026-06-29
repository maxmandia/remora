/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeQueryInvalidationProvider } from "./realtime-query-invalidation-provider.tsx";

import type { RealtimeClientEvent } from "@remora/realtime";
import type { RealtimeConnectionStatus } from "../../../shared/realtime.ts";

const mocks = vi.hoisted(() => ({
  authState: {
    current: {
      status: "signed-in" as "loading" | "signed-in" | "signed-out",
    },
  },
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
  eventListener: null as ((event: RealtimeClientEvent) => void) | null,
  connectionListener: null as
    | ((status: RealtimeConnectionStatus) => void)
    | null,
  balanceQueryFilter: vi.fn(),
  threadQueryKey: vi.fn(),
  threadPathKey: vi.fn(),
}));

vi.mock("../lib/realtime-bridge.ts", () => ({
  realtimeBridge: {
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    onEvent(callback: (event: RealtimeClientEvent) => void) {
      mocks.eventListener = callback;

      return () => {
        mocks.eventListener = null;
      };
    },
    onConnectionChange(
      callback: (status: RealtimeConnectionStatus) => void,
    ) {
      mocks.connectionListener = callback;

      return () => {
        mocks.connectionListener = null;
      };
    },
  },
}));

vi.mock("../lib/trpc.ts", () => ({
  useTRPC: () => ({
    credits: {
      getBalance: {
        queryFilter: mocks.balanceQueryFilter,
      },
    },
    generation: {
      listSubmissionsFromThread: {
        queryKey: mocks.threadQueryKey,
        pathKey: mocks.threadPathKey,
      },
    },
  }),
}));

vi.mock("./auth-provider.tsx", () => ({
  useAuth: () => mocks.authState.current,
}));

describe("RealtimeQueryInvalidationProvider", () => {
  beforeEach(() => {
    mocks.authState.current = { status: "signed-in" };
    mocks.connect.mockClear();
    mocks.disconnect.mockClear();
    mocks.eventListener = null;
    mocks.connectionListener = null;
    mocks.balanceQueryFilter.mockReset();
    mocks.threadQueryKey.mockReset();
    mocks.threadPathKey.mockReset();
    mocks.balanceQueryFilter.mockReturnValue({
      queryKey: ["credits", "getBalance"],
    });
    mocks.threadQueryKey.mockReturnValue([
      ["generation", "listSubmissionsFromThread"],
      {
        input: { threadId: "thread_1" },
        type: "query",
      },
    ]);
    mocks.threadPathKey.mockReturnValue([
      ["generation", "listSubmissionsFromThread"],
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it("connects while signed in and disconnects on unmount", () => {
    const rendered = renderProvider();

    expect(mocks.connect).toHaveBeenCalledTimes(1);

    rendered.unmount();

    expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  });

  it("invalidates the matching thread query for generation success events", () => {
    const { queryClient } = renderProvider();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      mocks.eventListener?.(createGenerationSucceededEvent());
    });

    expect(mocks.threadQueryKey).toHaveBeenCalledWith({
      threadId: "thread_1",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        ["generation", "listSubmissionsFromThread"],
        {
          input: { threadId: "thread_1" },
          type: "query",
        },
      ],
    });
  });

  it("invalidates the credit balance query for balance update events", () => {
    const { queryClient } = renderProvider();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      mocks.eventListener?.(createBalanceUpdatedEvent());
    });

    expect(mocks.balanceQueryFilter).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["credits", "getBalance"],
    });
  });

  it("invalidates the generation thread path after reconnecting", () => {
    const { queryClient } = renderProvider();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      mocks.connectionListener?.("connected");
      mocks.connectionListener?.("disconnected");
      mocks.connectionListener?.("connected");
    });

    expect(mocks.threadPathKey).toHaveBeenCalledTimes(1);
    expect(mocks.balanceQueryFilter).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["generation", "listSubmissionsFromThread"]],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["credits", "getBalance"],
    });
  });
});

function renderProvider() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RealtimeQueryInvalidationProvider>
        <div />
      </RealtimeQueryInvalidationProvider>
    </QueryClientProvider>,
  );

  return {
    ...rendered,
    queryClient,
  };
}

function createGenerationSucceededEvent(): RealtimeClientEvent {
  return {
    id: "generation.job.succeeded:job_1",
    type: "generation.job.succeeded",
    occurredAt: "2026-06-05T00:00:00.000Z",
    payload: {
      jobId: "job_1",
      threadId: "thread_1",
    },
  };
}

function createBalanceUpdatedEvent(): RealtimeClientEvent {
  return {
    id: "credits.balance.updated:event_1",
    type: "credits.balance.updated",
    occurredAt: "2026-06-05T00:00:00.000Z",
    payload: {},
  };
}

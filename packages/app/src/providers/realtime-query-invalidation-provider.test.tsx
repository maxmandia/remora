/** @vitest-environment jsdom */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RealtimeQueryInvalidationProvider } from "./realtime-query-invalidation-provider.tsx";

import type {
  RealtimeClient,
  RealtimeClientEvent,
  RealtimeConnectionStatus,
} from "@remora/realtime";

const mocks = vi.hoisted(() => ({
  balanceQueryFilter: vi.fn(),
  threadQueryKey: vi.fn(),
  threadPathKey: vi.fn(),
  standaloneThreadQueryFilter: vi.fn(),
  projectQueryFilter: vi.fn(),
}));

vi.mock("./trpc-provider.ts", () => ({
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
    generationThread: {
      listWithoutProject: {
        queryFilter: mocks.standaloneThreadQueryFilter,
      },
    },
    project: {
      listProjects: {
        queryFilter: mocks.projectQueryFilter,
      },
    },
  }),
}));

describe("RealtimeQueryInvalidationProvider", () => {
  beforeEach(() => {
    mocks.balanceQueryFilter.mockReset();
    mocks.threadQueryKey.mockReset();
    mocks.threadPathKey.mockReset();
    mocks.standaloneThreadQueryFilter.mockReset();
    mocks.projectQueryFilter.mockReset();
    mocks.balanceQueryFilter.mockReturnValue({
      queryKey: ["credits", "getBalance"],
    });
    mocks.threadQueryKey.mockImplementation(({ threadId }) => [
      ["generation", "listSubmissionsFromThread"],
      {
        input: { threadId },
        type: "query",
      },
    ]);
    mocks.threadPathKey.mockReturnValue([
      ["generation", "listSubmissionsFromThread"],
    ]);
    mocks.standaloneThreadQueryFilter.mockReturnValue({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    mocks.projectQueryFilter.mockReturnValue({
      queryKey: ["project", "listProjects"],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("connects when enabled and disconnects on unmount", () => {
    const client = createRealtimeClient();
    const rendered = renderProvider({ client, enabled: true });

    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.disconnect).not.toHaveBeenCalled();

    rendered.unmount();

    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("stays disconnected when disabled", () => {
    const client = createRealtimeClient();

    renderProvider({ client, enabled: false });

    expect(client.connect).not.toHaveBeenCalled();
    expect(client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("connects and disconnects as enabled changes", () => {
    const client = createRealtimeClient();
    const rendered = renderProvider({ client, enabled: false });

    rendered.rerenderProvider({ client, enabled: true });

    expect(client.connect).toHaveBeenCalledTimes(1);

    rendered.rerenderProvider({ client, enabled: false });

    expect(client.disconnect).toHaveBeenCalled();
  });

  it("replaces subscriptions when the client changes", () => {
    const firstClient = createRealtimeClient();
    const nextClient = createRealtimeClient();
    const rendered = renderProvider({
      client: firstClient,
      enabled: true,
    });

    rendered.rerenderProvider({
      client: nextClient,
      enabled: true,
    });

    expect(firstClient.unsubscribeEvent).toHaveBeenCalledTimes(1);
    expect(firstClient.unsubscribeConnectionChange).toHaveBeenCalledTimes(1);
    expect(firstClient.disconnect).toHaveBeenCalledTimes(1);
    expect(nextClient.onEvent).toHaveBeenCalledTimes(1);
    expect(nextClient.onConnectionChange).toHaveBeenCalledTimes(1);
    expect(nextClient.connect).toHaveBeenCalledTimes(1);
  });

  it("unsubscribes listeners on unmount", () => {
    const client = createRealtimeClient();
    const rendered = renderProvider({ client, enabled: true });

    rendered.unmount();

    expect(client.unsubscribeEvent).toHaveBeenCalledTimes(1);
    expect(client.unsubscribeConnectionChange).toHaveBeenCalledTimes(1);
  });

  it("does not refresh queries for an initial connection", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitConnectionStatus("connected");
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("does not refresh queries when disconnected before initially connecting", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitConnectionStatus("disconnected");
      client.emitConnectionStatus("connected");
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });

  it("invalidates the matching thread query for generation success events", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitEvent(createGenerationSucceededEvent());
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

  it("invalidates the matching thread query for generation failure events", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitEvent(createGenerationFailedEvent());
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
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitEvent(createBalanceUpdatedEvent());
    });

    expect(mocks.balanceQueryFilter).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["credits", "getBalance"],
    });
  });

  it("invalidates standalone and project thread lists for name updates", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitEvent(createGenerationThreadNameUpdatedEvent());
    });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["project", "listProjects"],
    });
  });

  it("refreshes every query family that may have missed reconnect events", () => {
    const client = createRealtimeClient();
    const { queryClient } = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");

    act(() => {
      client.emitConnectionStatus("connected");
      client.emitConnectionStatus("disconnected");
      client.emitConnectionStatus("connected");
    });

    expect(mocks.threadPathKey).toHaveBeenCalledTimes(1);
    expect(mocks.balanceQueryFilter).toHaveBeenCalledTimes(1);
    expect(mocks.standaloneThreadQueryFilter).toHaveBeenCalledTimes(1);
    expect(mocks.projectQueryFilter).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["generation", "listSubmissionsFromThread"]],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["credits", "getBalance"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["generationThread", "listWithoutProject"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["project", "listProjects"],
    });
  });

  it("resets reconnect history after being disabled", () => {
    const client = createRealtimeClient();
    const rendered = renderProvider({ client, enabled: true });
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );

    act(() => {
      client.emitConnectionStatus("connected");
      client.emitConnectionStatus("disconnected");
    });

    rendered.rerenderProvider({ client, enabled: false });
    rendered.rerenderProvider({ client, enabled: true });

    act(() => {
      client.emitConnectionStatus("connected");
    });

    expect(invalidateQueries).not.toHaveBeenCalled();
  });
});

type TestRealtimeClient = RealtimeClient & {
  emitConnectionStatus: (status: RealtimeConnectionStatus) => void;
  emitEvent: (event: RealtimeClientEvent) => void;
  unsubscribeConnectionChange: ReturnType<typeof vi.fn>;
  unsubscribeEvent: ReturnType<typeof vi.fn>;
};

function createRealtimeClient(): TestRealtimeClient {
  let eventListener: ((event: RealtimeClientEvent) => void) | null = null;
  let connectionListener: ((status: RealtimeConnectionStatus) => void) | null =
    null;
  const unsubscribeEvent = vi.fn(() => {
    eventListener = null;
  });
  const unsubscribeConnectionChange = vi.fn(() => {
    connectionListener = null;
  });

  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    emitConnectionStatus(status) {
      connectionListener?.(status);
    },
    emitEvent(event) {
      eventListener?.(event);
    },
    onConnectionChange: vi.fn((callback) => {
      connectionListener = callback;
      return unsubscribeConnectionChange;
    }),
    onEvent: vi.fn((callback) => {
      eventListener = callback;
      return unsubscribeEvent;
    }),
    unsubscribeConnectionChange,
    unsubscribeEvent,
  };
}

function renderProvider({
  client,
  enabled,
}: {
  client: RealtimeClient;
  enabled: boolean;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const rendered = render(createProviderTree({ client, enabled, queryClient }));

  return {
    ...rendered,
    queryClient,
    rerenderProvider: ({
      client: nextClient,
      enabled: nextEnabled,
    }: {
      client: RealtimeClient;
      enabled: boolean;
    }) => {
      rendered.rerender(
        createProviderTree({
          client: nextClient,
          enabled: nextEnabled,
          queryClient,
        }),
      );
    },
  };
}

function createProviderTree({
  client,
  enabled,
  queryClient = new QueryClient(),
}: {
  client: RealtimeClient;
  enabled: boolean;
  queryClient?: QueryClient;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeQueryInvalidationProvider client={client} enabled={enabled}>
        <div />
      </RealtimeQueryInvalidationProvider>
    </QueryClientProvider>
  );
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

function createGenerationFailedEvent(): RealtimeClientEvent {
  return {
    id: "generation.job.failed:job_1",
    type: "generation.job.failed",
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

function createGenerationThreadNameUpdatedEvent(): RealtimeClientEvent {
  return {
    id: "generation.thread.name.updated:thread_1",
    type: "generation.thread.name.updated",
    occurredAt: "2026-06-05T00:00:00.000Z",
    payload: { threadId: "thread_1" },
  };
}

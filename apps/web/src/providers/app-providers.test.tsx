/** @vitest-environment jsdom */

import { useAuth } from "@remora/app/auth";
import { useHotkey } from "@remora/app/hotkeys";
import { useTRPCClient } from "@remora/app/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { realtimeClient } from "../clients/realtime";
import { trpcClient } from "../clients/trpc";
import { AppProviders } from "./app-providers";

const mocks = vi.hoisted(() => ({
  realtimeConnect: vi.fn(async () => undefined),
  realtimeDisconnect: vi.fn(async () => undefined),
  useSession: vi.fn(),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    admin: {
      stopImpersonating: vi.fn(),
    },
    signOut: vi.fn(),
    useSession: mocks.useSession,
  },
}));

vi.mock("../clients/realtime", () => ({
  realtimeClient: {
    connect: mocks.realtimeConnect,
    disconnect: mocks.realtimeDisconnect,
    onConnectionChange: vi.fn(() => () => undefined),
    onEvent: vi.fn(() => () => undefined),
  },
}));

describe("AppProviders", () => {
  beforeEach(() => {
    mocks.realtimeConnect.mockClear();
    mocks.realtimeDisconnect.mockClear();
    mocks.useSession.mockReset();
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Remora User",
          email: "user@example.test",
          image: null,
          role: "user",
        },
        session: {
          impersonatedBy: null,
        },
      },
      error: null,
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("provides product hotkeys to app route descendants", () => {
    const onKeyDown = vi.fn();

    render(
      <AppProviders>
        <HotkeyProbe onKeyDown={onKeyDown} />
      </AppProviders>,
    );

    fireEvent.keyDown(document, {
      key: "b",
      metaKey: true,
    });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it("provides the shared query client configuration to app route descendants", () => {
    render(
      <AppProviders>
        <QueryClientProbe />
      </AppProviders>,
    );

    const queryClientProbe = screen.getByTestId("query-client");

    expect(queryClientProbe.getAttribute("data-refetch-on-window-focus")).toBe(
      "false",
    );
    expect(queryClientProbe.getAttribute("data-retry")).toBe("1");
  });

  it("provides the browser tRPC client to app route descendants", () => {
    render(
      <AppProviders>
        <TRPCClientProbe />
      </AppProviders>,
    );

    expect(screen.getByTestId("trpc-client").getAttribute("data-matches")).toBe(
      "true",
    );
  });

  it("provides the browser session through the shared auth context", () => {
    render(
      <AppProviders>
        <AuthProbe />
      </AppProviders>,
    );

    const probe = screen.getByTestId("auth");

    expect(probe.getAttribute("data-status")).toBe("signed-in");
    expect(probe.getAttribute("data-user-id")).toBe("user_1");
  });

  it("connects the browser realtime client for signed-in sessions", () => {
    render(
      <AppProviders>
        <div />
      </AppProviders>,
    );

    expect(realtimeClient.connect).toHaveBeenCalledTimes(1);
  });

  it("keeps the browser realtime client disconnected without a session", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
    });

    render(
      <AppProviders>
        <div />
      </AppProviders>,
    );

    expect(realtimeClient.connect).not.toHaveBeenCalled();
    expect(realtimeClient.disconnect).toHaveBeenCalledTimes(1);
  });
});

function AuthProbe() {
  const { status, user } = useAuth();

  return (
    <output data-status={status} data-user-id={user?.id} data-testid="auth" />
  );
}

function HotkeyProbe({ onKeyDown }: { onKeyDown: () => void }) {
  useHotkey("app.toggleSidebar", {
    onKeyDown,
  });

  return null;
}

function QueryClientProbe() {
  const queryOptions = useQueryClient().getDefaultOptions().queries;

  return (
    <output
      data-refetch-on-window-focus={String(queryOptions?.refetchOnWindowFocus)}
      data-retry={String(queryOptions?.retry)}
      data-testid="query-client"
    />
  );
}

function TRPCClientProbe() {
  const providedTrpcClient = useTRPCClient();

  return (
    <output
      data-matches={String(providedTrpcClient === trpcClient)}
      data-testid="trpc-client"
    />
  );
}

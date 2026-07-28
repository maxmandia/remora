/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { realtimeBridge } from "../lib/realtime-bridge.ts";
import { RealtimeQueryInvalidationProvider } from "./realtime-query-invalidation-provider.tsx";

const mocks = vi.hoisted(() => ({
  authStatus: {
    current: "loading" as "loading" | "signed-in" | "signed-out",
  },
  identity: {
    impersonatedBy: null as string | null,
    user: null as { id: string } | null,
  },
  sharedProvider: vi.fn(({ children }) => children),
}));

vi.mock("@remora/app/realtime", () => ({
  RealtimeQueryInvalidationProvider: mocks.sharedProvider,
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    impersonatedBy: mocks.identity.impersonatedBy,
    status: mocks.authStatus.current,
    user: mocks.identity.user,
  }),
}));

describe("desktop RealtimeQueryInvalidationProvider", () => {
  beforeEach(() => {
    mocks.authStatus.current = "loading";
    mocks.identity.impersonatedBy = null;
    mocks.identity.user = null;
    mocks.sharedProvider.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    ["loading", false],
    ["signed-out", false],
    ["signed-in", true],
  ] as const)("maps %s auth status to enabled=%s", (status, enabled) => {
    mocks.authStatus.current = status;

    render(
      <RealtimeQueryInvalidationProvider>
        <div />
      </RealtimeQueryInvalidationProvider>,
    );

    expect(mocks.sharedProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        client: realtimeBridge,
        enabled,
      }),
      undefined,
    );
  });

  it("forwards the effective identity key", () => {
    mocks.authStatus.current = "signed-in";
    mocks.identity.user = { id: "user_1" };
    mocks.identity.impersonatedBy = "admin_1";

    render(
      <RealtimeQueryInvalidationProvider>
        <div />
      </RealtimeQueryInvalidationProvider>,
    );

    expect(mocks.sharedProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        identityKey: "user_1:admin_1",
      }),
      undefined,
    );
  });
});

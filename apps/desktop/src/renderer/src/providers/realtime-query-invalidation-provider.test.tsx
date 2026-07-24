/** @vitest-environment jsdom */

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { realtimeBridge } from "../lib/realtime-bridge.ts";
import { RealtimeQueryInvalidationProvider } from "./realtime-query-invalidation-provider.tsx";

const mocks = vi.hoisted(() => ({
  authStatus: {
    current: "loading" as "loading" | "signed-in" | "signed-out",
  },
  sharedProvider: vi.fn(({ children }) => children),
}));

vi.mock("@remora/app/realtime", () => ({
  RealtimeQueryInvalidationProvider: mocks.sharedProvider,
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    status: mocks.authStatus.current,
  }),
}));

describe("desktop RealtimeQueryInvalidationProvider", () => {
  beforeEach(() => {
    mocks.authStatus.current = "loading";
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
});

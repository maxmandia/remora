import { describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setUser: vi.fn(),
  withScope: vi.fn((callback) =>
    callback({
      setContext: vi.fn(),
      setTag: vi.fn(),
    }),
  ),
}));

vi.mock("@sentry/electron/main", () => sentryMocks);

describe("main observability", () => {
  it("captures and rethrows rejected IPC handler errors", async () => {
    const { setDesktopSentryForTest, wrapIpcHandler } =
      await import("./observability.ts");
    const error = new Error("IPC failed");

    setDesktopSentryForTest(sentryMocks as never);

    const handler = wrapIpcHandler("remora:test", async () => {
      throw error;
    });

    await expect(handler()).rejects.toBe(error);

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
  });
});

import { describe, expect, it, vi } from "vitest";

const sentryMocks = {
  captureException: vi.fn(),
  isInitialized: vi.fn(() => true),
  withScope: vi.fn((callback) =>
    callback({
      setContext: vi.fn(),
      setTag: vi.fn(),
    }),
  ),
};
const sentryStub = {
  addBreadcrumb: vi.fn(),
  captureException: sentryMocks.captureException,
  init: vi.fn(),
  isInitialized: sentryMocks.isInitialized,
  setUser: vi.fn(),
  withScope: sentryMocks.withScope,
};

describe("main observability", () => {
  it("captures and rethrows rejected IPC handler errors", async () => {
    const { setDesktopSentryForTest, wrapIpcHandler } =
      await import("./observability.ts");
    const error = new Error("IPC failed");

    setDesktopSentryForTest(sentryStub as never);

    const handler = wrapIpcHandler("remora:test", async () => {
      throw error;
    });

    await expect(handler()).rejects.toBe(error);

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
  });
});

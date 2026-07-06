import { afterEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
}));

vi.mock("@sentry/electron/renderer", () => sentryMocks);

describe("desktop renderer observability", () => {
  afterEach(() => {
    sentryMocks.init.mockClear();
    vi.unstubAllGlobals();
  });

  it("does not initialize Sentry when desktop Sentry is disabled", async () => {
    vi.stubGlobal("__REMORA_DESKTOP_SENTRY_ENABLED__", false);

    const { initializeDesktopRendererObservability } = await import(
      "./renderer-observability.ts"
    );

    initializeDesktopRendererObservability();

    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it("initializes Sentry with the shared renderer settings", async () => {
    vi.stubGlobal("__REMORA_DESKTOP_SENTRY_ENABLED__", true);

    const { initializeDesktopRendererObservability } = await import(
      "./renderer-observability.ts"
    );

    initializeDesktopRendererObservability();

    expect(sentryMocks.init).toHaveBeenCalledWith({
      sendDefaultPii: false,
    });
  });
});

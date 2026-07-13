import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mixpanelMocks = vi.hoisted(() => ({
  identify: vi.fn(),
  init: vi.fn(),
  opt_in_tracking: vi.fn(),
  people: { set: vi.fn() },
  reset: vi.fn(),
  track: vi.fn(),
}));

vi.mock("mixpanel-browser/src/loaders/loader-module-core", () => ({
  default: mixpanelMocks,
}));

describe("renderer analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    mixpanelMocks.init.mockReset();
    vi.restoreAllMocks();
  });

  it("does nothing when analytics is disabled", async () => {
    const { initializeRendererAnalytics } = await import("./analytics.ts");

    initializeRendererAnalytics(null);

    expect(mixpanelMocks.init).not.toHaveBeenCalled();
  });

  it("initializes the core loader with the exact privacy-safe config", async () => {
    const { initializeRendererAnalytics } = await import("./analytics.ts");

    initializeRendererAnalytics("project-token");

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
    expect(mixpanelMocks.init).toHaveBeenCalledWith("project-token", {
      api_host: "https://api-js.mixpanel.com",
      autocapture: false,
      opt_out_tracking_by_default: false,
      persistence: "localStorage",
      record_sessions_percent: 0,
      track_pageview: false,
    });
    expect(mixpanelMocks.track).not.toHaveBeenCalled();
    expect(mixpanelMocks.identify).not.toHaveBeenCalled();
    expect(mixpanelMocks.reset).not.toHaveBeenCalled();
    expect(mixpanelMocks.opt_in_tracking).not.toHaveBeenCalled();
    expect(mixpanelMocks.people.set).not.toHaveBeenCalled();
  });

  it("initializes at most once", async () => {
    const { initializeRendererAnalytics } = await import("./analytics.ts");

    initializeRendererAnalytics("project-token");
    initializeRendererAnalytics("project-token");

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
  });

  it("contains initialization failures", async () => {
    const error = new Error("Mixpanel failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mixpanelMocks.init.mockImplementation(() => {
      throw error;
    });
    const { initializeRendererAnalytics } = await import("./analytics.ts");

    expect(() => initializeRendererAnalytics("project-token")).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Renderer analytics initialization failed",
      error,
    );
  });

  it("identifies before tracking typed authenticated desktop sessions", async () => {
    const {
      identifyAnalyticsUser,
      initializeRendererAnalytics,
      resetAnalyticsUser,
      trackDesktopSessionStarted,
    } = await import("./analytics.ts");
    initializeRendererAnalytics("project-token");

    expect(identifyAnalyticsUser("user_1")).toBe(true);
    trackDesktopSessionStarted({
      appVersion: "0.2.0",
      releaseChannel: "nightly",
      platform: "darwin",
      architecture: "arm64",
    });
    resetAnalyticsUser();

    expect(mixpanelMocks.identify).toHaveBeenCalledWith("user_1");
    expect(mixpanelMocks.track).toHaveBeenCalledWith(
      "desktop_session_started",
      {
        event_version: 1,
        app_version: "0.2.0",
        release_channel: "nightly",
        platform: "darwin",
        architecture: "arm64",
      },
    );
    expect(mixpanelMocks.reset).toHaveBeenCalledOnce();
    expect(mixpanelMocks.people.set).not.toHaveBeenCalled();
  });

  it("does not identify or track authenticated sessions when disabled", async () => {
    const {
      identifyAnalyticsUser,
      initializeRendererAnalytics,
      trackDesktopSessionStarted,
    } = await import("./analytics.ts");
    initializeRendererAnalytics(null);

    expect(identifyAnalyticsUser("user_1")).toBe(false);
    trackDesktopSessionStarted({
      appVersion: "0.2.0",
      releaseChannel: "local",
      platform: "darwin",
      architecture: "arm64",
    });

    expect(mixpanelMocks.identify).not.toHaveBeenCalled();
    expect(mixpanelMocks.track).not.toHaveBeenCalled();
  });

  it("contains identity, delivery, and reset failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const identifyError = new Error("identify failed");
    const trackError = new Error("track failed");
    const resetError = new Error("reset failed");
    mixpanelMocks.identify.mockImplementation(() => {
      throw identifyError;
    });
    mixpanelMocks.track.mockImplementation(() => {
      throw trackError;
    });
    mixpanelMocks.reset.mockImplementation(() => {
      throw resetError;
    });
    const {
      identifyAnalyticsUser,
      initializeRendererAnalytics,
      resetAnalyticsUser,
      trackDesktopSessionStarted,
    } = await import("./analytics.ts");
    initializeRendererAnalytics("project-token");

    expect(identifyAnalyticsUser("user_1")).toBe(false);
    expect(() =>
      trackDesktopSessionStarted({
        appVersion: "0.2.0",
        releaseChannel: "stable",
        platform: "darwin",
        architecture: "arm64",
      }),
    ).not.toThrow();
    expect(() => resetAnalyticsUser()).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(
      "Renderer analytics identification failed",
      identifyError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Renderer analytics delivery failed",
      trackError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Renderer analytics reset failed",
      resetError,
    );
  });
});

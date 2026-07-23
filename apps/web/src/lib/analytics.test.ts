/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mixpanelMocks = vi.hoisted(() => ({
  init: vi.fn(),
  start_session_recording: vi.fn(),
  stop_session_recording: vi.fn(),
  track_pageview: vi.fn(),
}));

vi.mock("mixpanel-browser", () => ({
  default: mixpanelMocks,
}));

const publicHome = {
  href: "/?utm_source=google&utm_medium=cpc",
  pathname: "/",
  search: "?utm_source=google&utm_medium=cpc",
};

describe("web analytics", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("normalizes optional client configuration", async () => {
    const { getWebAnalyticsToken } = await import("./analytics");

    expect(getWebAnalyticsToken({})).toBeNull();
    expect(
      getWebAnalyticsToken({
        VITE_MIXPANEL_PROJECT_TOKEN: "  project-token  ",
      }),
    ).toBe("project-token");
  });

  it.each([
    ["/", "", true],
    ["/pricing", "", true],
    ["/models/model-name", "", true],
    ["/missing", "", true],
    ["/sign-in", "", false],
    ["/sign-in/", "", false],
    ["/sign-up", "", false],
    ["/", "?credit_checkout=success", false],
    ["/", "?checkout_session_id=cs_123", false],
    ["/", "?utm_source=google&checkout_session_id=", false],
  ])(
    "classifies %s%s replay eligibility",
    async (pathname, search, expected) => {
      const { isWebReplayEligibleLocation } = await import("./analytics");

      expect(isWebReplayEligibleLocation({ pathname, search })).toBe(expected);
    },
  );

  it("stays disabled without a project token", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await syncWebAnalyticsLocation(publicHome, null);

    expect(mixpanelMocks.init).not.toHaveBeenCalled();
    expect(mixpanelMocks.start_session_recording).not.toHaveBeenCalled();
    expect(mixpanelMocks.track_pageview).not.toHaveBeenCalled();
  });

  it("does not initialize on a direct restricted visit", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await syncWebAnalyticsLocation(
      {
        href: "/sign-in",
        pathname: "/sign-in",
        search: "",
      },
      "project-token",
    );

    expect(mixpanelMocks.init).not.toHaveBeenCalled();
    expect(mixpanelMocks.stop_session_recording).not.toHaveBeenCalled();
  });

  it("does not initialize when navigation becomes restricted during loading", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    const publicSync = syncWebAnalyticsLocation(publicHome, "project-token");
    const restrictedSync = syncWebAnalyticsLocation(
      {
        href: "/sign-in",
        pathname: "/sign-in",
        search: "",
      },
      "project-token",
    );

    await Promise.all([publicSync, restrictedSync]);

    expect(mixpanelMocks.init).not.toHaveBeenCalled();
    expect(mixpanelMocks.start_session_recording).not.toHaveBeenCalled();
    expect(mixpanelMocks.track_pageview).not.toHaveBeenCalled();
  });

  it("initializes 100% replay and privacy-safe Autocapture exactly once", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await syncWebAnalyticsLocation(publicHome, "project-token");
    await syncWebAnalyticsLocation(publicHome, "project-token");

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
    expect(mixpanelMocks.init).toHaveBeenCalledWith("project-token", {
      api_host: "https://api-js.mixpanel.com",
      autocapture: {
        block_selectors: [".mp-no-track"],
        block_url_regexes: [
          /\/sign-in(?:[/?#]|$)/,
          /\/sign-up(?:[/?#]|$)/,
          /[?&](?:credit_checkout|checkout_session_id)(?:=|&|#|$)/,
        ],
        capture_text_content: false,
        click: true,
        dead_click: true,
        input: true,
        pageview: false,
        rage_click: true,
        scroll: true,
        submit: true,
      },
      opt_out_tracking_by_default: false,
      persistence: "localStorage",
      record_block_selector: ".mp-block",
      record_console: false,
      record_mask_all_inputs: true,
      record_mask_all_text: false,
      record_network: false,
      record_sessions_percent: 100,
      stop_utm_persistence: true,
      track_pageview: false,
    });
    expect(mixpanelMocks.start_session_recording).toHaveBeenCalledOnce();
    expect(mixpanelMocks.track_pageview).toHaveBeenCalledOnce();
    expect(mixpanelMocks.track_pageview).toHaveBeenCalledWith({
      surface: "web",
    });
  });

  it("tracks public SPA navigation without restarting the replay", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await syncWebAnalyticsLocation(publicHome, "project-token");
    await syncWebAnalyticsLocation(
      {
        href: "/pricing",
        pathname: "/pricing",
        search: "",
      },
      "project-token",
    );

    expect(mixpanelMocks.start_session_recording).toHaveBeenCalledOnce();
    expect(mixpanelMocks.track_pageview).toHaveBeenCalledTimes(2);
  });

  it("stops on restricted routes and starts a new replay on return", async () => {
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await syncWebAnalyticsLocation(publicHome, "project-token");
    await syncWebAnalyticsLocation(
      {
        href: "/sign-up",
        pathname: "/sign-up",
        search: "",
      },
      "project-token",
    );
    await syncWebAnalyticsLocation(publicHome, "project-token");

    expect(mixpanelMocks.init).toHaveBeenCalledOnce();
    expect(mixpanelMocks.stop_session_recording).toHaveBeenCalledOnce();
    expect(mixpanelMocks.start_session_recording).toHaveBeenCalledTimes(2);
    expect(mixpanelMocks.track_pageview).toHaveBeenCalledTimes(2);
  });

  it("contains initialization and replay delivery failures", async () => {
    const initializationError = new Error("init failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mixpanelMocks.init.mockImplementation(() => {
      throw initializationError;
    });
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await expect(
      syncWebAnalyticsLocation(publicHome, "project-token"),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Web analytics initialization failed",
      initializationError,
    );
    expect(mixpanelMocks.start_session_recording).not.toHaveBeenCalled();
    expect(mixpanelMocks.track_pageview).not.toHaveBeenCalled();
  });

  it("contains page-view and stop failures", async () => {
    const pageViewError = new Error("page view failed");
    const stopError = new Error("stop failed");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mixpanelMocks.track_pageview.mockImplementation(() => {
      throw pageViewError;
    });
    mixpanelMocks.stop_session_recording.mockImplementation(() => {
      throw stopError;
    });
    const { syncWebAnalyticsLocation } = await import("./analytics");

    await expect(
      syncWebAnalyticsLocation(publicHome, "project-token"),
    ).resolves.toBeUndefined();
    await expect(
      syncWebAnalyticsLocation(
        {
          href: "/?credit_checkout=success",
          pathname: "/",
          search: "?credit_checkout=success",
        },
        "project-token",
      ),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith(
      "Web analytics page view delivery failed",
      pageViewError,
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Web session replay stop failed",
      stopError,
    );
  });
});

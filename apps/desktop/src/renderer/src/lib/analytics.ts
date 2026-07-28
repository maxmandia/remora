import mixpanel from "mixpanel-browser";

declare const __REMORA_MIXPANEL_PROJECT_TOKEN__: string | null | undefined;
declare const __REMORA_DESKTOP_ANALYTICS_CONTEXT__:
  | DesktopAnalyticsContext
  | undefined;

type DesktopAnalyticsContext = {
  appVersion: string;
  releaseChannel: "local" | "nightly" | "stable";
  platform: string;
  architecture: string;
};

const mixpanelConfig = {
  api_host: "https://api-js.mixpanel.com",
  autocapture: false,
  opt_out_tracking_by_default: false,
  persistence: "localStorage",
  record_block_selector: "",
  record_mask_all_text: false,
  record_sessions_percent: 0,
  track_pageview: false,
} as const;

let initialized = false;
let enabled = false;
let optedOut = false;
let recording = false;

export function initializeRendererAnalytics(
  token = typeof __REMORA_MIXPANEL_PROJECT_TOKEN__ === "undefined"
    ? null
    : __REMORA_MIXPANEL_PROJECT_TOKEN__,
): void {
  if (initialized) {
    return;
  }

  initialized = true;

  if (!token) {
    return;
  }

  try {
    mixpanel.init(token, mixpanelConfig);
    enabled = true;
  } catch (error) {
    reportAnalyticsError("Renderer analytics initialization failed", error);
  }
}

export function identifyAnalyticsUser(userId: string): boolean {
  if (!enabled || optedOut) {
    return false;
  }

  try {
    mixpanel.identify(userId);
    return true;
  } catch (error) {
    reportAnalyticsError("Renderer analytics identification failed", error);
    return false;
  }
}

export function resetAnalyticsUser(): void {
  if (!enabled) {
    return;
  }

  try {
    mixpanel.reset();
  } catch (error) {
    reportAnalyticsError("Renderer analytics reset failed", error);
  }
}

export function suppressRendererAnalytics(): void {
  if (!enabled || optedOut) {
    return;
  }

  if (recording) {
    recording = false;

    try {
      mixpanel.stop_session_recording();
    } catch (error) {
      reportAnalyticsError("Renderer analytics replay stop failed", error);
    }
  }

  optedOut = true;

  try {
    mixpanel.opt_out_tracking({
      delete_user: false,
    });
  } catch (error) {
    reportAnalyticsError("Renderer analytics suppression failed", error);
  }
}

export function resumeRendererAnalytics(): void {
  if (!enabled || !optedOut) {
    return;
  }

  try {
    mixpanel.opt_in_tracking();
    optedOut = false;
  } catch (error) {
    reportAnalyticsError("Renderer analytics resume failed", error);
  }
}

export function trackDesktopSessionStarted(
  context = typeof __REMORA_DESKTOP_ANALYTICS_CONTEXT__ === "undefined"
    ? null
    : __REMORA_DESKTOP_ANALYTICS_CONTEXT__,
): void {
  if (!enabled || optedOut || !context) {
    return;
  }

  try {
    if (!recording) {
      mixpanel.start_session_recording();
      recording = true;
    }

    mixpanel.track("desktop_session_started", {
      event_version: 1,
      app_version: context.appVersion,
      release_channel: context.releaseChannel,
      platform: context.platform,
      architecture: context.architecture,
    });
  } catch (error) {
    reportAnalyticsError("Renderer analytics delivery failed", error);
  }
}

function reportAnalyticsError(message: string, error: unknown): void {
  try {
    console.error(message, error);
  } catch {
    // Analytics must never interrupt renderer startup or product workflows.
  }
}

import type { Config, Mixpanel } from "mixpanel-browser";

export type WebAnalyticsLocation = {
  href: string;
  pathname: string;
  search: string;
};

export type WebAnalyticsAuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | {
      status: "signed-in";
      userId: string;
      impersonatedBy: string | null;
    };

export type GuestGenerationAnalyticsEvent =
  | {
      type: "guest_generation_workspace_viewed";
    }
  | {
      type: "guest_generation_preview_submitted";
      attachmentCount: number;
      modelType: "image" | "video" | "model3d";
    };

type WebAnalyticsEnv = {
  VITE_MIXPANEL_PROJECT_TOKEN?: string;
};

const guestGenerationFunnelVersion = "guest_generation_v1";
const restrictedAutocaptureUrlRegexes = [
  /\/sign-in(?:[/?#]|$)/,
  /\/sign-up(?:[/?#]|$)/,
  /[?&](?:credit_checkout|checkout_session_id)(?:=|&|#|$)/,
];

const mixpanelConfig = {
  api_host: "https://api-js.mixpanel.com",
  autocapture: {
    block_selectors: [".mp-no-track"],
    block_url_regexes: restrictedAutocaptureUrlRegexes,
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
} satisfies Partial<Config>;

let client: Mixpanel | null = null;
let initialization: Promise<void> | null = null;
let enabled = false;
let recording = false;
let lastPageViewHref: string | null = null;
let syncVersion = 0;
let latestLocationEligible = false;
let identifiedUserId: string | null = null;
let permission: "pending" | "enabled" | "suppressed" = "pending";
let permissionWaiters: Array<() => void> = [];
let optedOut = false;

export function getWebAnalyticsToken(
  env: WebAnalyticsEnv = {
    VITE_MIXPANEL_PROJECT_TOKEN: import.meta.env.VITE_MIXPANEL_PROJECT_TOKEN,
  },
): string | null {
  const token = env.VITE_MIXPANEL_PROJECT_TOKEN?.trim();

  return token || null;
}

export function isWebReplayEligibleLocation({
  pathname,
  search,
}: Pick<WebAnalyticsLocation, "pathname" | "search">): boolean {
  if (/^\/sign-(?:in|up)\/?$/.test(pathname)) {
    return false;
  }

  if (pathname !== "/") {
    return true;
  }

  const searchParams = new URLSearchParams(search);

  return (
    !searchParams.has("credit_checkout") &&
    !searchParams.has("checkout_session_id")
  );
}

export async function syncWebAnalyticsLocation(
  location: WebAnalyticsLocation,
  token = getWebAnalyticsToken(),
): Promise<void> {
  const version = ++syncVersion;
  latestLocationEligible = isWebReplayEligibleLocation(location);

  if (!latestLocationEligible) {
    stopWebReplay();
    lastPageViewHref = null;
    return;
  }

  if (!(await waitForAnalyticsPermission())) {
    return;
  }

  await initializeWebAnalytics(token);

  if (version !== syncVersion || !enabled || !client) {
    return;
  }

  startWebReplay();

  if (lastPageViewHref === location.href) {
    return;
  }

  try {
    client.track_pageview({
      surface: "web",
    });
    lastPageViewHref = location.href;
  } catch (error) {
    reportAnalyticsError("Web analytics page view delivery failed", error);
  }
}

export async function trackGuestGenerationAnalyticsEvent(
  event: GuestGenerationAnalyticsEvent,
  token = getWebAnalyticsToken(),
): Promise<void> {
  if (!(await waitForAnalyticsPermission())) {
    return;
  }

  await initializeWebAnalytics(token, true);

  if (!enabled || !client) {
    return;
  }

  try {
    switch (event.type) {
      case "guest_generation_workspace_viewed":
        client.track(event.type, {
          funnel_version: guestGenerationFunnelVersion,
          surface: "web",
        });
        return;
      case "guest_generation_preview_submitted":
        client.track(event.type, {
          attachment_count: event.attachmentCount,
          funnel_version: guestGenerationFunnelVersion,
          model_type: event.modelType,
          surface: "web",
        });
        return;
    }
  } catch (error) {
    reportAnalyticsError("Web analytics delivery failed", error);
  }
}

export async function identifyWebAnalyticsUser(
  userId: string,
  token = getWebAnalyticsToken(),
): Promise<void> {
  if (!(await waitForAnalyticsPermission())) {
    return;
  }

  await initializeWebAnalytics(token, true);

  if (!enabled || !client || identifiedUserId === userId) {
    return;
  }

  try {
    client.identify(userId);
    identifiedUserId = userId;
  } catch (error) {
    reportAnalyticsError("Web analytics identification failed", error);
  }
}

export async function linkGuestGenerationAnalyticsUser(
  userId: string,
  token = getWebAnalyticsToken(),
): Promise<void> {
  if (!(await waitForAnalyticsPermission())) {
    return;
  }

  await initializeWebAnalytics(token, true);

  if (!enabled || !client || identifiedUserId === userId) {
    return;
  }

  try {
    if (client.get_distinct_id() !== userId) {
      client.alias(userId);
    }
  } catch (error) {
    reportAnalyticsError("Web analytics alias failed", error);
  }

  await identifyWebAnalyticsUser(userId, token);
}

export function resetWebAnalyticsUser(): void {
  if (permission !== "enabled" || !enabled || !client || !identifiedUserId) {
    return;
  }

  try {
    client.reset();
    identifiedUserId = null;
  } catch (error) {
    reportAnalyticsError("Web analytics reset failed", error);
  }
}

export async function syncWebAnalyticsAuthState(
  authState: WebAnalyticsAuthState,
  location: WebAnalyticsLocation,
  token = getWebAnalyticsToken(),
): Promise<boolean> {
  if (authState.status === "loading") {
    return false;
  }

  if (authState.status === "signed-in" && authState.impersonatedBy !== null) {
    suppressWebAnalytics();
    return false;
  }

  enableWebAnalytics();

  if (authState.status === "signed-in") {
    await identifyWebAnalyticsUser(authState.userId, token);
  } else {
    resetWebAnalyticsUser();
  }

  await syncWebAnalyticsLocation(location, token);
  return permission === "enabled";
}

export function suppressWebAnalytics(): void {
  if (permission === "suppressed") {
    return;
  }

  permission = "suppressed";
  syncVersion += 1;
  resolvePermissionWaiters();
  stopWebReplay();
  lastPageViewHref = null;
  identifiedUserId = null;

  if (!enabled || !client || optedOut) {
    return;
  }

  optedOut = true;

  try {
    client.opt_out_tracking({
      delete_user: false,
    });
  } catch (error) {
    reportAnalyticsError("Web analytics suppression failed", error);
  }
}

function initializeWebAnalytics(
  token: string | null,
  allowRestrictedLocation = false,
): Promise<void> {
  if (permission !== "enabled") {
    return Promise.resolve();
  }

  if (enabled) {
    return Promise.resolve();
  }

  if (initialization) {
    return initialization.then(() => {
      if (!enabled && allowRestrictedLocation) {
        return initializeWebAnalytics(token, true);
      }
    });
  }

  if (!token) {
    return Promise.resolve();
  }

  const operation = import("mixpanel-browser")
    .then(({ default: mixpanel }) => {
      if (!allowRestrictedLocation && !latestLocationEligible) {
        return;
      }

      mixpanel.init(token, mixpanelConfig);
      client = mixpanel;
      enabled = true;
    })
    .catch((error: unknown) => {
      reportAnalyticsError("Web analytics initialization failed", error);
    })
    .finally(() => {
      if (initialization === operation) {
        initialization = null;
      }
    });

  initialization = operation;
  return operation;
}

function enableWebAnalytics(): void {
  const wasSuppressed = permission === "suppressed";
  permission = "enabled";
  resolvePermissionWaiters();

  if (!wasSuppressed || !enabled || !client || !optedOut) {
    return;
  }

  try {
    client.opt_in_tracking();
    optedOut = false;
  } catch (error) {
    reportAnalyticsError("Web analytics resume failed", error);
  }
}

function waitForAnalyticsPermission(): Promise<boolean> {
  if (permission !== "pending") {
    return Promise.resolve(permission === "enabled");
  }

  return new Promise((resolve) => {
    permissionWaiters.push(() => resolve(permission === "enabled"));
  });
}

function resolvePermissionWaiters(): void {
  const waiters = permissionWaiters;
  permissionWaiters = [];

  for (const resolve of waiters) {
    resolve();
  }
}

function startWebReplay(): void {
  if (!enabled || !client || recording) {
    return;
  }

  try {
    client.start_session_recording();
    recording = true;
  } catch (error) {
    reportAnalyticsError("Web session replay start failed", error);
  }
}

function stopWebReplay(): void {
  if (!enabled || !client || !recording) {
    return;
  }

  recording = false;

  try {
    client.stop_session_recording();
  } catch (error) {
    reportAnalyticsError("Web session replay stop failed", error);
  }
}

function reportAnalyticsError(message: string, error: unknown): void {
  try {
    console.error(message, error);
  } catch {
    // Analytics must never interrupt navigation or application workflows.
  }
}

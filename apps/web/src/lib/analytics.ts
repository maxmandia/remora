import type { Config, Mixpanel } from "mixpanel-browser";

export type WebAnalyticsLocation = {
  href: string;
  pathname: string;
  search: string;
};

type WebAnalyticsEnv = {
  VITE_MIXPANEL_PROJECT_TOKEN?: string;
};

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

function initializeWebAnalytics(token: string | null): Promise<void> {
  if (initialization) {
    return initialization;
  }

  if (!token) {
    initialization = Promise.resolve();
    return initialization;
  }

  initialization = import("mixpanel-browser")
    .then(({ default: mixpanel }) => {
      if (!latestLocationEligible) {
        initialization = null;
        return;
      }

      mixpanel.init(token, mixpanelConfig);
      client = mixpanel;
      enabled = true;
    })
    .catch((error: unknown) => {
      reportAnalyticsError("Web analytics initialization failed", error);
    });

  return initialization;
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

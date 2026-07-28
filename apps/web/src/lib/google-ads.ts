const googleAdsTagIdPattern = /^AW-\d+$/;
const googleAdsConversionLabelPattern = /^[A-Za-z0-9_-]+$/;
const googleAdsHandoffTimeoutMs = 1_000;
const googleAdsScriptLoadTimeoutMs = 3_000;

export type GoogleAdsConfig = {
  tagId: string;
  purchaseLabel: string;
};

export type GoogleAdsPurchase = {
  transactionId: string;
  value: number;
  currency: "USD";
};

type GoogleTag = (...args: unknown[]) => void;
type GoogleAdsEnv = {
  VITE_GOOGLE_ADS_TAG_ID?: string;
  VITE_GOOGLE_ADS_PURCHASE_LABEL?: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: GoogleTag;
  }
}

let initializedTagId: string | null = null;
let tagLoadState: GoogleAdsTagLoadState | null = null;
let tagLoadPromise: Promise<GoogleAdsTagLoadState> | null = null;
let deliveryPermission: "pending" | "enabled" | "suppressed" = "pending";
let deliveryPermissionWaiters: Array<(enabled: boolean) => void> = [];

export type GoogleAdsTagLoadState =
  | "loading"
  | "loaded"
  | "blocked"
  | "timed_out";

export type GoogleAdsPurchaseHandoffResult =
  | { status: "delivered" }
  | { status: "event_timed_out" }
  | { status: "failed" }
  | { status: "not_configured" }
  | { status: "suppressed" }
  | { status: "tag_blocked" }
  | { status: "tag_load_timed_out" };

export function getGoogleAdsConfig(
  env: GoogleAdsEnv = {
    VITE_GOOGLE_ADS_TAG_ID: import.meta.env.VITE_GOOGLE_ADS_TAG_ID,
    VITE_GOOGLE_ADS_PURCHASE_LABEL: import.meta.env
      .VITE_GOOGLE_ADS_PURCHASE_LABEL,
  },
): GoogleAdsConfig | null {
  const tagId = env.VITE_GOOGLE_ADS_TAG_ID?.trim() ?? "";
  const purchaseLabel = env.VITE_GOOGLE_ADS_PURCHASE_LABEL?.trim() ?? "";

  if (!tagId && !purchaseLabel) {
    return null;
  }

  if (!googleAdsTagIdPattern.test(tagId)) {
    throw new Error(
      "VITE_GOOGLE_ADS_TAG_ID must use the Google Ads AW-123456789 format.",
    );
  }

  if (!googleAdsConversionLabelPattern.test(purchaseLabel)) {
    throw new Error(
      "VITE_GOOGLE_ADS_PURCHASE_LABEL must be a Google Ads conversion label.",
    );
  }

  return { tagId, purchaseLabel };
}

export function initializeGoogleAds(
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
): Promise<GoogleAdsTagLoadState | null> {
  if (
    deliveryPermission !== "enabled" ||
    !config ||
    typeof window === "undefined" ||
    typeof document === "undefined"
  ) {
    return Promise.resolve(null);
  }

  if (initializedTagId === config.tagId && tagLoadPromise) {
    return tagLoadPromise;
  }

  initializedTagId = config.tagId;
  tagLoadState = "loading";
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", config.tagId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.tagId}`;
  script.dataset.remoraGoogleAdsTag = config.tagId;

  tagLoadPromise = new Promise<GoogleAdsTagLoadState>((resolve) => {
    let settled = false;
    const complete = (state: GoogleAdsTagLoadState) => {
      tagLoadState = state;

      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeoutId);
      resolve(state);
    };
    const timeoutId = window.setTimeout(
      () => complete("timed_out"),
      googleAdsScriptLoadTimeoutMs,
    );

    script.addEventListener("load", () => complete("loaded"), {
      once: true,
    });
    script.addEventListener("error", () => complete("blocked"), {
      once: true,
    });

    try {
      document.head.append(script);
    } catch {
      complete("blocked");
    }
  });

  return tagLoadPromise;
}

export async function trackGoogleAdsPurchase(
  purchase: GoogleAdsPurchase,
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
): Promise<GoogleAdsPurchaseHandoffResult> {
  if (!(await waitForGoogleAdsDeliveryPermission())) {
    return { status: "suppressed" };
  }

  if (!config || typeof window === "undefined") {
    return { status: "not_configured" };
  }

  const loadState = await initializeGoogleAds(config);

  if (loadState === "blocked") {
    return { status: "tag_blocked" };
  }

  if (loadState === "timed_out") {
    return { status: "tag_load_timed_out" };
  }

  if (loadState !== "loaded" || !window.gtag) {
    return { status: "failed" };
  }

  return new Promise<GoogleAdsPurchaseHandoffResult>((resolve) => {
    let completed = false;
    const complete = (result: GoogleAdsPurchaseHandoffResult) => {
      if (completed) {
        return;
      }

      completed = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    const timeoutId = window.setTimeout(
      () => complete({ status: "event_timed_out" }),
      googleAdsHandoffTimeoutMs,
    );

    try {
      window.gtag?.("event", "conversion", {
        send_to: `${config.tagId}/${config.purchaseLabel}`,
        value: purchase.value,
        currency: purchase.currency,
        transaction_id: purchase.transactionId,
        event_callback: () => complete({ status: "delivered" }),
        event_timeout: googleAdsHandoffTimeoutMs,
      });
    } catch {
      complete({ status: "failed" });
    }
  });
}

export function getGoogleAdsTagLoadState(): GoogleAdsTagLoadState | null {
  return tagLoadState;
}

export function setGoogleAdsDeliveryAllowed(allowed: boolean): void {
  deliveryPermission = allowed ? "enabled" : "suppressed";
  const waiters = deliveryPermissionWaiters;
  deliveryPermissionWaiters = [];

  for (const resolve of waiters) {
    resolve(allowed);
  }
}

function waitForGoogleAdsDeliveryPermission(): Promise<boolean> {
  if (deliveryPermission !== "pending") {
    return Promise.resolve(deliveryPermission === "enabled");
  }

  return new Promise((resolve) => {
    deliveryPermissionWaiters.push(resolve);
  });
}

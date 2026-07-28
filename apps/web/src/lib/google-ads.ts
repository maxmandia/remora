const googleAdsTagIdPattern = /^AW-\d+$/;
const googleAdsConversionLabelPattern = /^[A-Za-z0-9_-]+$/;
const googleAdsHandoffTimeoutMs = 1_000;

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
let deliveryPermission: "pending" | "enabled" | "suppressed" = "pending";
let deliveryPermissionWaiters: Array<(enabled: boolean) => void> = [];

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
): void {
  if (
    deliveryPermission !== "enabled" ||
    !config ||
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    initializedTagId === config.tagId
  ) {
    return;
  }

  initializedTagId = config.tagId;
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", config.tagId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.tagId}`;
  document.head.append(script);
}

export async function trackGoogleAdsPurchase(
  purchase: GoogleAdsPurchase,
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
): Promise<void> {
  if (!(await waitForGoogleAdsDeliveryPermission())) {
    return;
  }

  if (!config || typeof window === "undefined" || !window.gtag) {
    initializeGoogleAds(config);
  }

  if (!config || typeof window === "undefined" || !window.gtag) {
    return;
  }

  return new Promise<void>((resolve) => {
    let completed = false;
    const complete = () => {
      if (completed) {
        return;
      }

      completed = true;
      window.clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = window.setTimeout(complete, googleAdsHandoffTimeoutMs);

    try {
      window.gtag?.("event", "conversion", {
        send_to: `${config.tagId}/${config.purchaseLabel}`,
        value: purchase.value,
        currency: purchase.currency,
        transaction_id: purchase.transactionId,
        event_callback: complete,
        event_timeout: googleAdsHandoffTimeoutMs,
      });
    } catch {
      complete();
    }
  });
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

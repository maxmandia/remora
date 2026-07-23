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

export function getGoogleAdsHeadScripts(
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
) {
  if (!config) {
    return [];
  }

  return [
    {
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${config.tagId}`,
    },
    {
      children: [
        "window.dataLayer = window.dataLayer || [];",
        "function gtag(){dataLayer.push(arguments);}",
        "gtag('js', new Date());",
        `gtag('config', '${config.tagId}');`,
      ].join("\n"),
    },
  ];
}

export function trackGoogleAdsPurchase(
  purchase: GoogleAdsPurchase,
  config: GoogleAdsConfig | null = getGoogleAdsConfig(),
) {
  if (!config || typeof window === "undefined" || !window.gtag) {
    return Promise.resolve();
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

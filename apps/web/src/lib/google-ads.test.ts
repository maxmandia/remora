/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGoogleAdsConfig,
  getGoogleAdsHeadScripts,
  trackGoogleAdsPurchase,
} from "./google-ads";

describe("Google Ads", () => {
  afterEach(() => {
    vi.useRealTimers();
    delete window.gtag;
  });

  it("stays disabled without configuration", () => {
    expect(getGoogleAdsConfig({})).toBeNull();
    expect(getGoogleAdsHeadScripts(null)).toEqual([]);
  });

  it("requires complete valid configuration", () => {
    expect(() =>
      getGoogleAdsConfig({
        VITE_GOOGLE_ADS_TAG_ID: "AW-18343287981",
      }),
    ).toThrow("VITE_GOOGLE_ADS_PURCHASE_LABEL");
    expect(() =>
      getGoogleAdsConfig({
        VITE_GOOGLE_ADS_TAG_ID: "G-123",
        VITE_GOOGLE_ADS_PURCHASE_LABEL: "purchase_label",
      }),
    ).toThrow("VITE_GOOGLE_ADS_TAG_ID");
  });

  it("builds the global tag scripts", () => {
    const scripts = getGoogleAdsHeadScripts({
      tagId: "AW-18343287981",
      purchaseLabel: "purchase_label",
    });

    expect(scripts).toEqual([
      {
        async: true,
        src: "https://www.googletagmanager.com/gtag/js?id=AW-18343287981",
      },
      {
        children: expect.stringContaining("gtag('config', 'AW-18343287981');"),
      },
    ]);
  });

  it("sends verified purchase values and waits for Google's callback", async () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    const tracking = trackGoogleAdsPurchase(
      {
        transactionId: "pi_123",
        value: 25,
        currency: "USD",
      },
      {
        tagId: "AW-18343287981",
        purchaseLabel: "purchase_label",
      },
    );

    expect(gtag).toHaveBeenCalledWith("event", "conversion", {
      send_to: "AW-18343287981/purchase_label",
      value: 25,
      currency: "USD",
      transaction_id: "pi_123",
      event_callback: expect.any(Function),
      event_timeout: 1_000,
    });

    const event = gtag.mock.calls[0]?.[2] as {
      event_callback: () => void;
    };
    event.event_callback();

    await expect(tracking).resolves.toBeUndefined();
  });

  it("releases the handoff when Google does not call back", async () => {
    vi.useFakeTimers();
    window.gtag = vi.fn();

    const tracking = trackGoogleAdsPurchase(
      {
        transactionId: "pi_123",
        value: 25,
        currency: "USD",
      },
      {
        tagId: "AW-18343287981",
        purchaseLabel: "purchase_label",
      },
    );

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(tracking).resolves.toBeUndefined();
  });
});

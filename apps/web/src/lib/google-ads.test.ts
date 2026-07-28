/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const config = {
  tagId: "AW-18343287981",
  purchaseLabel: "purchase_label",
};
const purchase = {
  transactionId: "pi_123",
  value: 25,
  currency: "USD" as const,
};

describe("Google Ads", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
    document
      .querySelectorAll("script[data-remora-google-ads-tag]")
      .forEach((script) => script.remove());
    delete window.gtag;
    delete window.dataLayer;
  });

  it("stays disabled without configuration", async () => {
    const { getGoogleAdsConfig } = await import("./google-ads");

    expect(getGoogleAdsConfig({})).toBeNull();
  });

  it("requires complete valid configuration", async () => {
    const { getGoogleAdsConfig } = await import("./google-ads");

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

  it("sends verified values and confirms only Google's callback", async () => {
    const {
      getGoogleAdsTagLoadState,
      setGoogleAdsDeliveryAllowed,
      trackGoogleAdsPurchase,
    } = await import("./google-ads");
    const gtag = vi.fn();
    window.gtag = gtag;
    setGoogleAdsDeliveryAllowed(true);

    const tracking = trackGoogleAdsPurchase(purchase, config);
    await Promise.resolve();
    expect(getGoogleAdsTagLoadState()).toBe("loading");

    getGoogleTagScript().dispatchEvent(new Event("load"));
    await vi.waitFor(() => {
      expect(gtag).toHaveBeenCalledWith(
        "event",
        "conversion",
        expect.any(Object),
      );
    });
    expect(getGoogleAdsTagLoadState()).toBe("loaded");

    const eventCall = gtag.mock.calls.find(
      ([command, eventName]) =>
        command === "event" && eventName === "conversion",
    );
    const event = eventCall?.[2] as {
      event_callback: () => void;
    };
    expect(event).toEqual({
      send_to: "AW-18343287981/purchase_label",
      value: 25,
      currency: "USD",
      transaction_id: "pi_123",
      event_callback: expect.any(Function),
      event_timeout: 1_000,
    });

    event.event_callback();
    await expect(tracking).resolves.toEqual({ status: "delivered" });
  });

  it("returns an event timeout instead of claiming queued delivery", async () => {
    vi.useFakeTimers();
    const { setGoogleAdsDeliveryAllowed, trackGoogleAdsPurchase } =
      await import("./google-ads");
    window.gtag = vi.fn();
    setGoogleAdsDeliveryAllowed(true);

    const tracking = trackGoogleAdsPurchase(purchase, config);
    await Promise.resolve();
    getGoogleTagScript().dispatchEvent(new Event("load"));
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(tracking).resolves.toEqual({
      status: "event_timed_out",
    });
  });

  it("reports blocked scripts", async () => {
    const {
      getGoogleAdsTagLoadState,
      setGoogleAdsDeliveryAllowed,
      trackGoogleAdsPurchase,
    } = await import("./google-ads");
    setGoogleAdsDeliveryAllowed(true);

    const tracking = trackGoogleAdsPurchase(purchase, config);
    await Promise.resolve();
    getGoogleTagScript().dispatchEvent(new Event("error"));

    await expect(tracking).resolves.toEqual({ status: "tag_blocked" });
    expect(getGoogleAdsTagLoadState()).toBe("blocked");
  });

  it("reports script load timeouts", async () => {
    vi.useFakeTimers();
    const {
      getGoogleAdsTagLoadState,
      setGoogleAdsDeliveryAllowed,
      trackGoogleAdsPurchase,
    } = await import("./google-ads");
    setGoogleAdsDeliveryAllowed(true);

    const tracking = trackGoogleAdsPurchase(purchase, config);
    await vi.advanceTimersByTimeAsync(3_000);

    await expect(tracking).resolves.toEqual({
      status: "tag_load_timed_out",
    });
    expect(getGoogleAdsTagLoadState()).toBe("timed_out");
  });

  it("does not initialize or deliver while analytics is suppressed", async () => {
    const { setGoogleAdsDeliveryAllowed, trackGoogleAdsPurchase } =
      await import("./google-ads");
    const gtag = vi.fn();
    window.gtag = gtag;
    setGoogleAdsDeliveryAllowed(false);

    await expect(trackGoogleAdsPurchase(purchase, config)).resolves.toEqual({
      status: "suppressed",
    });
    expect(gtag).not.toHaveBeenCalled();
    expect(
      document.querySelector("script[data-remora-google-ads-tag]"),
    ).toBeNull();
  });
});

function getGoogleTagScript(): HTMLScriptElement {
  const script = document.querySelector<HTMLScriptElement>(
    "script[data-remora-google-ads-tag]",
  );

  if (!script) {
    throw new Error("Google Ads script was not inserted");
  }

  return script;
}

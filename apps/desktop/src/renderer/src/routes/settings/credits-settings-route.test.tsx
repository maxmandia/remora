import { describe, expect, it, vi } from "vitest";

import { createDesktopCreditsSettingsCheckoutAdapter } from "./credits-settings-route.tsx";

describe("desktop credits settings checkout adapter", () => {
  it("forwards a desktop loopback return URL", async () => {
    const desktopReturnUrl =
      "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678";
    const adapter = createDesktopCreditsSettingsCheckoutAdapter({
      createCheckoutReturnUrl: vi.fn().mockResolvedValue(desktopReturnUrl),
    });

    await expect(adapter.getReturnInput()).resolves.toEqual({
      desktopReturnUrl,
    });
  });

  it("preserves the packaged desktop fallback when no loopback is available", async () => {
    const adapter = createDesktopCreditsSettingsCheckoutAdapter({
      createCheckoutReturnUrl: vi.fn().mockResolvedValue(null),
    });

    await expect(adapter.getReturnInput()).resolves.toBeUndefined();
  });

  it("opens checkout through the desktop host", () => {
    const openCheckout = vi.fn();
    const adapter = createDesktopCreditsSettingsCheckoutAdapter({
      openCheckout,
    });

    adapter.openCheckout("https://checkout.stripe.test/session_1");

    expect(openCheckout).toHaveBeenCalledWith(
      "https://checkout.stripe.test/session_1",
    );
  });
});

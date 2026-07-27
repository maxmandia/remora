import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutSearch,
  parseCreditCheckoutStatus,
  parseStripeCheckoutSessionId,
} from "./credit-checkout-redirect";

describe("credit checkout redirect helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses supported checkout return statuses", () => {
    expect(parseCreditCheckoutStatus("success")).toBe("success");
    expect(parseCreditCheckoutStatus("cancel")).toBe("cancel");
  });

  it("rejects unsupported checkout return statuses", () => {
    expect(parseCreditCheckoutStatus("failed")).toBeNull();
    expect(parseCreditCheckoutStatus("")).toBeNull();
    expect(parseCreditCheckoutStatus(null)).toBeNull();
  });

  it("keeps only valid checkout return search parameters", () => {
    expect(
      parseCreditCheckoutSearch({
        checkout_session_id: "cs_live_123",
        credit_checkout: "success",
        unrelated: "value",
      }),
    ).toEqual({
      checkout_session_id: "cs_live_123",
      credit_checkout: "success",
    });
    expect(
      parseCreditCheckoutSearch({
        checkout_session_id: "cs_live_123",
        credit_checkout: "cancel",
      }),
    ).toEqual({
      credit_checkout: "cancel",
    });
    expect(
      parseCreditCheckoutSearch({
        checkout_session_id: "cs_live_123",
      }),
    ).toEqual({});
    expect(
      parseCreditCheckoutSearch({
        checkout_session_id: "pi_123",
        credit_checkout: "failed",
      }),
    ).toEqual({});
  });

  it("parses Stripe checkout session IDs", () => {
    expect(parseStripeCheckoutSessionId("cs_live_123")).toBe("cs_live_123");
    expect(parseStripeCheckoutSessionId("pi_123")).toBeNull();
    expect(parseStripeCheckoutSessionId("")).toBeNull();
    expect(parseStripeCheckoutSessionId(null)).toBeNull();
  });

  it("builds Electron checkout return URLs", () => {
    expect(
      createDesktopCreditCheckoutUrl({
        protocolScheme: "app.remora.desktop",
        status: "success",
      }),
    ).toBe("app.remora.desktop://app/settings/credits?credit_checkout=success");
  });

  it("uses the configured default desktop protocol scheme", () => {
    vi.stubEnv("VITE_DESKTOP_PROTOCOL_SCHEME", "app.remora.desktop.nightly");

    expect(createDesktopCreditCheckoutUrl({ status: "success" })).toBe(
      "app.remora.desktop.nightly://app/settings/credits?credit_checkout=success",
    );
  });

  it("requires a default desktop protocol scheme", () => {
    vi.stubEnv("VITE_DESKTOP_PROTOCOL_SCHEME", "");

    expect(() => createDesktopCreditCheckoutUrl({ status: "success" })).toThrow(
      "VITE_DESKTOP_PROTOCOL_SCHEME is required.",
    );
  });
});

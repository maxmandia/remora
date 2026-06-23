import { describe, expect, it } from "vitest";

import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutStatus,
} from "./credit-checkout-redirect";

describe("credit checkout redirect helpers", () => {
  it("parses supported checkout return statuses", () => {
    expect(parseCreditCheckoutStatus("success")).toBe("success");
    expect(parseCreditCheckoutStatus("cancel")).toBe("cancel");
  });

  it("rejects unsupported checkout return statuses", () => {
    expect(parseCreditCheckoutStatus("failed")).toBeNull();
    expect(parseCreditCheckoutStatus("")).toBeNull();
    expect(parseCreditCheckoutStatus(null)).toBeNull();
  });

  it("builds Electron checkout return URLs", () => {
    expect(
      createDesktopCreditCheckoutUrl({
        protocolScheme: "app.remora.desktop",
        status: "success",
      }),
    ).toBe("app.remora.desktop://app/settings/credits?credit_checkout=success");
  });
});

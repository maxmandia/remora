/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCheckoutConversion: vi.fn(),
  getGoogleAdsConfig: vi.fn(),
  invalidateQueries: vi.fn(),
  trackGoogleAdsPurchase: vi.fn(),
}));

vi.mock("@remora/app/credits", () => ({
  CreditsSettingsPage: () => <div>Credits settings</div>,
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    creditAutoTopUpSettings: {
      getSettings: {
        queryFilter: () => ({
          queryKey: ["creditAutoTopUpSettings", "getSettings"],
        }),
      },
    },
    credits: {
      getBalance: {
        queryFilter: () => ({ queryKey: ["credits", "getBalance"] }),
      },
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("../clients/trpc", () => ({
  trpcClient: {
    credits: {
      getCheckoutConversion: {
        query: mocks.getCheckoutConversion,
      },
    },
  },
}));

vi.mock("../lib/google-ads", () => ({
  getGoogleAdsConfig: mocks.getGoogleAdsConfig,
  trackGoogleAdsPurchase: mocks.trackGoogleAdsPurchase,
}));

import {
  createWebCreditsSettingsCheckoutAdapter,
  WebCreditsSettingsRoute,
} from "./web-credits-settings-route";

describe("web credits settings route", () => {
  beforeEach(() => {
    mocks.getCheckoutConversion.mockReset();
    mocks.getCheckoutConversion.mockResolvedValue({
      currency: "USD",
      transactionId: "cs_live_123",
      value: 25,
    });
    mocks.getGoogleAdsConfig.mockReset();
    mocks.getGoogleAdsConfig.mockReturnValue({
      purchaseLabel: "purchase-label",
      tagId: "AW-123",
    });
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.trackGoogleAdsPurchase.mockReset();
    mocks.trackGoogleAdsPurchase.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("configures new-tab checkout with the trusted web return target", async () => {
    const openCheckout = vi
      .spyOn(window, "open")
      .mockImplementation(() => null);
    const adapter = createWebCreditsSettingsCheckoutAdapter();

    await expect(adapter.getReturnInput()).resolves.toEqual({
      checkoutReturnTarget: "web",
    });

    adapter.openCheckout("https://checkout.stripe.test/session_1");

    expect(openCheckout).toHaveBeenCalledWith(
      "https://checkout.stripe.test/session_1",
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("refreshes credit state and tracks verified successful checkouts", async () => {
    const onCheckoutReturnHandled = vi.fn();

    render(
      <WebCreditsSettingsRoute
        checkoutSearch={{
          checkout_session_id: "cs_live_123",
          credit_checkout: "success",
        }}
        onCheckoutReturnHandled={onCheckoutReturnHandled}
      />,
    );

    await waitFor(() => {
      expect(onCheckoutReturnHandled).toHaveBeenCalledTimes(1);
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["credits", "getBalance"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["creditAutoTopUpSettings", "getSettings"],
    });
    expect(mocks.getCheckoutConversion).toHaveBeenCalledWith(
      { stripeCheckoutSessionId: "cs_live_123" },
      { signal: expect.any(AbortSignal) },
    );
    expect(mocks.trackGoogleAdsPurchase).toHaveBeenCalledWith(
      {
        currency: "USD",
        transactionId: "cs_live_123",
        value: 25,
      },
      {
        purchaseLabel: "purchase-label",
        tagId: "AW-123",
      },
    );
  });

  it("refreshes canceled checkouts without tracking a conversion", async () => {
    const onCheckoutReturnHandled = vi.fn();

    render(
      <WebCreditsSettingsRoute
        checkoutSearch={{ credit_checkout: "cancel" }}
        onCheckoutReturnHandled={onCheckoutReturnHandled}
      />,
    );

    await waitFor(() => {
      expect(onCheckoutReturnHandled).toHaveBeenCalledTimes(1);
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(mocks.getCheckoutConversion).not.toHaveBeenCalled();
    expect(mocks.trackGoogleAdsPurchase).not.toHaveBeenCalled();
  });

  it("ignores visits without a valid checkout return", async () => {
    const onCheckoutReturnHandled = vi.fn();

    render(
      <WebCreditsSettingsRoute
        checkoutSearch={{}}
        onCheckoutReturnHandled={onCheckoutReturnHandled}
      />,
    );

    await Promise.resolve();

    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
    expect(onCheckoutReturnHandled).not.toHaveBeenCalled();
  });
});

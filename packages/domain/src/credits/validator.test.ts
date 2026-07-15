import { describe, expect, it } from "vitest";

import {
  createCreditCheckoutSessionInputSchema,
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
  updateCreditAutoTopUpSettingsInputSchema,
} from "./validator.ts";

describe("credits domain validator", () => {
  const desktopReturnUrl =
    "http://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678";

  it("accepts purchase amounts in cents within the supported range", () => {
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: minCreditPurchaseAmountCents,
      }),
    ).toEqual({
      amountCents: minCreditPurchaseAmountCents,
    });
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: maxCreditPurchaseAmountCents,
      }),
    ).toEqual({
      amountCents: maxCreditPurchaseAmountCents,
    });
  });

  it("accepts disabled auto-reload settings", () => {
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: minCreditPurchaseAmountCents,
        autoReload: {
          enabled: false,
        },
      }),
    ).toEqual({
      amountCents: minCreditPurchaseAmountCents,
      autoReload: {
        enabled: false,
      },
    });
  });

  it("accepts one-time loopback checkout return URLs", () => {
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: minCreditPurchaseAmountCents,
        desktopReturnUrl,
      }),
    ).toEqual({
      amountCents: minCreditPurchaseAmountCents,
      desktopReturnUrl,
    });
  });

  it("rejects unsafe desktop checkout return URLs", () => {
    for (const value of [
      "https://127.0.0.1:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
      "http://localhost:49152/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
      "http://127.0.0.1:49152/callbacks/checkout/short",
      `${desktopReturnUrl}?next=https://example.test`,
      `${desktopReturnUrl}#fragment`,
      "http://127.0.0.1:65536/callbacks/checkout/abcdefghijklmnopqrstuvwxyzABCDEFGH_12345678",
    ]) {
      expect(
        createCreditCheckoutSessionInputSchema.safeParse({
          amountCents: minCreditPurchaseAmountCents,
          desktopReturnUrl: value,
        }).success,
      ).toBe(false);
    }
  });

  it("accepts enabled auto-reload settings", () => {
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: minCreditPurchaseAmountCents,
        autoReload: {
          enabled: true,
          minimumBalanceCents: 1,
        },
      }),
    ).toEqual({
      amountCents: minCreditPurchaseAmountCents,
      autoReload: {
        enabled: true,
        minimumBalanceCents: 1,
      },
    });
    expect(
      createCreditCheckoutSessionInputSchema.parse({
        amountCents: maxCreditPurchaseAmountCents,
        autoReload: {
          enabled: true,
          minimumBalanceCents: maxCreditPurchaseAmountCents,
        },
      }),
    ).toEqual({
      amountCents: maxCreditPurchaseAmountCents,
      autoReload: {
        enabled: true,
        minimumBalanceCents: maxCreditPurchaseAmountCents,
      },
    });
  });

  it("rejects invalid purchase amounts", () => {
    for (const amountCents of [
      0,
      minCreditPurchaseAmountCents - 1,
      100.5,
      maxCreditPurchaseAmountCents + 1,
    ]) {
      expect(
        createCreditCheckoutSessionInputSchema.safeParse({ amountCents })
          .success,
      ).toBe(false);
    }
  });

  it("rejects invalid auto-reload minimum balances", () => {
    for (const minimumBalanceCents of [
      0,
      100.5,
      maxCreditPurchaseAmountCents + 1,
    ]) {
      expect(
        createCreditCheckoutSessionInputSchema.safeParse({
          amountCents: minCreditPurchaseAmountCents,
          autoReload: {
            enabled: true,
            minimumBalanceCents,
          },
        }).success,
      ).toBe(false);
    }
  });

  it("accepts enabled auto top-up settings updates", () => {
    expect(
      updateCreditAutoTopUpSettingsInputSchema.parse({
        enabled: true,
        topUpFloorCents: 500,
        topUpAmountCents: minCreditPurchaseAmountCents,
      }),
    ).toEqual({
      enabled: true,
      topUpFloorCents: 500,
      topUpAmountCents: minCreditPurchaseAmountCents,
    });
  });

  it("accepts disabled auto top-up settings updates", () => {
    expect(
      updateCreditAutoTopUpSettingsInputSchema.parse({
        enabled: false,
      }),
    ).toEqual({
      enabled: false,
    });
  });

  it("rejects invalid auto top-up settings updates", () => {
    for (const input of [
      {
        enabled: true,
        topUpFloorCents: 0,
        topUpAmountCents: minCreditPurchaseAmountCents,
      },
      {
        enabled: true,
        topUpFloorCents: 100.5,
        topUpAmountCents: minCreditPurchaseAmountCents,
      },
      {
        enabled: true,
        topUpFloorCents: maxCreditPurchaseAmountCents + 1,
        topUpAmountCents: minCreditPurchaseAmountCents,
      },
      {
        enabled: true,
        topUpFloorCents: 500,
        topUpAmountCents: minCreditPurchaseAmountCents - 1,
      },
      {
        enabled: true,
        topUpFloorCents: 500,
        topUpAmountCents: maxCreditPurchaseAmountCents + 1,
      },
    ]) {
      expect(
        updateCreditAutoTopUpSettingsInputSchema.safeParse(input).success,
      ).toBe(false);
    }
  });
});

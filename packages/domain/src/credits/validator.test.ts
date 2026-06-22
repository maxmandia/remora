import { describe, expect, it } from "vitest";

import {
  createCreditCheckoutSessionInputSchema,
  maxCreditPurchaseAmountCents,
  minCreditPurchaseAmountCents,
} from "./validator.ts";

describe("credits domain validator", () => {
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
});

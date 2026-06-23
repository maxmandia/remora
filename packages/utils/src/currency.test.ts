import { describe, expect, it } from "vitest";

import { formatCurrencyAmount, getCurrencyAmountCents } from "./currency.ts";

describe("currency utilities", () => {
  it.each([
    ["12.34", 1234],
    ["12", 1200],
    ["12.", 1200],
    [" 12.34 ", 1234],
  ])("parses %s into cents", (value, amountCents) => {
    expect(getCurrencyAmountCents(value)).toBe(amountCents);
  });

  it.each(["", "abc", "0", "0.00", "-1", "12.345"])(
    "returns null for invalid amount %s",
    (value) => {
      expect(getCurrencyAmountCents(value)).toBeNull();
    },
  );

  it.each([
    [0, "$0"],
    [2500, "$25"],
    [1234, "$12.34"],
  ])("formats %i cents as %s", (amountCents, expected) => {
    expect(formatCurrencyAmount(amountCents)).toBe(expected);
  });
});

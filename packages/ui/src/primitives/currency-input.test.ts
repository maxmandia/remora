import { describe, expect, it } from "vitest";

import { resolveCurrencyInputValue } from "./currency-input.tsx";

describe("resolveCurrencyInputValue", () => {
  it.each(["", "0", "12", "12.", "12.0", "12.34"])(
    "accepts %j",
    (nextValue) => {
      expect(resolveCurrencyInputValue("5", nextValue)).toBe(nextValue);
    },
  );

  it.each([".", "12.0.1", "12.345", "abc", "$12", "1,000", "-1"])(
    "rejects %j",
    (nextValue) => {
      expect(resolveCurrencyInputValue("12", nextValue)).toBe("12");
    },
  );
});

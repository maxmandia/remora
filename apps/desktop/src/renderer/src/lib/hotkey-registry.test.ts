import { describe, expect, it } from "vitest";

import { defineHotkeys } from "./hotkey-registry.ts";

describe("defineHotkeys", () => {
  it("rejects duplicate combos unless every definition opts into sharing", () => {
    expect(() =>
      defineHotkeys([
        {
          id: "test.first",
          combo: "A",
        },
        {
          id: "test.second",
          combo: "A",
        },
      ] as const),
    ).toThrow('Hotkey combo "A" is already registered for "test.first".');

    expect(() =>
      defineHotkeys([
        {
          allowSharedCombo: true,
          id: "test.first",
          combo: "Escape",
        },
        {
          allowSharedCombo: true,
          id: "test.second",
          combo: "Escape",
        },
      ] as const),
    ).not.toThrow();
  });
});

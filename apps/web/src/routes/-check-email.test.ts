import { describe, expect, it } from "vitest";

import { parseCheckEmailSearch } from "../lib/check-email";

describe("check-email search", () => {
  it.each([
    ["TOKEN_EXPIRED", "expired"],
    ["INVALID_TOKEN", "invalid"],
    ["USER_NOT_FOUND", "invalid"],
    ["INVALID_USER", "invalid"],
  ])("normalizes Better Auth error %s", (error, expected) => {
    expect(parseCheckEmailSearch({ error })).toEqual({ error: expected });
  });

  it("accepts the one-shot send marker", () => {
    expect(parseCheckEmailSearch({ send: "true" })).toEqual({ send: true });
  });

  it("accepts the verification callback marker", () => {
    expect(parseCheckEmailSearch({ verified: "true" })).toEqual({
      verified: true,
    });
  });

  it("drops unknown and malformed search values", () => {
    expect(
      parseCheckEmailSearch({
        error: "<script>",
        send: "false",
        token: "secret",
        verified: "false",
      }),
    ).toEqual({});
  });
});

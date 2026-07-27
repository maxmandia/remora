import { describe, expect, it } from "vitest";

import { getFileExtension, matchesGenerationFieldValueKind } from "./index.ts";

describe("getFileExtension", () => {
  it("returns the lowercased, dot-prefixed extension", () => {
    expect(getFileExtension("Reference.PNG")).toBe(".png");
    expect(getFileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("returns an empty string when there is no real extension", () => {
    expect(getFileExtension("no-extension")).toBe("");
    expect(getFileExtension(".dotfile")).toBe("");
    expect(getFileExtension("trailing.")).toBe("");
  });
});

describe("matchesGenerationFieldValueKind", () => {
  it.each([
    ["value", "string"],
    [1.5, "number"],
    [1, "integer"],
    [true, "boolean"],
    [[], "array"],
    [{}, "object"],
  ] as const)("accepts %j as %s", (value, kind) => {
    expect(matchesGenerationFieldValueKind(value, kind)).toBe(true);
  });

  it.each([
    [1, "string"],
    [Number.NaN, "number"],
    [Number.POSITIVE_INFINITY, "number"],
    [1.5, "integer"],
    ["true", "boolean"],
    [{}, "array"],
    [[], "object"],
    [null, "object"],
  ] as const)("rejects %j as %s", (value, kind) => {
    expect(matchesGenerationFieldValueKind(value, kind)).toBe(false);
  });
});

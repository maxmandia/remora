import { describe, expect, it } from "vitest";

import { getFileExtension } from "./index.ts";

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

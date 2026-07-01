import { describe, expect, it } from "vitest";

import { buildPublicAssetUrl } from "./public-asset.ts";

describe("public asset urls", () => {
  it("keeps root assets root-relative for absolute base urls", () => {
    expect(buildPublicAssetUrl("/", "logo.svg")).toBe("/logo.svg");
    expect(buildPublicAssetUrl("/desktop", "/logo.svg")).toBe(
      "/desktop/logo.svg",
    );
  });

  it("keeps packaged renderer assets relative to index.html", () => {
    expect(buildPublicAssetUrl("./", "logo.svg")).toBe("./logo.svg");
    expect(buildPublicAssetUrl(".", "/remora.png")).toBe("./remora.png");
  });
});

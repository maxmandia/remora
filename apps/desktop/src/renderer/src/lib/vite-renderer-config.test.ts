import { describe, expect, it } from "vitest";

import { rendererDedupeDependencies } from "../../../../vite.renderer.config.ts";

describe("desktop renderer Vite config", () => {
  it("deduplicates the shared UI package that owns React contexts", () => {
    expect(rendererDedupeDependencies).toContain("@remora/ui");
  });
});

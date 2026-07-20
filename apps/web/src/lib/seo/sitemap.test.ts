import { describe, expect, it } from "vitest";

import { createPublicSitemapXml, createSitemapXml } from "./sitemap";

describe("sitemap generation", () => {
  it("includes public model and static pages with model lastmod", () => {
    const sitemap = createPublicSitemapXml();

    expect(sitemap).toContain("https://remora.computer/models");
    expect(sitemap).toContain(
      "https://remora.computer/models/seedance-2-0-video",
    );
    expect(sitemap).toContain("<lastmod>2026-07-16</lastmod>");
    expect(sitemap).not.toContain("/sign-in");
    expect(sitemap).not.toContain("/sign-up");
  });

  it("escapes XML-sensitive URL characters", () => {
    expect(createSitemapXml([{ path: "/models/a&b" }])).toContain(
      "https://remora.computer/models/a&amp;b",
    );
  });
});

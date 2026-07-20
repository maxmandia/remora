import { describe, expect, it } from "vitest";

import { publishedModelPages } from "./model-pages";
import {
  createCanonicalUrl,
  createModelPageHead,
  createSeoHead,
} from "./index";

describe("SEO head generation", () => {
  it("removes search parameters and hashes from canonical URLs", () => {
    expect(createCanonicalUrl("/?credit_checkout=success#return")).toBe(
      "https://remora.computer/",
    );
  });

  it("marks private routes as noindex", () => {
    const head = createSeoHead({
      canonicalPath: "/sign-in",
      description: "Sign in.",
      index: false,
      title: "Sign in | Remora",
    });

    expect(head.meta).toContainEqual({
      name: "robots",
      content: "noindex, nofollow",
    });
  });

  it("creates canonical, social, article, and breadcrumb metadata", () => {
    const seedance = publishedModelPages.find(
      ({ slug }) => slug === "seedance-2-0-video",
    );
    expect(seedance).toBeDefined();

    const head = createModelPageHead(seedance!);

    expect(head.links).toContainEqual({
      rel: "canonical",
      href: "https://remora.computer/models/seedance-2-0-video",
    });
    expect(head.meta).toContainEqual({
      property: "og:type",
      content: "article",
    });
    expect(head.meta).toContainEqual({
      name: "twitter:card",
      content: "summary_large_image",
    });

    const structuredData = head.scripts.map(({ children }) =>
      JSON.parse(children),
    );
    expect(structuredData.map((item) => item["@type"])).toEqual([
      "Article",
      "BreadcrumbList",
    ]);
  });
});

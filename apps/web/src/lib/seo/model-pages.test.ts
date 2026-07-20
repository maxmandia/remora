import { describe, expect, it } from "vitest";

import {
  createModelPageEntries,
  parseModelPageMetadata,
  publishedModelPages,
} from "./model-pages";
import { parseModelPageFrontmatter } from "./model-page-frontmatter";

const validMetadata = {
  slug: "example-video-pro",
  title: "Example Video Pro",
  description: "A specific model variant for testing.",
  developer: "Example Lab",
  family: "Example Video",
  variant: "Pro",
  modality: "video",
  facts: [
    { label: "Resolution", value: "1080p" },
    { label: "Duration", value: "10 seconds" },
    { label: "Input", value: "Text and images" },
  ],
  publicationStatus: "published",
  publishedAt: "2026-07-16",
  updatedAt: "2026-07-16",
};

describe("model page metadata", () => {
  it("parses JSON frontmatter from an MDX source", () => {
    expect(
      parseModelPageFrontmatter(
        `---\n${JSON.stringify(validMetadata)}\n---\n\n## Content`,
        "example-video-pro.mdx",
      ),
    ).toEqual(validMetadata);
  });

  it("accepts trailing commas added by the MDX formatter", () => {
    expect(
      parseModelPageFrontmatter(
        '---\n{ "slug": "formatted-model", }\n---',
        "formatted-model.mdx",
      ),
    ).toEqual({ slug: "formatted-model" });
  });

  it("rejects missing or invalid JSON frontmatter", () => {
    expect(() =>
      parseModelPageFrontmatter("## Content", "missing.mdx"),
    ).toThrow(/requires JSON frontmatter/);
    expect(() =>
      parseModelPageFrontmatter("---\nnot-json\n---", "invalid.mdx"),
    ).toThrow(/invalid JSON frontmatter/);
  });

  it("accepts valid published metadata without sources", () => {
    expect(parseModelPageMetadata(validMetadata)).toEqual(validMetadata);
  });

  it("allows drafts without a publication date", () => {
    expect(
      parseModelPageMetadata({
        ...validMetadata,
        publicationStatus: "draft",
        publishedAt: undefined,
      }).publicationStatus,
    ).toBe("draft");
  });

  it.each([
    ["an invalid slug", { slug: "Example Video" }],
    ["fewer than three facts", { facts: validMetadata.facts.slice(0, 2) }],
    [
      "duplicate fact labels",
      {
        facts: [
          ...validMetadata.facts.slice(0, 2),
          { label: " resolution ", value: "4K" },
        ],
      },
    ],
    ["an invalid calendar date", { updatedAt: "2026-02-31" }],
    [
      "a non-HTTPS source",
      { sources: [{ label: "Docs", url: "http://example.com" }] },
    ],
    ["a missing publication date", { publishedAt: undefined }],
  ])("rejects %s", (_, override) => {
    expect(() =>
      parseModelPageMetadata({ ...validMetadata, ...override }),
    ).toThrow();
  });

  it("requires the metadata slug to match the MDX filename", () => {
    expect(() =>
      createModelPageEntries({
        content: {
          "../content/models/different-slug.mdx": async () => ({
            default: () => null,
          }),
        },
        metadata: {
          "../content/models/different-slug.mdx": validMetadata,
        },
      }),
    ).toThrow(/must match file name/);
  });

  it("rejects duplicate slugs", () => {
    const firstPath = "../content/first/example-video-pro.mdx";
    const secondPath = "../content/second/example-video-pro.mdx";
    const load = async () => ({ default: () => null });

    expect(() =>
      createModelPageEntries({
        content: { [firstPath]: load, [secondPath]: load },
        metadata: {
          [firstPath]: validMetadata,
          [secondPath]: validMetadata,
        },
      }),
    ).toThrow(/slugs must be unique/);
  });

  it("exposes only published model metadata", () => {
    expect(publishedModelPages.map(({ slug }) => slug)).toContain(
      "seedance-2-0-video",
    );
    expect(publishedModelPages.map(({ slug }) => slug)).toContain(
      "seedance-2-5-video",
    );
    expect(
      publishedModelPages.every(
        ({ publicationStatus }) => publicationStatus === "published",
      ),
    ).toBe(true);
  });
});

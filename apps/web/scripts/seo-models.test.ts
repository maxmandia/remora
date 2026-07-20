import { describe, expect, it } from "vitest";

import {
  countWords,
  createSelectionRecords,
  validateCatalog,
  type ArtificialAnalysisSelectionSnapshot,
} from "./seo-models";

const apiModels = [
  {
    id: "model-b",
    name: "Model B",
    slug: "model-b",
    model_creator: { id: "creator-b", name: "Creator B" },
    elo: 1200,
    ci_95: 8,
  },
  {
    id: "model-a",
    name: "Model A",
    slug: "model-a",
    model_creator: { id: "creator-a", name: "Creator A" },
    elo: 1200,
    ci_95: null,
  },
  {
    id: "model-c",
    name: "Model C",
    slug: "model-c",
    model_creator: { id: "creator-c", name: "Creator C" },
    elo: 1100,
    ci_95: 10,
  },
];

describe("SEO model catalog tooling", () => {
  it("sorts snapshot records by Elo with a stable source-id tie break", () => {
    const records = createSelectionRecords("text-to-image", apiModels);

    expect(records.map(({ sourceId }) => sourceId)).toEqual([
      "model-a",
      "model-b",
      "model-c",
    ]);
    expect(records.map(({ sourcePosition }) => sourcePosition)).toEqual([
      1, 2, 3,
    ]);
    expect(
      records.every(
        ({ disposition }) => disposition === "insufficient-documentation",
      ),
    ).toBe(true);
  });

  it("counts prose words without treating punctuation as separate words", () => {
    expect(countWords("One model-specific sentence—with useful facts.")).toBe(
      6,
    );
  });

  it("reports incomplete selection counts without accepting placeholder pages", () => {
    const snapshot: ArtificialAnalysisSelectionSnapshot = {
      capturedAt: "2026-07-16",
      attribution: "https://artificialanalysis.ai",
      source: "user-supplied",
      leaderboards: {
        "text-to-image":
          "https://artificialanalysis.ai/image/leaderboard/text-to-image",
        "text-to-video":
          "https://artificialanalysis.ai/video/leaderboard/text-to-video",
        "image-to-video":
          "https://artificialanalysis.ai/video/leaderboard/image-to-video",
      },
      records: createSelectionRecords("text-to-image", apiModels),
    };

    expect(validateCatalog(snapshot, [])).toEqual(
      expect.arrayContaining([
        "text-to-image requires 50 selected records; found 0",
        "text-to-video requires 25 selected records; found 0",
        "image-to-video requires 25 selected records; found 0",
      ]),
    );
  });

  it("accepts a complete source-backed catalog with supplemental published pages", () => {
    const imageRecords = createSelectionRecords(
      "text-to-image",
      createApiModels("image", 50),
    ).map((record, index) => ({
      ...record,
      pageSlug: `image-model-${index + 1}`,
      disposition: "selected" as const,
    }));
    const textToVideoRecords = createSelectionRecords(
      "text-to-video",
      createApiModels("text-video", 25),
    ).map((record, index) => ({
      ...record,
      pageSlug: `text-video-model-${index + 1}`,
      disposition: "selected" as const,
    }));
    const imageToVideoRecords = createSelectionRecords(
      "image-to-video",
      createApiModels("image-video", 25),
    ).map((record, index) => ({
      ...record,
      pageSlug: `image-video-model-${index + 1}`,
      disposition: "selected" as const,
    }));
    const snapshot: ArtificialAnalysisSelectionSnapshot = {
      capturedAt: "2026-07-16",
      attribution: "https://artificialanalysis.ai",
      source: "user-supplied",
      leaderboards: {
        "text-to-image":
          "https://artificialanalysis.ai/image/leaderboard/text-to-image",
        "text-to-video":
          "https://artificialanalysis.ai/video/leaderboard/text-to-video",
        "image-to-video":
          "https://artificialanalysis.ai/video/leaderboard/image-to-video",
      },
      records: [...imageRecords, ...textToVideoRecords, ...imageToVideoRecords],
    };
    const pages = snapshot.records.map((record, index) => {
      const slug = record.pageSlug!;
      const modality: "image" | "video" =
        record.leaderboard === "text-to-image" ? "image" : "video";
      const metadata = {
        slug,
        title: `Catalog Model ${index + 1}`,
        description: `Distinct catalog description ${index + 1}.`,
        developer: `Developer ${index + 1}`,
        family: `Family ${index + 1}`,
        variant: "Standard",
        modality,
        facts: [
          { label: "Input", value: "Text" },
          { label: "Output", value: modality },
          { label: "Control", value: `Control ${index + 1}` },
        ],
        publicationStatus: "published" as const,
        publishedAt: "2026-07-16",
        updatedAt: "2026-07-16",
        sources: [
          {
            label: `Official documentation ${index + 1}`,
            url: `https://example.com/models/${slug}`,
          },
        ],
      };

      return {
        fileName: `${slug}.mdx`,
        metadata,
        source: `---\n${JSON.stringify(metadata)}\n---\n\n## Capabilities\n\nCatalog-specific-${index + 1} ${"documented ".repeat(250)}\n\n## Controls\n\nDistinct controls for this model.`,
      };
    });

    const supplementalMetadata = {
      slug: "supplemental-video-model",
      title: "Supplemental Video Model",
      description:
        "A published model that is not part of the frozen selection.",
      developer: "Example Lab",
      family: "Supplemental Video",
      variant: "Standard",
      modality: "video" as const,
      facts: [
        { label: "Duration", value: "30 seconds" },
        { label: "Resolution", value: "4K" },
        { label: "References", value: "50 items" },
      ],
      publicationStatus: "published" as const,
      publishedAt: "2026-07-17",
      updatedAt: "2026-07-17",
      sources: [
        {
          label: "Official supplemental documentation",
          url: "https://example.com/models/supplemental-video-model",
        },
      ],
    };
    pages.push({
      fileName: "supplemental-video-model.mdx",
      metadata: supplementalMetadata,
      source: `---\n${JSON.stringify(supplementalMetadata)}\n---\n\n## Capabilities\n\nSupplemental model copy.`,
    });

    expect(validateCatalog(snapshot, pages)).toEqual([]);
  });
});

function createApiModels(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, "0")}`,
    name: `${prefix} model ${index + 1}`,
    slug: `${prefix}-model-${index + 1}`,
    model_creator: {
      id: `${prefix}-creator-${index + 1}`,
      name: `${prefix} creator ${index + 1}`,
    },
    elo: 2000 - index,
    ci_95: 10,
  }));
}

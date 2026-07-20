import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

import { z } from "zod";

import { parseModelPageFrontmatter } from "../src/lib/seo/model-page-frontmatter";
import {
  modelPageMetadataSchema,
  type ModelPageMetadata,
} from "../src/lib/seo/model-page-metadata";

const capturedAt = "2026-07-16";
const artificialAnalysisOrigin = "https://artificialanalysis.ai";
const webRoot = fileURLToPath(new URL("..", import.meta.url));
const modelsDirectory = path.join(webRoot, "src/content/models");
const snapshotPath = path.join(
  webRoot,
  "model-data",
  `artificial-analysis-${capturedAt}.json`,
);

const leaderboards = {
  "text-to-image": {
    modality: "image",
    selectionTarget: 50,
    url: `${artificialAnalysisOrigin}/image/leaderboard/text-to-image`,
  },
  "text-to-video": {
    modality: "video",
    selectionTarget: 25,
    url: `${artificialAnalysisOrigin}/video/leaderboard/text-to-video`,
  },
  "image-to-video": {
    modality: "video",
    selectionTarget: 25,
    url: `${artificialAnalysisOrigin}/video/leaderboard/image-to-video`,
  },
} as const;

type Leaderboard = keyof typeof leaderboards;

const benchmarkModelSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  model_creator: z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
  }),
  elo: z.number().finite(),
  ci_95: z.number().finite().nullable(),
});

const selectionRecordSchema = z
  .object({
    leaderboard: z.enum(["text-to-image", "text-to-video", "image-to-video"]),
    capturedAt: z.literal(capturedAt),
    sourceId: z.string().min(1),
    sourceSlug: z.string().min(1),
    sourceName: z.string().min(1),
    sourceCreatorId: z.string().min(1),
    sourceCreatorName: z.string().min(1),
    sourcePosition: z.number().int().positive(),
    elo: z.number().finite(),
    ci95: z.number().finite().nullable(),
    pageSlug: z.string().min(1).optional(),
    disposition: z.enum([
      "selected",
      "duplicate",
      "insufficient-documentation",
    ]),
    reason: z.string().trim().min(1).optional(),
  })
  .superRefine((record, context) => {
    if (record.disposition === "selected" && !record.pageSlug) {
      context.addIssue({
        code: "custom",
        message: "Selected records require pageSlug",
        path: ["pageSlug"],
      });
    }

    if (record.disposition !== "selected" && !record.reason) {
      context.addIssue({
        code: "custom",
        message: `${record.disposition} records require a reason`,
        path: ["reason"],
      });
    }

    if (record.disposition === "duplicate" && !record.pageSlug) {
      context.addIssue({
        code: "custom",
        message: "Duplicate records require the canonical pageSlug",
        path: ["pageSlug"],
      });
    }
  });

const snapshotSchema = z.object({
  capturedAt: z.literal(capturedAt),
  attribution: z.literal(artificialAnalysisOrigin),
  source: z.literal("user-supplied"),
  leaderboards: z.object({
    "text-to-image": z.literal(leaderboards["text-to-image"].url),
    "text-to-video": z.literal(leaderboards["text-to-video"].url),
    "image-to-video": z.literal(leaderboards["image-to-video"].url),
  }),
  records: z.array(selectionRecordSchema),
});

export type ArtificialAnalysisSelectionRecord = z.infer<
  typeof selectionRecordSchema
>;
export type ArtificialAnalysisSelectionSnapshot = z.infer<
  typeof snapshotSchema
>;

type BenchmarkModel = z.infer<typeof benchmarkModelSchema>;

export function createSelectionRecords(
  leaderboard: Leaderboard,
  models: BenchmarkModel[],
): ArtificialAnalysisSelectionRecord[] {
  return [...models]
    .sort(
      (left, right) => right.elo - left.elo || left.id.localeCompare(right.id),
    )
    .map((model, index) => ({
      leaderboard,
      capturedAt,
      sourceId: model.id,
      sourceSlug: model.slug,
      sourceName: model.name,
      sourceCreatorId: model.model_creator.id,
      sourceCreatorName: model.model_creator.name,
      sourcePosition: index + 1,
      elo: model.elo,
      ci95: model.ci_95,
      disposition: "insufficient-documentation",
      reason: "Primary-source editorial review pending",
    }));
}

type CatalogPage = {
  fileName: string;
  metadata: ModelPageMetadata;
  source: string;
};

export function validateCatalog(
  snapshot: ArtificialAnalysisSelectionSnapshot,
  pages: CatalogPage[],
) {
  const errors: string[] = [];
  const pagesBySlug = new Map(pages.map((page) => [page.metadata.slug, page]));
  const selectedRecords = snapshot.records.filter(
    (record) => record.disposition === "selected",
  );

  for (const leaderboard of Object.keys(leaderboards) as Leaderboard[]) {
    const records = snapshot.records.filter(
      (record) => record.leaderboard === leaderboard,
    );
    const selected = records.filter(
      (record) => record.disposition === "selected",
    );
    const selectionTarget = leaderboards[leaderboard].selectionTarget;

    if (selected.length !== selectionTarget) {
      errors.push(
        `${leaderboard} requires ${selectionTarget} selected records; found ${selected.length}`,
      );
    }

    records.forEach((record, index) => {
      if (record.sourcePosition !== index + 1) {
        errors.push(`${leaderboard} source positions must be sequential`);
      }
      const previous = records[index - 1];
      if (previous && previous.elo < record.elo) {
        errors.push(`${leaderboard} records must be sorted by descending Elo`);
      }
    });
  }

  const selectedPageSlugs = selectedRecords.flatMap((record) =>
    record.pageSlug ? [record.pageSlug] : [],
  );
  if (new Set(selectedPageSlugs).size !== selectedPageSlugs.length) {
    errors.push("Selected records must map to unique canonical page slugs");
  }

  const imageSelectionCount = selectedRecords.filter(
    (record) => leaderboards[record.leaderboard].modality === "image",
  ).length;
  const videoSelectionCount = selectedRecords.filter(
    (record) => leaderboards[record.leaderboard].modality === "video",
  ).length;
  if (imageSelectionCount !== 50 || videoSelectionCount !== 50) {
    errors.push(
      `Catalog requires 50 image and 50 video selections; found ${imageSelectionCount} image and ${videoSelectionCount} video`,
    );
  }

  const duplicateValues = (values: Array<[string, string]>, label: string) => {
    const seen = new Map<string, string>();
    for (const [slug, value] of values) {
      const normalizedValue = value.trim().toLocaleLowerCase("en-US");
      const existingSlug = seen.get(normalizedValue);
      if (existingSlug) {
        errors.push(`${label} must be unique: ${existingSlug} and ${slug}`);
      } else {
        seen.set(normalizedValue, slug);
      }
    }
  };

  duplicateValues(
    pages.map(({ metadata }) => [metadata.slug, metadata.title]),
    "Model titles",
  );
  duplicateValues(
    pages.map(({ metadata }) => [metadata.slug, metadata.description]),
    "Model descriptions",
  );

  const publishedPageSlugs = pages
    .filter(({ metadata }) => metadata.publicationStatus === "published")
    .map(({ metadata }) => metadata.slug);
  for (const slug of selectedPageSlugs) {
    if (!publishedPageSlugs.includes(slug)) {
      errors.push(`Selected page ${slug} is not published`);
    }
  }

  for (const page of pages) {
    const expectedFileName = `${page.metadata.slug}.mdx`;
    if (page.fileName !== expectedFileName) {
      errors.push(`${page.fileName} must match slug ${page.metadata.slug}`);
    }
  }

  for (const record of snapshot.records) {
    if (record.disposition !== "selected") {
      continue;
    }

    const page = record.pageSlug ? pagesBySlug.get(record.pageSlug) : undefined;
    if (!page) {
      errors.push(
        `${record.sourceName} does not resolve to ${record.pageSlug}`,
      );
      continue;
    }

    const expectedModality = leaderboards[record.leaderboard].modality;
    if (page.metadata.modality !== expectedModality) {
      errors.push(
        `${page.metadata.slug} must have modality ${expectedModality} for ${record.leaderboard}`,
      );
    }
    if (page.metadata.publicationStatus !== "published") {
      errors.push(
        `${page.metadata.slug} must be published for catalog release`,
      );
    }
    if (!page.metadata.sources?.length) {
      errors.push(`${page.metadata.slug} requires at least one primary source`);
    }

    const body = stripFrontmatter(page.source);
    if (countWords(body) < 250) {
      errors.push(
        `${page.metadata.slug} requires at least 250 words of body copy`,
      );
    }
    if ((body.match(/^##\s+.+$/gm) ?? []).length < 2) {
      errors.push(`${page.metadata.slug} requires at least two H2 sections`);
    }
    if (/\b(?:TODO|TBD|FIXME|PLACEHOLDER)\b/i.test(page.source)) {
      errors.push(`${page.metadata.slug} contains an unresolved placeholder`);
    }

    const rawMetadata = parseModelPageFrontmatter(page.source, page.fileName);
    if (rawMetadata && typeof rawMetadata === "object") {
      for (const field of [
        "artificialAnalysis",
        "ci95",
        "elo",
        "rank",
        "sourcePosition",
      ]) {
        if (field in rawMetadata) {
          errors.push(
            `${page.metadata.slug} exposes forbidden ranking field ${field}`,
          );
        }
      }
    }
  }

  duplicateValues(
    selectedPageSlugs.flatMap((slug) => {
      const page = pagesBySlug.get(slug);
      return page ? [[slug, stripFrontmatter(page.source)]] : [];
    }),
    "Model article bodies",
  );

  return errors;
}

export function countWords(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

async function readCatalogPages() {
  const fileNames = (await readdir(modelsDirectory))
    .filter((fileName) => fileName.endsWith(".mdx"))
    .sort((left, right) => left.localeCompare(right));

  return Promise.all(
    fileNames.map(async (fileName) => {
      const source = await readFile(
        path.join(modelsDirectory, fileName),
        "utf8",
      );
      return {
        fileName,
        metadata: modelPageMetadataSchema.parse(
          parseModelPageFrontmatter(source, fileName),
        ),
        source,
      };
    }),
  );
}

async function validateSnapshotCatalog() {
  const snapshot = snapshotSchema.parse(
    JSON.parse(await readFile(snapshotPath, "utf8")),
  );
  const pages = await readCatalogPages();
  const errors = validateCatalog(snapshot, pages);

  if (errors.length) {
    throw new Error(
      `SEO model catalog validation failed:\n- ${errors.join("\n- ")}`,
    );
  }

  console.log("Validated 50 image and 50 video model pages");
}

function stripFrontmatter(source: string) {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command === "validate") {
    await validateSnapshotCatalog();
    return;
  }

  throw new Error("Usage: seo-models validate");
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

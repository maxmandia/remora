import { lazy, type ComponentType, type LazyExoticComponent } from "react";
import metadataModules from "virtual:model-page-metadata";

import {
  modelPageMetadataSchema,
  type ModelPageMetadata,
} from "./model-page-metadata";

export { parseModelPageMetadata } from "./model-page-metadata";
export type { ModelPageMetadata } from "./model-page-metadata";

type ModelPageComponent = ComponentType<{
  components?: Record<string, ComponentType<Record<string, unknown>>>;
}>;

type ModelPageModule = {
  default: ModelPageComponent;
};

type ModelPageEntry = {
  component: LazyExoticComponent<ModelPageComponent>;
  load: () => Promise<ModelPageModule>;
  metadata: ModelPageMetadata;
  sourcePath: string;
};

const contentModules = import.meta.glob<ModelPageModule>(
  "../../content/models/*.mdx",
);

function getSlugFromSourcePath(sourcePath: string) {
  const fileName = sourcePath.split("/").at(-1);
  return fileName?.replace(/\.mdx$/, "") ?? "";
}

export function createModelPageEntries({
  content,
  metadata,
}: {
  content: Record<string, () => Promise<ModelPageModule>>;
  metadata: Record<string, unknown>;
}) {
  const entries = Object.entries(metadata).map(([sourcePath, value]) => {
    const parsedMetadata = modelPageMetadataSchema.parse(value);
    const sourceSlug = getSlugFromSourcePath(sourcePath);

    if (parsedMetadata.slug !== sourceSlug) {
      throw new Error(
        `Model page slug "${parsedMetadata.slug}" must match file name "${sourceSlug}"`,
      );
    }

    const load = content[sourcePath];
    if (!load) {
      throw new Error(`Missing MDX content loader for ${sourcePath}`);
    }

    return {
      component: lazy(load),
      load,
      metadata: parsedMetadata,
      sourcePath,
    } satisfies ModelPageEntry;
  });

  const slugs = entries.map(({ metadata: { slug } }) => slug);
  if (new Set(slugs).size !== slugs.length) {
    throw new Error("Model page slugs must be unique");
  }

  return entries.sort((left, right) =>
    left.metadata.title.localeCompare(right.metadata.title),
  );
}

const modelPageEntries = createModelPageEntries({
  content: contentModules,
  metadata: metadataModules,
});

export const publishedModelPages = modelPageEntries
  .filter(({ metadata }) => metadata.publicationStatus === "published")
  .map(({ metadata }) => metadata);

export async function preloadPublishedModelPage(slug: string) {
  const entry = modelPageEntries.find(
    ({ metadata }) =>
      metadata.slug === slug && metadata.publicationStatus === "published",
  );

  if (!entry) {
    return null;
  }

  await entry.load();
  return entry.metadata;
}

export function getPublishedModelPageComponent(slug: string) {
  return (
    modelPageEntries.find(
      ({ metadata }) =>
        metadata.slug === slug && metadata.publicationStatus === "published",
    )?.component ?? null
  );
}

export function getRelatedModelPages(slug: string, limit = 3) {
  const current = publishedModelPages.find((model) => model.slug === slug);
  if (!current) {
    return [];
  }

  return publishedModelPages
    .filter((model) => model.slug !== slug)
    .sort((left, right) => {
      const leftScore =
        left.family === current.family
          ? 0
          : left.modality === current.modality
            ? 1
            : 2;
      const rightScore =
        right.family === current.family
          ? 0
          : right.modality === current.modality
            ? 1
            : 2;

      return leftScore - rightScore || left.title.localeCompare(right.title);
    })
    .slice(0, limit);
}

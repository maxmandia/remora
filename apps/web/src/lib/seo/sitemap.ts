import { publishedModelPages } from "./model-pages";
import { createCanonicalUrl } from "./index";

type SitemapEntry = {
  lastModified?: string;
  path: string;
};

const staticEntries: SitemapEntry[] = [
  { path: "/" },
  { path: "/models" },
  { path: "/pricing" },
  { path: "/privacy", lastModified: "2026-07-14" },
  { path: "/support" },
  { path: "/terms", lastModified: "2026-07-14" },
];

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function createSitemapXml(entries: SitemapEntry[]) {
  const urls = entries
    .map(({ lastModified, path }) => {
      const lastModifiedElement = lastModified
        ? `\n    <lastmod>${escapeXml(lastModified)}</lastmod>`
        : "";

      return `  <url>\n    <loc>${escapeXml(createCanonicalUrl(path))}</loc>${lastModifiedElement}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function createPublicSitemapXml() {
  return createSitemapXml([
    ...staticEntries,
    ...publishedModelPages.map((model) => ({
      path: `/models/${model.slug}`,
      lastModified: model.updatedAt,
    })),
  ]);
}

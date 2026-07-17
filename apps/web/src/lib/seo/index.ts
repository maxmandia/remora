import type { ModelPageMetadata } from "./model-pages";

export const siteOrigin = "https://remora.computer";

const defaultSocialImage = `${siteOrigin}/remora-social-card.png`;

type StructuredData = Record<string, unknown>;

type SeoHeadOptions = {
  canonicalPath: string;
  description: string;
  index?: boolean;
  socialType?: "article" | "website";
  structuredData?: StructuredData | StructuredData[];
  title: string;
};

export function createCanonicalUrl(pathname: string) {
  const canonical = new URL(pathname, siteOrigin);
  canonical.search = "";
  canonical.hash = "";
  return canonical.toString();
}

export function createSeoHead({
  canonicalPath,
  description,
  index = true,
  socialType = "website",
  structuredData,
  title,
}: SeoHeadOptions) {
  const canonicalUrl = createCanonicalUrl(canonicalPath);
  const structuredDataItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return {
    meta: [
      { title },
      { name: "description", content: description },
      {
        name: "robots",
        content: index ? "index, follow" : "noindex, nofollow",
      },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: socialType },
      { property: "og:url", content: canonicalUrl },
      { property: "og:site_name", content: "Remora" },
      { property: "og:image", content: defaultSocialImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: defaultSocialImage },
    ],
    links: [{ rel: "canonical", href: canonicalUrl }],
    scripts: structuredDataItems.map((item) => ({
      type: "application/ld+json",
      children: JSON.stringify(item),
    })),
  };
}

export function createWebsiteStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Remora",
    url: siteOrigin,
    description:
      "An opinionated desktop application purpose built for generative media.",
  } satisfies StructuredData;
}

export function createModelPageHead(metadata: ModelPageMetadata) {
  const canonicalPath = `/models/${metadata.slug}`;
  const canonicalUrl = createCanonicalUrl(canonicalPath);

  return createSeoHead({
    canonicalPath,
    description: metadata.description,
    socialType: "article",
    structuredData: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: metadata.title,
        description: metadata.description,
        datePublished: metadata.publishedAt,
        dateModified: metadata.updatedAt,
        mainEntityOfPage: canonicalUrl,
        author: { "@type": "Organization", name: "Remora" },
        publisher: {
          "@type": "Organization",
          name: "Remora",
          url: siteOrigin,
        },
        about: {
          "@type": "Thing",
          name: metadata.title,
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Remora",
            item: `${siteOrigin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Models",
            item: `${siteOrigin}/models`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: metadata.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
    title: `${metadata.title} | Remora`,
  });
}

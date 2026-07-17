import { createFileRoute } from "@tanstack/react-router";

import { createPublicSitemapXml } from "../lib/seo/sitemap";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(createPublicSitemapXml(), {
          headers: {
            "Cache-Control": "public, max-age=300, s-maxage=3600",
            "Content-Type": "application/xml; charset=utf-8",
          },
        }),
    },
  },
});

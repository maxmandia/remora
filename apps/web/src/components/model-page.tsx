import type { ComponentType } from "react";

import {
  getRelatedModelPages,
  type ModelPageMetadata,
} from "../lib/seo/model-pages";
import { ModelDownloadCta } from "./model-download-cta";
import { SiteFooter } from "./site-footer";

export function ModelPage({
  Content,
  downloadUrl,
  metadata,
}: {
  Content: ComponentType;
  downloadUrl?: string;
  metadata: ModelPageMetadata;
}) {
  const relatedModels = getRelatedModelPages(metadata.slug);

  return (
    <main className="flex min-h-svh flex-col bg-[#101111] px-5 py-6 text-[#f7f3eb] sm:px-8 lg:px-10">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 pb-6">
        <a
          href="/"
          aria-label="Remora home"
          className="rounded-sm focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          <img
            src="/remora-wordmark.svg"
            alt="Remora"
            className="h-auto w-27 select-none"
            draggable={false}
          />
        </a>
        <a
          href="/models"
          className="rounded-sm text-sm text-[#a7a59f] transition-colors hover:text-[#f7f3eb] focus-visible:text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          Browse models
        </a>
      </header>

      <article className="mx-auto w-full max-w-4xl flex-1 py-10 sm:py-16">
        <nav aria-label="Breadcrumb" className="mb-10 text-sm text-[#8f8e89]">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <a className="transition-colors hover:text-[#f7f3eb]" href="/">
                Remora
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <a
                className="transition-colors hover:text-[#f7f3eb]"
                href="/models"
              >
                Models
              </a>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-[#c5c2bb]">
              {metadata.title}
            </li>
          </ol>
        </nav>

        <header className="border-b border-white/10 pb-10 sm:pb-12">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium tracking-[0.16em] text-[#8f8e89] uppercase">
            <span>{metadata.developer}</span>
            <span aria-hidden="true">·</span>
            <span>{metadata.modality}</span>
            <span aria-hidden="true">·</span>
            <span>{metadata.variant}</span>
          </div>
          <h1 className="mt-5 text-4xl font-medium tracking-[-0.035em] text-balance sm:text-6xl">
            {metadata.title}
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-7 font-light text-[#aaa8a2] sm:text-lg">
            {metadata.description}
          </p>
          <p className="mt-5 text-xs text-[#777570]">
            Updated {formatDate(metadata.updatedAt)}
          </p>
        </header>

        <ModelDownloadCta variant="compact" downloadUrl={downloadUrl} />

        <section aria-labelledby="key-facts" className="py-10 sm:py-12">
          <h2 id="key-facts" className="sr-only">
            Key facts
          </h2>
          <dl className="grid gap-px overflow-hidden rounded-xl border border-white/10 bg-white/10 sm:grid-cols-3">
            {metadata.facts.map((fact) => (
              <div key={fact.label} className="bg-[#101111] p-5 sm:p-6">
                <dt className="text-xs tracking-[0.12em] text-[#777570] uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-3 text-sm leading-6 text-[#e5e1d9]">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-10 text-[0.975rem] leading-7 font-light text-[#b9b6af] [&_a]:rounded-sm [&_a]:font-normal [&_a]:text-[#f7f3eb] [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-4 [&_a]:transition-colors [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-[#8da0dc] [&_a:focus-visible]:outline-none [&_a:hover]:decoration-white [&_h2]:pt-3 [&_h2]:text-2xl [&_h2]:font-medium [&_h2]:tracking-[-0.02em] [&_h2]:text-[#f7f3eb] [&_h3]:text-lg [&_h3]:font-medium [&_h3]:text-[#e5e1d9] [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_p+p]:mt-4 [&_strong]:font-medium [&_strong]:text-[#e5e1d9] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
          <Content />
        </div>

        {metadata.sources?.length ? (
          <section className="mt-12 border-t border-white/10 pt-10">
            <h2 className="text-xl font-medium tracking-[-0.015em]">Sources</h2>
            <ul className="mt-4 space-y-2 text-sm text-[#aaa8a2]">
              {metadata.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="underline decoration-white/30 underline-offset-4 transition-colors hover:text-[#f7f3eb] hover:decoration-white"
                  >
                    {source.label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <ModelDownloadCta variant="full" downloadUrl={downloadUrl} />

        {relatedModels.length ? (
          <section className="mt-14 border-t border-white/10 pt-10">
            <h2 className="text-xl font-medium tracking-[-0.015em]">
              Related models
            </h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-3">
              {relatedModels.map((model) => (
                <li key={model.slug}>
                  <a
                    href={`/models/${model.slug}`}
                    className="block h-full rounded-lg border border-white/10 p-4 transition-colors hover:border-white/20 hover:bg-white/[0.025]"
                  >
                    <span className="text-sm text-[#f7f3eb]">
                      {model.title}
                    </span>
                    <span className="mt-1 block text-xs text-[#777570]">
                      {model.developer}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>

      <SiteFooter />
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

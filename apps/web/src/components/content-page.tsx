import type { ReactNode } from "react";

import { SiteFooter } from "./site-footer";

type ContentPageProps = {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
  updated?: string;
};

export function ContentPage({
  children,
  description,
  eyebrow,
  title,
  updated,
}: ContentPageProps) {
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
          href="/"
          className="rounded-sm text-sm text-[#a7a59f] transition-colors hover:text-[#f7f3eb] focus-visible:text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          Back to home
        </a>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 py-14 sm:py-20">
        <header className="mb-14 border-b border-white/10 pb-10 sm:mb-16">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#8f8e89] uppercase">
            {eyebrow}
          </p>
          <h1 className="text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 font-light text-[#aaa8a2] sm:text-lg">
            {description}
          </p>
          {updated ? (
            <p className="mt-5 text-xs text-[#777570]">Effective {updated}</p>
          ) : null}
        </header>

        <div className="space-y-11 text-[0.9375rem] leading-7 font-light text-[#b9b6af] [&_a]:rounded-sm [&_a]:font-normal [&_a]:text-[#f7f3eb] [&_a]:underline [&_a]:decoration-white/30 [&_a]:underline-offset-4 [&_a]:transition-colors [&_a:focus-visible]:ring-2 [&_a:focus-visible]:ring-[#8da0dc] [&_a:focus-visible]:ring-offset-4 [&_a:focus-visible]:ring-offset-[#101111] [&_a:focus-visible]:outline-none [&_a:hover]:decoration-white [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-[-0.015em] [&_h2]:text-[#f7f3eb] [&_h3]:font-medium [&_h3]:text-[#e5e1d9] [&_li]:pl-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-2 [&_p+p]:mt-4 [&_section]:space-y-4 [&_strong]:font-medium [&_strong]:text-[#e5e1d9] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </article>

      <SiteFooter />
    </main>
  );
}

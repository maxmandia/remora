import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { MacosDownloadButton } from "../components/macos-download-button";
import { RemoraAsciiArt } from "../components/remora-ascii-art";
import { SiteFooter } from "../components/site-footer";
import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutStatus,
} from "../lib/credit-checkout-redirect";
import { createSeoHead, createWebsiteStructuredData } from "../lib/seo";

export { MacosDownloadButton } from "../components/macos-download-button";

export const Route = createFileRoute("/")({
  component: Home,
  head: () =>
    createSeoHead({
      canonicalPath: "/",
      description:
        "Remora is an opinionated macOS application purpose built for creating and organizing generative media.",
      structuredData: createWebsiteStructuredData(),
      title: "Remora: Generative media tooling for macOS",
    }),
});

function Home() {
  const search = Route.useSearch() as { credit_checkout?: unknown };
  const creditCheckoutStatus = parseCreditCheckoutStatus(
    search.credit_checkout,
  );
  const desktopUrl = creditCheckoutStatus
    ? createDesktopCreditCheckoutUrl({
        status: creditCheckoutStatus,
      })
    : null;

  useEffect(() => {
    if (!desktopUrl) {
      return;
    }

    window.location.assign(desktopUrl);
  }, [desktopUrl]);

  if (desktopUrl) {
    return (
      <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <p>Returning to Remora...</p>
          <a
            className="border-border hover:bg-muted rounded-md border px-3 py-2 text-sm transition-colors"
            href={desktopUrl}
          >
            Open Remora
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col overflow-x-hidden bg-[#101111] px-5 py-6 text-[#f7f3eb] sm:px-8 lg:px-10">
      <section className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
        <RemoraAsciiArt />
        <div className="mt-1 flex max-w-3xl flex-col items-center gap-5">
          <h1>
            <img
              src="/remora-wordmark.svg"
              alt="Remora"
              className="h-auto w-34 select-none"
              draggable={false}
            />
          </h1>
          <p className="text-muted-foreground text-md w-2/3 font-light text-balance lg:text-xl lg:leading-[1.875rem]">
            An opinionated tool purpose built for generative media.
          </p>
          <div>
            <MacosDownloadButton />
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

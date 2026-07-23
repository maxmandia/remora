import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { trpcClient } from "../clients/trpc";
import { LandingNavigation } from "../components/landing-navigation";
import { MacosDownloadButton } from "../components/macos-download-button";
import { RemoraAsciiArt } from "../components/remora-ascii-art";
import { SiteFooter } from "../components/site-footer";
import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutStatus,
  parseStripeCheckoutSessionId,
} from "../lib/credit-checkout-redirect";
import { getGoogleAdsConfig, trackGoogleAdsPurchase } from "../lib/google-ads";
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
  const search = Route.useSearch() as {
    checkout_session_id?: unknown;
    credit_checkout?: unknown;
  };
  const checkoutReturnHandledRef = useRef(false);
  const creditCheckoutStatus = parseCreditCheckoutStatus(
    search.credit_checkout,
  );
  const stripeCheckoutSessionId = parseStripeCheckoutSessionId(
    search.checkout_session_id,
  );
  const desktopUrl = creditCheckoutStatus
    ? createDesktopCreditCheckoutUrl({
        status: creditCheckoutStatus,
      })
    : null;

  useEffect(() => {
    if (!desktopUrl || checkoutReturnHandledRef.current) {
      return;
    }

    checkoutReturnHandledRef.current = true;
    const googleAdsConfig = getGoogleAdsConfig();

    if (
      creditCheckoutStatus !== "success" ||
      !stripeCheckoutSessionId ||
      !googleAdsConfig
    ) {
      window.location.assign(desktopUrl);
      return;
    }

    const abortController = new AbortController();
    const verificationTimeoutId = window.setTimeout(
      () => abortController.abort(),
      2_000,
    );

    void trpcClient.credits.getCheckoutConversion
      .query({ stripeCheckoutSessionId }, { signal: abortController.signal })
      .then((purchase) => trackGoogleAdsPurchase(purchase, googleAdsConfig))
      .catch(() => undefined)
      .finally(() => {
        window.clearTimeout(verificationTimeoutId);
        window.location.assign(desktopUrl);
      });

    return () => {
      window.clearTimeout(verificationTimeoutId);
      abortController.abort();
    };
  }, [creditCheckoutStatus, desktopUrl, stripeCheckoutSessionId]);

  if (desktopUrl) {
    return (
      <main className="mp-block mp-no-track bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-6">
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
      <LandingNavigation />
      <section className="mx-auto mt-20 flex w-full max-w-7xl flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
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
            <MacosDownloadButton withAppleIcon />
          </div>
        </div>
        <img
          src="/remora-desktop-app-1152.webp"
          srcSet="/remora-desktop-app-1152.webp 1152w, /remora-desktop-app-2304.webp 2304w"
          sizes="(min-width: 1280px) 1152px, (min-width: 1024px) calc(100vw - 80px), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
          alt="Remora desktop application showing projects and generation threads"
          width={1152}
          height={756}
          className="mt-12 h-auto w-full max-w-6xl drop-shadow-[0_24px_60px_rgba(0,0,0,0.4)] select-none"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
        />
      </section>
      <SiteFooter />
    </main>
  );
}

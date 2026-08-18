import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { trpcClient } from "../clients/trpc";
import { LandingCursorStage } from "../components/landing-cursor-stage";
import { LandingNavigation } from "../components/landing-navigation";
import { SiteFooter } from "../components/site-footer";
import {
  createDesktopCreditCheckoutUrl,
  parseCreditCheckoutStatus,
  parseStripeCheckoutSessionId,
} from "../lib/credit-checkout-redirect";
import { getGoogleAdsConfig, trackGoogleAdsPurchase } from "../lib/google-ads";
import { createSeoHead, createWebsiteStructuredData } from "../lib/seo";

export const Route = createFileRoute("/")({
  component: Home,
  head: () =>
    createSeoHead({
      canonicalPath: "/",
      description:
        "Remora is an opinionated creative workspace purpose built for creating and organizing generative media.",
      structuredData: createWebsiteStructuredData(),
      title: "Remora: Generative media creation and organization",
    }),
});

function Home() {
  const search = Route.useSearch() as {
    checkout_session_id?: unknown;
    credit_checkout?: unknown;
  };
  const checkoutReturnHandledRef = useRef(false);
  const wordmarkRef = useRef<HTMLImageElement | null>(null);
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
      .then((purchase) => {
        if (purchase) {
          void trackGoogleAdsPurchase(purchase, googleAdsConfig);
        }
      })
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
    <div className="bg-background text-foreground flex min-h-svh flex-col overflow-x-hidden px-5 py-6 sm:px-8 lg:px-10">
      <LandingNavigation showBrand={false} />
      <main className="relative flex flex-1 items-center justify-center py-10">
        <LandingCursorStage avoidRef={wordmarkRef} className="absolute inset-0" />
        <img
          ref={wordmarkRef}
          src="/remora-wordmark.svg"
          alt="Remora"
          className="h-auto w-60 max-w-full select-none sm:w-72 lg:w-81"
          draggable={false}
        />
      </main>
      <SiteFooter />
    </div>
  );
}

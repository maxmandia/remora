import {
  CreditsSettingsPage,
  type CreditsSettingsCheckoutAdapter,
} from "@remora/app/credits";
import { useTRPC } from "@remora/app/trpc";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { trpcClient } from "../clients/trpc";
import type { CreditCheckoutSearch } from "../lib/credit-checkout-redirect";
import { getGoogleAdsConfig, trackGoogleAdsPurchase } from "../lib/google-ads";

const checkoutConversionVerificationTimeoutMs = 2_000;

export function createWebCreditsSettingsCheckoutAdapter(
  openCheckout: (checkoutUrl: string) => void = (checkoutUrl) => {
    window.open(checkoutUrl, "_blank", "noopener,noreferrer");
  },
): CreditsSettingsCheckoutAdapter {
  return {
    getReturnInput: async () => ({ checkoutReturnTarget: "web" }),
    openCheckout,
  };
}

const webCreditsSettingsCheckoutAdapter =
  createWebCreditsSettingsCheckoutAdapter();

export function WebCreditsSettingsRoute({
  checkoutSearch,
  onCheckoutReturnHandled,
}: {
  checkoutSearch: CreditCheckoutSearch;
  onCheckoutReturnHandled: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const handledCheckoutReturnRef = useRef<string | null>(null);
  const creditCheckoutStatus = checkoutSearch.credit_checkout;
  const stripeCheckoutSessionId = checkoutSearch.checkout_session_id;

  useEffect(() => {
    if (!creditCheckoutStatus) {
      return;
    }

    const checkoutReturnKey = `${creditCheckoutStatus}:${stripeCheckoutSessionId ?? ""}`;

    if (handledCheckoutReturnRef.current === checkoutReturnKey) {
      return;
    }

    handledCheckoutReturnRef.current = checkoutReturnKey;

    const refreshQueries = Promise.all([
      queryClient.invalidateQueries(trpc.credits.getBalance.queryFilter()),
      queryClient.invalidateQueries(
        trpc.creditAutoTopUpSettings.getSettings.queryFilter(),
      ),
    ]);
    const trackConversion =
      creditCheckoutStatus === "success" && stripeCheckoutSessionId
        ? trackCheckoutConversion(stripeCheckoutSessionId)
        : Promise.resolve();

    void Promise.allSettled([refreshQueries, trackConversion]).finally(
      onCheckoutReturnHandled,
    );
  }, [
    creditCheckoutStatus,
    onCheckoutReturnHandled,
    queryClient,
    stripeCheckoutSessionId,
    trpc,
  ]);

  return (
    <CreditsSettingsPage checkoutAdapter={webCreditsSettingsCheckoutAdapter} />
  );
}

async function trackCheckoutConversion(stripeCheckoutSessionId: string) {
  const googleAdsConfig = getGoogleAdsConfig();

  if (!googleAdsConfig) {
    return;
  }

  const abortController = new AbortController();
  const verificationTimeoutId = window.setTimeout(
    () => abortController.abort(),
    checkoutConversionVerificationTimeoutMs,
  );

  try {
    const purchase = await trpcClient.credits.getCheckoutConversion.query(
      { stripeCheckoutSessionId },
      { signal: abortController.signal },
    );

    await trackGoogleAdsPurchase(purchase, googleAdsConfig);
  } catch {
    // Checkout completion is authoritative; conversion tracking is best-effort.
  } finally {
    window.clearTimeout(verificationTimeoutId);
  }
}

import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import { authClient } from "../lib/auth-client";
import { syncWebAnalyticsAuthState } from "../lib/analytics";
import {
  captureGoogleAdsAttributionFromSearch,
  syncStoredGoogleAdsAttribution,
} from "../lib/google-ads-attribution";
import {
  getGoogleAdsConfig,
  initializeGoogleAds,
  setGoogleAdsDeliveryAllowed,
} from "../lib/google-ads";
import { trpcClient } from "../clients/trpc";

export function useWebAnalytics() {
  const { data: session, isPending } = authClient.useSession();
  const location = useLocation({
    select: ({ href, pathname, searchStr }) => ({
      href,
      pathname,
      search: searchStr,
    }),
  });

  useEffect(() => {
    let cancelled = false;
    captureGoogleAdsAttributionFromSearch(location.search);
    const authState = isPending
      ? ({ status: "loading" } as const)
      : session
        ? ({
            status: "signed-in",
            userId: session.user.id,
            impersonatedBy: session.session.impersonatedBy ?? null,
          } as const)
        : ({ status: "signed-out" } as const);

    void syncWebAnalyticsAuthState(authState, location).then((enabled) => {
      if (cancelled || isPending) {
        return;
      }

      setGoogleAdsDeliveryAllowed(enabled);

      if (enabled) {
        void initializeGoogleAds(getGoogleAdsConfig());
      }
    });

    if (authState.status === "signed-in" && authState.impersonatedBy === null) {
      void syncStoredGoogleAdsAttribution((input) =>
        trpcClient.googleAds.captureClickAttribution.mutate(input),
      );
    }

    return () => {
      cancelled = true;
    };
  }, [isPending, location, session?.session.impersonatedBy, session?.user.id]);
}

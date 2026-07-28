import { useLocation } from "@tanstack/react-router";
import { useEffect } from "react";

import { authClient } from "../lib/auth-client";
import { syncWebAnalyticsAuthState } from "../lib/analytics";
import {
  getGoogleAdsConfig,
  initializeGoogleAds,
  setGoogleAdsDeliveryAllowed,
} from "../lib/google-ads";

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
        initializeGoogleAds(getGoogleAdsConfig());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isPending, location, session?.session.impersonatedBy, session?.user.id]);
}

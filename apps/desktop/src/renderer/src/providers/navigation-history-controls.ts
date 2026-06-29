import { useCallback, useMemo } from "react";
import { useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";

import { useAuth } from "./auth-provider.tsx";

export function useNavigationHistoryControls() {
  const { status } = useAuth();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const currentHistoryIndex = useLocation({
    select: (location) => location.state.__TSR_index,
  });
  const isNavigationEnabled = status === "signed-in";
  const canGoForward = currentHistoryIndex < router.history.length - 1;
  const canNavigateBack = isNavigationEnabled && canGoBack;
  const canNavigateForward = isNavigationEnabled && canGoForward;

  const goBack = useCallback(() => {
    if (!canNavigateBack) {
      return;
    }

    router.history.back();
  }, [canNavigateBack, router]);

  const goForward = useCallback(() => {
    if (!canNavigateForward) {
      return;
    }

    router.history.forward();
  }, [canNavigateForward, router]);

  return useMemo(
    () => ({
      canNavigateBack,
      canNavigateForward,
      goBack,
      goForward,
      isNavigationEnabled,
    }),
    [
      canNavigateBack,
      canNavigateForward,
      goBack,
      goForward,
      isNavigationEnabled,
    ],
  );
}

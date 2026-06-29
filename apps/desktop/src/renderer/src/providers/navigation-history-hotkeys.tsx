import { useHotkey } from "./hotkeys-provider.tsx";
import { useNavigationHistoryControls } from "./navigation-history-controls.ts";

export function NavigationHistoryHotkeys() {
  const {
    goBack,
    goForward,
    isNavigationEnabled,
  } = useNavigationHistoryControls();

  useHotkey("navigation.back", {
    enabled: isNavigationEnabled,
    onKeyDown: goBack,
  });

  useHotkey("navigation.forward", {
    enabled: isNavigationEnabled,
    onKeyDown: goForward,
  });

  return null;
}

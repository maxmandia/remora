import { useHotkey } from "../providers/hotkeys-provider.tsx";

type UseNavigationHistoryHotkeysOptions = {
  enabled: boolean;
  onBack: () => void;
  onForward: () => void;
};

function useNavigationHistoryHotkeys({
  enabled,
  onBack,
  onForward,
}: UseNavigationHistoryHotkeysOptions) {
  useHotkey("navigation.back", {
    enabled,
    onKeyDown: onBack,
  });

  useHotkey("navigation.forward", {
    enabled,
    onKeyDown: onForward,
  });
}

export { useNavigationHistoryHotkeys };
export type { UseNavigationHistoryHotkeysOptions };

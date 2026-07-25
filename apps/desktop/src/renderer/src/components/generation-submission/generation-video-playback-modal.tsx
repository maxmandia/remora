import {
  GenerationVideoPlaybackModal as SharedGenerationVideoPlaybackModal,
  type GenerationVideoPlaybackModalProps,
} from "@remora/app/generation";
import { useCallback, useLayoutEffect, useRef } from "react";

import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";

export function GenerationVideoPlaybackModal({
  onCloseStart,
  ...props
}: GenerationVideoPlaybackModalProps) {
  const restoreSidebarOnCloseRef = useRef(false);
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );

  const restoreSidebarIfNeeded = useCallback(() => {
    if (!restoreSidebarOnCloseRef.current) {
      return;
    }

    restoreSidebarOnCloseRef.current = false;
    setSidebarOpen(true);
  }, [setSidebarOpen]);

  const handleCloseStart = useCallback(() => {
    restoreSidebarIfNeeded();
    onCloseStart();
  }, [onCloseStart, restoreSidebarIfNeeded]);

  useLayoutEffect(() => {
    const shouldRestoreSidebar =
      useDesktopPreferencesStore.getState().sidebarOpen;
    restoreSidebarOnCloseRef.current = shouldRestoreSidebar;

    if (shouldRestoreSidebar) {
      setSidebarOpen(false);
    }

    return restoreSidebarIfNeeded;
  }, [restoreSidebarIfNeeded, setSidebarOpen]);

  return (
    <SharedGenerationVideoPlaybackModal
      {...props}
      topInset="var(--remora-titlebar-height)"
      onCloseStart={handleCloseStart}
    />
  );
}

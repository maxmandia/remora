import {
  GenerationImageViewerModal as SharedGenerationImageViewerModal,
  type GenerationImageViewerModalProps,
} from "@remora/app/generation";
import { useLayoutEffect, useRef } from "react";

import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";

export function GenerationImageViewerModal(
  props: GenerationImageViewerModalProps,
) {
  const restoreSidebarOnCloseRef = useRef(
    useDesktopPreferencesStore.getState().sidebarOpen,
  );
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );

  useLayoutEffect(() => {
    if (restoreSidebarOnCloseRef.current) {
      setSidebarOpen(false);
    }

    return () => {
      if (restoreSidebarOnCloseRef.current) {
        setSidebarOpen(true);
      }
    };
  }, [setSidebarOpen]);

  return (
    <SharedGenerationImageViewerModal
      {...props}
      topInset="var(--remora-titlebar-height)"
    />
  );
}

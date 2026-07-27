import {
  GenerationImageViewerModal as SharedGenerationImageViewerModal,
  type GenerationImageViewerModalProps,
} from "@remora/app/generation";
import { useLayoutEffect, useRef } from "react";

import { useGeneratedImageContextMenu } from "../../hooks/use-generated-image-context-menu.ts";
import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";

export function GenerationImageViewerModal({
  generatedJobId,
  ...props
}: GenerationImageViewerModalProps) {
  const restoreSidebarOnCloseRef = useRef(
    useDesktopPreferencesStore.getState().sidebarOpen,
  );
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );
  const openGeneratedImageContextMenu = useGeneratedImageContextMenu(
    generatedJobId ?? null,
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
      generatedJobId={generatedJobId}
      onImageContextMenu={openGeneratedImageContextMenu}
      topInset="var(--remora-titlebar-height)"
    />
  );
}

import {
  GenerationImageViewerModal as SharedGenerationImageViewerModal,
  type GeneratedImageContextMenuHandler,
  type GenerationImageViewerModalProps,
} from "@remora/app/generation";
import { useCallback, useLayoutEffect, useRef, type MouseEvent } from "react";

import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";

export function GenerationImageViewerModal({
  generatedImage,
  onGeneratedImageContextMenu,
  ...props
}: GenerationImageViewerModalProps & {
  onGeneratedImageContextMenu: GeneratedImageContextMenuHandler;
}) {
  const restoreSidebarOnCloseRef = useRef(
    useDesktopPreferencesStore.getState().sidebarOpen,
  );
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );
  const openGeneratedImageContextMenu = useCallback(
    (event: MouseEvent<HTMLImageElement>) => {
      if (generatedImage) {
        onGeneratedImageContextMenu(generatedImage, event);
      }
    },
    [generatedImage, onGeneratedImageContextMenu],
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
      generatedImage={generatedImage}
      onImageContextMenu={
        generatedImage ? openGeneratedImageContextMenu : undefined
      }
      topInset="var(--remora-titlebar-height)"
    />
  );
}

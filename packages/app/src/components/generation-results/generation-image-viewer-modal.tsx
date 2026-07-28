import { XIcon } from "lucide-react";
import {
  useLayoutEffect,
  useRef,
  type MouseEventHandler,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type {
  GeneratedImageContextMenuActions,
  GeneratedImageDescriptor,
} from "../../lib/generation/generated-image.ts";
import { useHotkey } from "../../providers/hotkeys-provider.tsx";
import { GeneratedImageContextMenu } from "./generated-image-context-menu.tsx";

export type GenerationImageViewerModalProps = {
  closeAriaLabel: string;
  dialogAriaLabel: string;
  generatedImage?: GeneratedImageDescriptor;
  imageAlt: string;
  imageUrl: string;
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  onImageContextMenu?: MouseEventHandler<HTMLImageElement>;
  topInset?: string;
  onClose: () => void;
};

export type GenerationImageViewerRenderer = (
  props: GenerationImageViewerModalProps,
) => ReactNode;

export function GenerationImageViewerModal({
  closeAriaLabel,
  dialogAriaLabel,
  imageAlt,
  imageUrl,
  generatedImage,
  generatedImageContextMenu,
  onImageContextMenu,
  topInset = "0px",
  onClose,
}: GenerationImageViewerModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useHotkey("generation.closeMediaViewer", {
    allowInEditable: true,
    onKeyDown: onClose,
  });

  useLayoutEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  return createPortal(
    <div
      ref={dialogRef}
      aria-label={dialogAriaLabel}
      aria-modal="true"
      className="fixed inset-x-0 bottom-0 z-50 grid place-items-center overflow-hidden outline-none"
      data-slot="generation-image-viewer-modal"
      role="dialog"
      style={{ top: topInset }}
      tabIndex={-1}
    >
      <button
        aria-label={closeAriaLabel}
        className="absolute inset-0 border-0 bg-[var(--remora-stage-background,var(--background))] p-0"
        data-slot="generation-image-viewer-backdrop"
        onClick={onClose}
        type="button"
      />
      <div
        className="pointer-events-none relative z-[1] flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden"
        data-slot="generation-image-viewer-content"
      >
        <GeneratedImageContextMenu
          actions={generatedImageContextMenu}
          image={generatedImage}
        >
          <img
            alt={imageAlt}
            className="pointer-events-auto block max-h-full min-h-0 max-w-full min-w-0 object-contain select-none"
            data-slot="generation-image-viewer-image"
            onContextMenu={
              generatedImageContextMenu ? undefined : onImageContextMenu
            }
            src={imageUrl}
          />
        </GeneratedImageContextMenu>
      </div>
      <button
        aria-label={closeAriaLabel}
        className="bg-surface-strong text-foreground absolute top-4 right-4 z-[2] grid size-9 place-items-center rounded-md border-0 p-0"
        onClick={onClose}
        type="button"
      >
        <XIcon className="size-4" />
      </button>
    </div>,
    document.body,
  );
}

import { PlayIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

import type { VideoPreviewStack } from "../../lib/generation/index.ts";
import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";
import { dotFieldSkeletonVisibleInset } from "./dot-field-skeleton.tsx";
import {
  GenerationVideoPlaybackModal,
  type GenerationVideoPlayback,
  type PlaybackRect,
} from "./generation-video-playback-modal.tsx";

export type GenerationPreviewTileStackControl = {
  panelId: string;
  isOpen: boolean;
  onToggle: () => void;
};

export function GenerationPreviewTile({
  aspectRatio,
  previewStack,
  stackControl,
}: {
  aspectRatio: string;
  previewStack: VideoPreviewStack;
  stackControl?: GenerationPreviewTileStackControl;
}) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const restoreSidebarOnCloseRef = useRef(false);
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );
  const [playback, setPlayback] = useState<GenerationVideoPlayback | null>(
    null,
  );
  const frontLayer = previewStack.layers[0];
  const isStacked = previewStack.layers.length > 1;
  const canOpenStackPanel = Boolean(stackControl) && isStacked;

  const openPlaybackModal = useCallback(() => {
    const videoUrl = frontLayer.videoUrl;

    if (!videoUrl || !previewFrameRef.current) {
      return;
    }

    const originRect = toPlaybackRect(
      previewFrameRef.current.getBoundingClientRect(),
    );
    const playbackAspectRatio =
      parseGenerationAspectRatio(aspectRatio) ?? getRectAspectRatio(originRect);
    const restoreSidebarOnClose =
      useDesktopPreferencesStore.getState().sidebarOpen;
    restoreSidebarOnCloseRef.current = restoreSidebarOnClose;

    if (restoreSidebarOnClose) {
      setSidebarOpen(false);
    }

    setPlayback({
      aspectRatio: playbackAspectRatio,
      originRect,
      previewImageUrl: frontLayer.previewImageUrl,
      videoUrl,
    });
  }, [
    aspectRatio,
    frontLayer.previewImageUrl,
    frontLayer.videoUrl,
    setSidebarOpen,
  ]);

  const restoreSidebarIfNeeded = useCallback(() => {
    if (!restoreSidebarOnCloseRef.current) {
      return;
    }

    restoreSidebarOnCloseRef.current = false;
    setSidebarOpen(true);
  }, [setSidebarOpen]);

  useEffect(() => {
    return restoreSidebarIfNeeded;
  }, [restoreSidebarIfNeeded]);

  return (
    <div
      className="group relative shrink-0 -mt-[var(--remora-preview-stack-overflow-inset)] pt-[var(--remora-preview-stack-overflow-inset)] pr-[var(--remora-preview-stack-overflow-inset)]"
      data-testid="generation-thread-job"
      data-slot="generation-submission-preview-tile"
    >
      <div className="relative size-40">
      {previewStack.layers.map((layer, index) => {
        const isFrontLayer = index === 0;
        const canPlayFrontLayer =
          isFrontLayer && !isStacked && Boolean(layer.videoUrl);

        return (
          <div
            key={`${layer.job.id}-${index}`}
            ref={isFrontLayer ? previewFrameRef : undefined}
            className={[
              "bg-muted absolute overflow-hidden rounded-md shadow-[0_8px_20px_rgb(0_0_0_/_0.24)] ring-1 ring-white/10 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              isFrontLayer
                ? ""
                : [
                    "pointer-events-none will-change-transform",
                    getStackLayerHoverClassName(index),
                  ].join(" "),
            ]
              .filter(Boolean)
              .join(" ")}
            data-layer-index={index}
            data-slot={
              isFrontLayer
                ? "generation-submission-preview-frame"
                : "generation-submission-preview-stack-layer"
            }
            style={{
              ...getStackLayerStyle(index),
              inset: dotFieldSkeletonVisibleInset,
              zIndex: previewStack.layers.length - index,
            }}
          >
            <img
              alt={isFrontLayer ? getPreviewAltText(layer.kind) : ""}
              aria-hidden={isFrontLayer ? undefined : true}
              className="size-full object-cover select-none"
              data-slot={
                isFrontLayer
                  ? "generation-submission-preview-image"
                  : "generation-submission-preview-stack-image"
              }
              src={layer.previewImageUrl}
            />
            {canPlayFrontLayer ? (
              <button
                aria-label="Play generated video"
                className="group absolute inset-0 grid place-items-center border-0 bg-transparent p-0 text-inherit"
                data-slot="generation-submission-preview-play-overlay"
                onClick={openPlaybackModal}
                type="button"
              >
                <div className="transition-transform duration-500 ease-out group-hover:scale-110">
                  <PlayIcon className="fill-foreground ml-0.5 stroke-none" />
                </div>
              </button>
            ) : null}
            {isFrontLayer && playback ? (
              <GenerationVideoPlaybackModal
                playback={playback}
                onCloseStart={restoreSidebarIfNeeded}
                onClosed={() => setPlayback(null)}
              />
            ) : null}
          </div>
        );
      })}
      {canOpenStackPanel && stackControl ? (
        <button
          aria-controls={stackControl.panelId}
          aria-expanded={stackControl.isOpen}
          aria-label={
            stackControl.isOpen
              ? "Close generation stack"
              : "Open generation stack"
          }
          className="absolute inset-0 z-10 cursor-pointer border-0 bg-transparent p-0 outline-none"
          data-slot="generation-submission-preview-stack-trigger"
          onClick={stackControl.onToggle}
          type="button"
        />
      ) : null}
      </div>
    </div>
  );
}

function getPreviewAltText(kind: VideoPreviewStack["layers"][number]["kind"]) {
  return kind === "fallback"
    ? "Video preview unavailable"
    : "Generation preview";
}

function getStackLayerTransform(index: number) {
  const stackOffset = getStackLayerOffset(index);

  if (!stackOffset) {
    return undefined;
  }

  return [
    "translate(",
    `calc(${stackOffset.x} + var(--remora-preview-stack-hover-x, 0px)), `,
    `calc(${stackOffset.y} + var(--remora-preview-stack-hover-y, 0px))`,
    ")",
  ].join("");
}

function getStackLayerStyle(index: number): CSSProperties {
  return {
    transform: getStackLayerTransform(index),
  };
}

function getStackLayerOffset(index: number) {
  if (index === 1) {
    return { x: "9px", y: "-9px" };
  }

  if (index === 2) {
    return { x: "18px", y: "-18px" };
  }

  return null;
}

function getStackLayerHoverClassName(index: number) {
  if (index === 1) {
    return "group-hover:[--remora-preview-stack-hover-x:3px] group-hover:[--remora-preview-stack-hover-y:-3px]";
  }

  if (index === 2) {
    return "group-hover:[--remora-preview-stack-hover-x:6px] group-hover:[--remora-preview-stack-hover-y:-6px]";
  }

  return "";
}

function toPlaybackRect(rect: DOMRectReadOnly): PlaybackRect {
  return {
    height: Math.max(rect.height, 1),
    left: rect.left,
    top: rect.top,
    width: Math.max(rect.width, 1),
  };
}

function getRectAspectRatio(rect: PlaybackRect) {
  return rect.width / Math.max(rect.height, 1);
}

function parseGenerationAspectRatio(aspectRatio: string) {
  const match = aspectRatio.match(
    /^\s*(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)\s*$/,
  );

  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
    return null;
  }

  return width / height;
}

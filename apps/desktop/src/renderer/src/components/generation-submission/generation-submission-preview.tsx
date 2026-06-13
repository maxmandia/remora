import { PlayIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { VideoPreviewOrFallback } from "../../lib/generation/index.ts";
import { useDesktopPreferencesStore } from "../../stores/preferences-store.ts";
import { dotFieldSkeletonVisibleInset } from "./dot-field-skeleton.tsx";
import {
  type GenerationVideoPlayback,
  GenerationVideoPlaybackModal,
  type PlaybackRect,
} from "./generation-video-playback-modal.tsx";

export function GenerationSubmissionPreview({
  aspectRatio,
  preview,
}: {
  aspectRatio: string;
  preview: NonNullable<VideoPreviewOrFallback>;
}) {
  const previewFrameRef = useRef<HTMLDivElement | null>(null);
  const restoreSidebarOnCloseRef = useRef(false);
  const setSidebarOpen = useDesktopPreferencesStore(
    (state) => state.setSidebarOpen,
  );
  const [playback, setPlayback] = useState<GenerationVideoPlayback | null>(
    null,
  );

  const openPlaybackModal = useCallback(() => {
    if (!preview.videoUrl || !previewFrameRef.current) {
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
      previewImageUrl: preview.previewImageUrl,
      videoUrl: preview.videoUrl,
    });
  }, [aspectRatio, preview.previewImageUrl, preview.videoUrl, setSidebarOpen]);

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
      className="relative size-40 shrink-0"
      data-testid="generation-thread-job"
      data-slot="generation-submission-preview-tile"
    >
      <div
        ref={previewFrameRef}
        className="bg-muted absolute overflow-hidden rounded-md"
        data-slot="generation-submission-preview-frame"
        style={{ inset: dotFieldSkeletonVisibleInset }}
      >
        <img
          alt={
            preview.kind === "fallback"
              ? "Video preview unavailable"
              : "Generation preview"
          }
          className="size-full object-cover"
          data-slot="generation-submission-preview-image"
          src={preview.previewImageUrl}
        />
        {preview.videoUrl ? (
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
        {playback ? (
          <GenerationVideoPlaybackModal
            playback={playback}
            onCloseStart={restoreSidebarIfNeeded}
            onClosed={() => setPlayback(null)}
          />
        ) : null}
      </div>
    </div>
  );
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

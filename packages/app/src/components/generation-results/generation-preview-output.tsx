import type { GenerationThreadSubmissionJob } from "@remora/domain/generation-submission/dto";
import { isTerminalGenerationJobStatus } from "@remora/domain/generation-submission/helpers";
import type { GenerationPreviewStack } from "../../lib/generation/generation-preview.ts";
import type { GeneratedImageContextMenuActions } from "../../lib/generation/generated-image.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import { GenerationFailedOutput } from "./generation-failed-output.tsx";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import {
  GenerationPreviewTile,
  type GeneratedImageContextMenuHandler,
  type GenerationPreviewTileStackControl,
} from "./generation-preview-tile.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

export function GenerationPreviewOutput({
  aspectRatio,
  generatedImageContextMenu,
  job,
  onGeneratedImageContextMenu,
  previewStack,
  renderImageViewer,
  renderVideoViewer,
  responsive = false,
  stackControl,
}: {
  aspectRatio: string;
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  job?: GenerationThreadSubmissionJob | null;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  previewStack: GenerationPreviewStack | null;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  responsive?: boolean;
  stackControl?: GenerationPreviewTileStackControl;
}) {
  if (previewStack) {
    return (
      <GenerationPreviewTile
        aspectRatio={aspectRatio}
        generatedImageContextMenu={generatedImageContextMenu}
        onGeneratedImageContextMenu={onGeneratedImageContextMenu}
        previewStack={previewStack}
        renderImageViewer={renderImageViewer}
        renderVideoViewer={renderVideoViewer}
        responsive={responsive}
        {...(stackControl ? { stackControl } : {})}
      />
    );
  }

  if (
    job &&
    job.status !== "succeeded" &&
    isTerminalGenerationJobStatus(job.status)
  ) {
    return <GenerationFailedOutput job={job} responsive={responsive} />;
  }

  return (
    <DotFieldSkeleton
      className={
        responsive
          ? "aspect-square w-full max-w-40 shrink-0"
          : "size-40 shrink-0"
      }
      data-testid="generation-thread-job"
    />
  );
}

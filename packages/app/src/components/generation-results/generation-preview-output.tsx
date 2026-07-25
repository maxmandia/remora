import type { GenerationThreadSubmissionJob } from "@remora/domain/generation-submission/dto";
import type { GenerationPreviewStack } from "../../lib/generation/generation-preview.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import { GenerationFailedOutput } from "./generation-failed-output.tsx";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import {
  GenerationPreviewTile,
  type GenerationPreviewTileStackControl,
} from "./generation-preview-tile.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

export function GenerationPreviewOutput({
  aspectRatio,
  job,
  previewStack,
  renderImageViewer,
  renderVideoViewer,
  responsive = false,
  stackControl,
}: {
  aspectRatio: string;
  job?: GenerationThreadSubmissionJob | null;
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
        previewStack={previewStack}
        renderImageViewer={renderImageViewer}
        renderVideoViewer={renderVideoViewer}
        responsive={responsive}
        {...(stackControl ? { stackControl } : {})}
      />
    );
  }

  if (job?.status === "failed") {
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

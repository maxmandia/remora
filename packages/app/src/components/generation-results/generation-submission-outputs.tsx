import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

import {
  buildImagePreviewStack,
  buildVideoPreviewStack,
} from "../../lib/generation/generation-preview.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

export function GenerationSubmissionOutputs({
  isStackPanelOpen,
  renderImageViewer,
  renderVideoViewer,
  stackPanelId,
  submission,
  onStackPanelToggle,
}: {
  isStackPanelOpen: boolean;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  stackPanelId: string;
  submission: GenerationThreadSubmission;
  onStackPanelToggle: () => void;
}) {
  const previewStack =
    submission.modelType === "image"
      ? buildImagePreviewStack(submission)
      : buildVideoPreviewStack(submission);

  return (
    <div
      className="flex w-40 shrink-0 flex-wrap gap-2"
      data-slot="generation-submission-outputs"
    >
      <GenerationPreviewOutput
        aspectRatio={submission.submittedInput.aspectRatio}
        job={
          submission.requestedGenerations === 1
            ? (submission.jobs.find((job) => job.submissionIndex === 0) ?? null)
            : null
        }
        previewStack={previewStack}
        renderImageViewer={renderImageViewer}
        renderVideoViewer={renderVideoViewer}
        stackControl={{
          panelId: stackPanelId,
          isOpen: isStackPanelOpen,
          onToggle: onStackPanelToggle,
        }}
      />
    </div>
  );
}

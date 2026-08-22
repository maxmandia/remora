import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { isTerminalGenerationJobStatus } from "@remora/domain/generation-submission/helpers";

import {
  buildImagePreviewStack,
  buildModel3dPreviewStack,
  buildVideoPreviewStack,
} from "../../lib/generation/generation-preview.ts";
import type { GeneratedImageContextMenuActions } from "../../lib/generation/generated-image.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";
import type { GeneratedImageContextMenuHandler } from "./generation-preview-tile.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

export function GenerationSubmissionOutputs({
  generatedImageContextMenu,
  isStackPanelOpen,
  onGeneratedImageContextMenu,
  renderImageViewer,
  renderVideoViewer,
  stackPanelId,
  submission,
  onStackPanelToggle,
}: {
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  isStackPanelOpen: boolean;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  stackPanelId: string;
  submission: GenerationThreadSubmission;
  onStackPanelToggle: () => void;
}) {
  const previewStack =
    submission.modelType === "image"
      ? buildImagePreviewStack(submission)
      : submission.modelType === "video"
        ? buildVideoPreviewStack(submission)
        : buildModel3dPreviewStack(submission);
  const outputJob = findOutputJob(submission);

  return (
    <div
      className="flex w-40 shrink-0 flex-wrap gap-2"
      data-slot="generation-submission-outputs"
    >
      <GenerationPreviewOutput
        aspectRatio={
          submission.modelType === "model3d"
            ? "1:1"
            : submission.submittedInput.aspectRatio
        }
        generatedImageContextMenu={generatedImageContextMenu}
        onGeneratedImageContextMenu={onGeneratedImageContextMenu}
        job={outputJob}
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

function findOutputJob(submission: GenerationThreadSubmission) {
  if (submission.requestedGenerations === 1) {
    return submission.jobs.find((job) => job.submissionIndex === 0) ?? null;
  }

  if (
    submission.jobs.length !== submission.requestedGenerations ||
    submission.jobs.some((job) => !isTerminalGenerationJobStatus(job.status))
  ) {
    return null;
  }

  return (
    [...submission.jobs]
      .sort(
        (leftJob, rightJob) =>
          leftJob.submissionIndex - rightJob.submissionIndex,
      )
      .find((job) => job.status !== "succeeded") ?? null
  );
}

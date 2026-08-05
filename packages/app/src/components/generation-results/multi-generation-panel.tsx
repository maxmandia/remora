import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/domain/generation-submission/dto";

import {
  buildImagePreviewStackForJob,
  buildVideoPreviewStackForJob,
} from "../../lib/generation/generation-preview.ts";
import type { GeneratedImageContextMenuActions } from "../../lib/generation/generated-image.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import { EnhanceGenerationDraftContextMenu } from "./enhance-generation-draft-context-menu.tsx";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";
import type { GeneratedImageContextMenuHandler } from "./generation-preview-tile.tsx";
import { GenerationSubmissionSidePanel } from "./generation-submission-side-panel.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

type MultiGenerationPanelProps = {
  activeSubmission: GenerationThreadSubmission | null;
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  id: string;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  onClose: () => void;
};

export function MultiGenerationPanel({
  activeSubmission,
  generatedImageContextMenu,
  id,
  onGeneratedImageContextMenu,
  renderImageViewer,
  renderVideoViewer,
  onClose,
}: MultiGenerationPanelProps) {
  const isOpen = Boolean(activeSubmission);
  const jobs = activeSubmission
    ? listGenerationPanelJobs(activeSubmission.jobs)
    : [];

  return (
    <GenerationSubmissionSidePanel
      activeSubmissionId={activeSubmission?.id}
      ariaLabel="Generation stack panel"
      closeAriaLabel="Close generation panel"
      contentClassName="grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] justify-items-center gap-x-1.5"
      contentElement="div"
      contentSlot="generation-stack-panel-jobs"
      id={id}
      isOpen={isOpen}
      panelSlot="generation-stack-panel"
      title="Generations"
      onClose={onClose}
    >
      {activeSubmission
        ? jobs.map((job) => (
            <SubmissionPreviewWrapper
              key={job.id}
              aspectRatio={activeSubmission.submittedInput.aspectRatio}
              generatedImageContextMenu={generatedImageContextMenu}
              job={job}
              onGeneratedImageContextMenu={onGeneratedImageContextMenu}
              renderImageViewer={renderImageViewer}
              renderVideoViewer={renderVideoViewer}
              submission={activeSubmission}
            />
          ))
        : null}
    </GenerationSubmissionSidePanel>
  );
}

function listGenerationPanelJobs(jobs: GenerationThreadSubmissionJob[]) {
  return [...jobs].sort(
    (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
  );
}

function SubmissionPreviewWrapper({
  aspectRatio,
  generatedImageContextMenu,
  job,
  onGeneratedImageContextMenu,
  renderImageViewer,
  renderVideoViewer,
  submission,
}: {
  aspectRatio: string;
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  job: GenerationThreadSubmissionJob;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  submission: GenerationThreadSubmission;
}) {
  const previewStack =
    submission.modelType === "image"
      ? buildImagePreviewStackForJob(job)
      : buildVideoPreviewStackForJob(job);

  return (
    <EnhanceGenerationDraftContextMenu
      hasDisplayableResult={Boolean(previewStack)}
      job={job}
      submission={submission}
    >
      <GenerationPreviewOutput
        aspectRatio={aspectRatio}
        generatedImageContextMenu={generatedImageContextMenu}
        job={job}
        onGeneratedImageContextMenu={onGeneratedImageContextMenu}
        previewStack={previewStack}
        renderImageViewer={renderImageViewer}
        renderVideoViewer={renderVideoViewer}
        responsive
      />
    </EnhanceGenerationDraftContextMenu>
  );
}

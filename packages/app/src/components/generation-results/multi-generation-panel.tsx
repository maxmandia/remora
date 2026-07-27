import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/domain/generation-submission/dto";
import type { GenerationModelType } from "@remora/domain/generation-model/dto";

import {
  buildImagePreviewStackForJob,
  buildVideoPreviewStackForJob,
} from "../../lib/generation/generation-preview.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";
import type { GeneratedImageContextMenuHandler } from "./generation-preview-tile.tsx";
import { GenerationSubmissionSidePanel } from "./generation-submission-side-panel.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";

type MultiGenerationPanelProps = {
  activeSubmission: GenerationThreadSubmission | null;
  id: string;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
  onClose: () => void;
};

export function MultiGenerationPanel({
  activeSubmission,
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
              job={job}
              modelType={activeSubmission.modelType}
              onGeneratedImageContextMenu={onGeneratedImageContextMenu}
              renderImageViewer={renderImageViewer}
              renderVideoViewer={renderVideoViewer}
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
  job,
  modelType,
  onGeneratedImageContextMenu,
  renderImageViewer,
  renderVideoViewer,
}: {
  aspectRatio: string;
  job: GenerationThreadSubmissionJob;
  modelType: GenerationModelType;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
}) {
  return (
    <GenerationPreviewOutput
      aspectRatio={aspectRatio}
      job={job}
      onGeneratedImageContextMenu={onGeneratedImageContextMenu}
      renderImageViewer={renderImageViewer}
      renderVideoViewer={renderVideoViewer}
      previewStack={
        modelType === "image"
          ? buildImagePreviewStackForJob(job)
          : buildVideoPreviewStackForJob(job)
      }
      responsive
    />
  );
}

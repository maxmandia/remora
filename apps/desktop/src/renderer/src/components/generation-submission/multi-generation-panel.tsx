import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/domain/generation-submission/dto";
import type { GenerationModelType } from "@remora/domain/generation-model/dto";

import {
  buildImagePreviewStackForJob,
  buildVideoPreviewStackForJob,
} from "../../lib/generation/index.ts";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";
import { GenerationSubmissionSidePanel } from "./generation-submission-side-panel.tsx";

type MultiGenerationPanelProps = {
  activeSubmission: GenerationThreadSubmission | null;
  id: string;
  onClose: () => void;
};

export function MultiGenerationPanel({
  activeSubmission,
  id,
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
}: {
  aspectRatio: string;
  job: GenerationThreadSubmissionJob;
  modelType: GenerationModelType;
}) {
  return (
    <GenerationPreviewOutput
      aspectRatio={aspectRatio}
      job={job}
      previewStack={
        modelType === "image"
          ? buildImagePreviewStackForJob(job)
          : buildVideoPreviewStackForJob(job)
      }
      responsive
    />
  );
}

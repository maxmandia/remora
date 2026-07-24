import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/domain/generation-submission/dto";

import {
  buildImagePreviewStackForJob,
  buildVideoPreviewStackForJob,
} from "../../lib/generation/generation-preview.ts";
import {
  DotFieldSkeleton,
  dotFieldSkeletonVisibleInset,
} from "./dot-field-skeleton.tsx";
import { GenerationFailedOutput } from "./generation-failed-output.tsx";

export function GenerationSubmissionPreviewGrid({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  const jobs = [...submission.jobs].sort(
    (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
  );

  return (
    <div
      className="grid shrink-0 grid-cols-[repeat(auto-fit,minmax(8.5rem,10rem))] gap-2"
      data-slot="generation-submission-preview-grid"
    >
      {jobs.map((job) => (
        <GenerationSubmissionPreview
          key={job.id}
          job={job}
          modelType={submission.modelType}
        />
      ))}
    </div>
  );
}

function GenerationSubmissionPreview({
  job,
  modelType,
}: {
  job: GenerationThreadSubmissionJob;
  modelType: GenerationThreadSubmission["modelType"];
}) {
  const previewStack =
    modelType === "image"
      ? buildImagePreviewStackForJob(job)
      : buildVideoPreviewStackForJob(job);
  const preview = previewStack?.layers[0];

  if (preview) {
    return (
      <div
        className="relative aspect-square w-full max-w-40 shrink-0"
        data-slot="generation-submission-preview"
        data-testid="generation-thread-job"
      >
        <div
          className="bg-muted absolute overflow-hidden rounded-md shadow-[0_8px_20px_rgb(0_0_0_/_0.24)] ring-1 ring-white/10"
          data-slot="generation-submission-preview-frame"
          style={{ inset: dotFieldSkeletonVisibleInset }}
        >
          <img
            alt={
              preview.kind === "image"
                ? "Generated image"
                : preview.kind === "fallback"
                  ? "Video preview unavailable"
                  : "Generation preview"
            }
            className="size-full object-cover select-none"
            draggable={false}
            src={preview.previewImageUrl}
          />
        </div>
      </div>
    );
  }

  if (job.status === "failed") {
    return <GenerationFailedOutput job={job} responsive />;
  }

  return (
    <DotFieldSkeleton
      className="aspect-square w-full max-w-40 shrink-0"
      data-testid="generation-thread-job"
    />
  );
}

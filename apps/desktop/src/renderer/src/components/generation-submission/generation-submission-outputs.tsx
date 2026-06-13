import type { GenerationThreadSubmission } from "@remora/backend/types";

import { findVideoPreviewOrFallback } from "../../lib/generation/index.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";
import { GenerationSubmissionPreview } from "./generation-submission-preview.tsx";

export function GenerationSubmissionOutputs({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  // TODO: If there's an error state we keep showing the skeleton. Need to address this
  const preview = findVideoPreviewOrFallback(submission);

  return (
    <div className="flex w-1/5 shrink-0 flex-wrap gap-2">
      {preview ? (
        <GenerationSubmissionPreview
          aspectRatio={submission.submittedInput.aspectRatio}
          preview={preview}
        />
      ) : (
        // Even if there's multiple generations we want to show just one skeleton
        <DotFieldSkeleton
          className="size-40 shrink-0"
          data-testid="generation-thread-job"
        />
      )}
    </div>
  );
}

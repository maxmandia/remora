import type { GenerationThreadSubmission } from "@remora/backend/types";

import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";

export function GenerationSubmissionRow({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  return (
    <article className="flex w-full items-start gap-6">
      <GenerationSubmissionOutputs submission={submission} />
      <GenerationResultSubmittedInput submission={submission} />
    </article>
  );
}

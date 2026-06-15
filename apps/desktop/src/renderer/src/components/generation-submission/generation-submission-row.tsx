import type { GenerationThreadSubmission } from "@remora/backend/types";

import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";

export function GenerationSubmissionRow({
  isStackPanelOpen,
  stackPanelId,
  submission,
  onStackPanelToggle,
}: {
  isStackPanelOpen: boolean;
  stackPanelId: string;
  submission: GenerationThreadSubmission;
  onStackPanelToggle: () => void;
}) {
  return (
    <article className="flex w-full items-start gap-6">
      <GenerationSubmissionOutputs
        isStackPanelOpen={isStackPanelOpen}
        stackPanelId={stackPanelId}
        submission={submission}
        onStackPanelToggle={onStackPanelToggle}
      />
      <GenerationResultSubmittedInput submission={submission} />
    </article>
  );
}

import type { GenerationThreadSubmission } from "@remora/backend/types";

import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";

export function GenerationSubmissionRow({
  isReferenceMediaPanelOpen,
  isStackPanelOpen,
  referenceMediaPanelId,
  stackPanelId,
  submission,
  onReferenceMediaPanelToggle,
  onStackPanelToggle,
}: {
  isReferenceMediaPanelOpen: boolean;
  isStackPanelOpen: boolean;
  referenceMediaPanelId: string;
  stackPanelId: string;
  submission: GenerationThreadSubmission;
  onReferenceMediaPanelToggle: () => void;
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
      <GenerationResultSubmittedInput
        isReferenceMediaPanelOpen={isReferenceMediaPanelOpen}
        referenceMediaPanelId={referenceMediaPanelId}
        submission={submission}
        onReferenceMediaPanelToggle={onReferenceMediaPanelToggle}
      />
    </article>
  );
}

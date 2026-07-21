import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";

export function GenerationSubmissionRow({
  isAttachmentMediaPanelOpen,
  isStackPanelOpen,
  attachmentMediaPanelId,
  stackPanelId,
  submission,
  onAttachmentMediaPanelToggle,
  onStackPanelToggle,
}: {
  isAttachmentMediaPanelOpen: boolean;
  isStackPanelOpen: boolean;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  submission: GenerationThreadSubmission;
  onAttachmentMediaPanelToggle: () => void;
  onStackPanelToggle: () => void;
}) {
  return (
    <article
      className="flex w-full flex-nowrap items-start gap-6"
      data-slot="generation-submission-row"
    >
      <GenerationSubmissionOutputs
        isStackPanelOpen={isStackPanelOpen}
        stackPanelId={stackPanelId}
        submission={submission}
        onStackPanelToggle={onStackPanelToggle}
      />
      <GenerationResultSubmittedInput
        isAttachmentMediaPanelOpen={isAttachmentMediaPanelOpen}
        attachmentMediaPanelId={attachmentMediaPanelId}
        submission={submission}
        onAttachmentMediaPanelToggle={onAttachmentMediaPanelToggle}
      />
    </article>
  );
}

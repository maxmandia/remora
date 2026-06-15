import type { GenerationThreadSubmission } from "@remora/backend/types";

import { buildVideoPreviewStack } from "../../lib/generation/index.ts";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";

export function GenerationSubmissionOutputs({
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
  const previewStack = buildVideoPreviewStack(submission);

  return (
    <div className="flex w-1/5 shrink-0 flex-wrap gap-2">
      <GenerationPreviewOutput
        aspectRatio={submission.submittedInput.aspectRatio}
        previewStack={previewStack}
        stackControl={{
          panelId: stackPanelId,
          isOpen: isStackPanelOpen,
          onToggle: onStackPanelToggle,
        }}
      />
    </div>
  );
}

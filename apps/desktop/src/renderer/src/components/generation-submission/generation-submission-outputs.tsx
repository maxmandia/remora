import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

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
  if (submission.modelType !== "video") {
    return null;
  }

  const previewStack = buildVideoPreviewStack(submission);

  return (
    <div
      className={[
        "flex shrink-0 flex-wrap gap-2",
        submission.requestedGenerations > 1
          ? "w-[calc(10rem+var(--remora-preview-stack-overflow-inset))]"
          : "w-40",
      ].join(" ")}
      data-slot="generation-submission-outputs"
    >
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

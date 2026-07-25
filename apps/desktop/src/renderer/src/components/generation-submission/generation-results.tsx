import {
  GenerationResultsSurface as SharedGenerationResultsSurface,
  type GenerationResultsActivePanel,
} from "@remora/app/generation";
import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

import { GenerationImageViewerModal } from "./generation-image-viewer-modal.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";
import { MultiGenerationPanel } from "./multi-generation-panel.tsx";

export type { GenerationResultsActivePanel } from "@remora/app/generation";

type GenerationResultsProps = {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  threadId: string;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
};

type GenerationResultsSurfaceProps = {
  activePanel: GenerationResultsActivePanel | null;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  threadId: string | null;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
};

export function GenerationResultsSurface({
  activePanel,
  pendingFreshThreadSubmission,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onActivePanelToggle,
}: GenerationResultsSurfaceProps) {
  return (
    <SharedGenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      pendingFreshThreadSubmission={pendingFreshThreadSubmission}
      renderAttachmentImageViewer={(props) => (
        <GenerationImageViewerModal {...props} />
      )}
      renderOutputs={(submission) => (
        <GenerationSubmissionOutputs
          isStackPanelOpen={
            activePanel?.kind === "generationOutput" &&
            activePanel.submissionId === submission.id
          }
          stackPanelId={stackPanelId}
          submission={submission}
          onStackPanelToggle={() =>
            onActivePanelToggle({
              kind: "generationOutput",
              submissionId: submission.id,
            })
          }
        />
      )}
      renderSupplemental={(submissions) => (
        <DesktopGenerationSupplementalPanels
          activePanel={activePanel}
          stackPanelId={stackPanelId}
          submissions={submissions}
          onClose={() => onActivePanelToggle(null)}
        />
      )}
      threadId={threadId}
      variant="overlay"
      onActivePanelToggle={onActivePanelToggle}
    />
  );
}

export function GenerationResults({
  activePanel,
  attachmentMediaPanelId,
  stackPanelId,
  threadId,
  onActivePanelToggle,
}: GenerationResultsProps) {
  return (
    <GenerationResultsSurface
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      pendingFreshThreadSubmission={null}
      stackPanelId={stackPanelId}
      threadId={threadId}
      onActivePanelToggle={onActivePanelToggle}
    />
  );
}

function DesktopGenerationSupplementalPanels({
  activePanel,
  stackPanelId,
  submissions,
  onClose,
}: {
  activePanel: GenerationResultsActivePanel | null;
  stackPanelId: string;
  submissions: GenerationThreadSubmission[];
  onClose: () => void;
}) {
  const activeOutputSubmission =
    activePanel?.kind === "generationOutput"
      ? (submissions.find(
          (submission) => submission.id === activePanel.submissionId,
        ) ?? null)
      : null;
  return (
    <MultiGenerationPanel
      id={stackPanelId}
      activeSubmission={activeOutputSubmission}
      onClose={onClose}
    />
  );
}

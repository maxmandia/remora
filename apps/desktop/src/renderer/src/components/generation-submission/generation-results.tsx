import { GenerationResultsSurface as SharedGenerationResultsSurface } from "@remora/app/generation";
import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";

import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";
import { MultiGenerationPanel } from "./multi-generation-panel.tsx";
import { SubmittedAttachmentMediaBadge } from "./submitted-attachment-media-badge.tsx";
import { SubmittedAttachmentMediaPanel } from "./submitted-attachment-media-panel.tsx";

export type GenerationResultsActivePanel =
  | {
      kind: "generationOutput";
      submissionId: string;
    }
  | {
      kind: "attachmentMedia";
      submissionId: string;
    };

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
      isSupplementalOpen={Boolean(activePanel)}
      pendingFreshThreadSubmission={pendingFreshThreadSubmission}
      renderMetadataAccessory={(submission) => (
        <SubmittedAttachmentMediaBadge
          attachmentMedia={submission.attachmentMedia}
          isPanelOpen={
            activePanel?.kind === "attachmentMedia" &&
            activePanel.submissionId === submission.id
          }
          panelId={attachmentMediaPanelId}
          onPanelToggle={() =>
            onActivePanelToggle({
              kind: "attachmentMedia",
              submissionId: submission.id,
            })
          }
        />
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
          attachmentMediaPanelId={attachmentMediaPanelId}
          stackPanelId={stackPanelId}
          submissions={submissions}
          onClose={() => onActivePanelToggle(null)}
        />
      )}
      threadId={threadId}
      variant="overlay"
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
  attachmentMediaPanelId,
  stackPanelId,
  submissions,
  onClose,
}: {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
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
  const activeAttachmentMediaSubmission =
    activePanel?.kind === "attachmentMedia"
      ? (submissions.find(
          (submission) => submission.id === activePanel.submissionId,
        ) ?? null)
      : null;

  return (
    <>
      <MultiGenerationPanel
        id={stackPanelId}
        activeSubmission={activeOutputSubmission}
        onClose={onClose}
      />
      <SubmittedAttachmentMediaPanel
        id={attachmentMediaPanelId}
        activeSubmission={activeAttachmentMediaSubmission}
        onClose={onClose}
      />
    </>
  );
}

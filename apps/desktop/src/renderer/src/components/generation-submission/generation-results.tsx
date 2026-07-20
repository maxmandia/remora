import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { useQuery } from "@tanstack/react-query";

import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { GenerationSubmissionRow } from "./generation-submission-row.tsx";
import { MultiGenerationPanel } from "./multi-generation-panel.tsx";
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
  if (threadId) {
    return (
      <GenerationResults
        activePanel={activePanel}
        attachmentMediaPanelId={attachmentMediaPanelId}
        stackPanelId={stackPanelId}
        threadId={threadId}
        onActivePanelToggle={onActivePanelToggle}
      />
    );
  }

  if (!pendingFreshThreadSubmission) {
    return null;
  }

  return (
    <GenerationResultsView
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      stackPanelId={stackPanelId}
      submissions={[pendingFreshThreadSubmission]}
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
  const trpc = useTRPC();
  const { data: submissions = [] } = useQuery(
    trpc.generation.listSubmissionsFromThread.queryOptions({ threadId }),
  );

  return (
    <GenerationResultsView
      activePanel={activePanel}
      attachmentMediaPanelId={attachmentMediaPanelId}
      stackPanelId={stackPanelId}
      submissions={submissions}
      onActivePanelToggle={onActivePanelToggle}
    />
  );
}

export function GenerationResultsView({
  activePanel,
  attachmentMediaPanelId,
  stackPanelId,
  submissions,
  onActivePanelToggle,
}: {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
  stackPanelId: string;
  submissions: GenerationThreadSubmission[];
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
}) {
  if (submissions.length === 0) return null;

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
  const isPanelOpen = Boolean(
    activeOutputSubmission || activeAttachmentMediaSubmission,
  );

  return (
    <section
      aria-label="Generation results"
      className="absolute inset-0 z-[2] flex min-h-[inherit] flex-col overflow-x-hidden overflow-y-auto pt-[clamp(2rem,6vh,3rem)]"
      data-slot="generation-results"
    >
      <div
        className={[
          "relative mx-auto flex min-h-0 w-[var(--remora-generation-content-width)] flex-1 flex-col",
          multiGenerationPanelShiftClassName,
        ].join(" ")}
        data-stack-panel-state={isPanelOpen ? "open" : "closed"}
        data-slot="generation-results-layout"
        style={{
          transform: getMultiGenerationPanelShiftTransform(isPanelOpen),
        }}
      >
        <div
          className="-mt-[var(--remora-preview-stack-overflow-inset)] flex flex-col gap-10 pt-[var(--remora-preview-stack-overflow-inset)]"
          data-slot="generation-results-list"
        >
          {submissions.map((submission) => (
            <GenerationSubmissionRow
              key={submission.id}
              isAttachmentMediaPanelOpen={
                activePanel?.kind === "attachmentMedia" &&
                activePanel.submissionId === submission.id
              }
              isStackPanelOpen={
                activePanel?.kind === "generationOutput" &&
                activePanel.submissionId === submission.id
              }
              attachmentMediaPanelId={attachmentMediaPanelId}
              stackPanelId={stackPanelId}
              submission={submission}
              onAttachmentMediaPanelToggle={() =>
                onActivePanelToggle({
                  kind: "attachmentMedia",
                  submissionId: submission.id,
                })
              }
              onStackPanelToggle={() =>
                onActivePanelToggle({
                  kind: "generationOutput",
                  submissionId: submission.id,
                })
              }
            />
          ))}
          <div
            aria-hidden="true"
            className="h-[var(--remora-generation-results-bottom-reserve)] shrink-0"
            data-slot="generation-results-bottom-spacer"
          />
        </div>
        <MultiGenerationPanel
          id={stackPanelId}
          activeSubmission={activeOutputSubmission}
          onClose={() => onActivePanelToggle(null)}
        />
        <SubmittedAttachmentMediaPanel
          id={attachmentMediaPanelId}
          activeSubmission={activeAttachmentMediaSubmission}
          onClose={() => onActivePanelToggle(null)}
        />
      </div>
    </section>
  );
}

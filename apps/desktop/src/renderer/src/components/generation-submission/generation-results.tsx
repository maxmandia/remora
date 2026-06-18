import type { GenerationThreadSubmission } from "@remora/backend/types";
import { useQuery } from "@tanstack/react-query";

import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/index.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { GenerationSubmissionRow } from "./generation-submission-row.tsx";
import { MultiGenerationPanel } from "./multi-generation-panel.tsx";

type GenerationResultsProps = {
  activeStackSubmissionId: string | null;
  stackPanelId: string;
  threadId: string;
  onStackSubmissionToggle: (submissionId: string | null) => void;
};

type GenerationResultsSurfaceProps = {
  activeStackSubmissionId: string | null;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  stackPanelId: string;
  threadId: string | null;
  onStackSubmissionToggle: (submissionId: string | null) => void;
};

export function GenerationResultsSurface({
  activeStackSubmissionId,
  pendingFreshThreadSubmission,
  stackPanelId,
  threadId,
  onStackSubmissionToggle,
}: GenerationResultsSurfaceProps) {
  if (threadId) {
    return (
      <GenerationResults
        activeStackSubmissionId={activeStackSubmissionId}
        stackPanelId={stackPanelId}
        threadId={threadId}
        onStackSubmissionToggle={onStackSubmissionToggle}
      />
    );
  }

  if (!pendingFreshThreadSubmission) {
    return null;
  }

  return (
    <GenerationResultsView
      activeStackSubmissionId={activeStackSubmissionId}
      stackPanelId={stackPanelId}
      submissions={[pendingFreshThreadSubmission]}
      onStackSubmissionToggle={onStackSubmissionToggle}
    />
  );
}

export function GenerationResults({
  activeStackSubmissionId,
  stackPanelId,
  threadId,
  onStackSubmissionToggle,
}: GenerationResultsProps) {
  const trpc = useTRPC();
  const { data: submissions = [] } = useQuery(
    trpc.generation.listSubmissionsFromThread.queryOptions({ threadId }),
  );

  return (
    <GenerationResultsView
      activeStackSubmissionId={activeStackSubmissionId}
      stackPanelId={stackPanelId}
      submissions={submissions}
      onStackSubmissionToggle={onStackSubmissionToggle}
    />
  );
}

export function GenerationResultsView({
  activeStackSubmissionId,
  stackPanelId,
  submissions,
  onStackSubmissionToggle,
}: {
  activeStackSubmissionId: string | null;
  stackPanelId: string;
  submissions: GenerationThreadSubmission[];
  onStackSubmissionToggle: (submissionId: string | null) => void;
}) {
  if (submissions.length === 0) return null;

  const activeStackSubmission = activeStackSubmissionId
    ? (submissions.find(
        (submission) => submission.id === activeStackSubmissionId,
      ) ?? null)
    : null;
  const isStackPanelOpen = Boolean(activeStackSubmission);

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
        data-stack-panel-state={isStackPanelOpen ? "open" : "closed"}
        data-slot="generation-results-layout"
        style={{
          transform: getMultiGenerationPanelShiftTransform(isStackPanelOpen),
        }}
      >
        <div
          className="-mt-[var(--remora-preview-stack-overflow-inset)] flex flex-col gap-10 pt-[var(--remora-preview-stack-overflow-inset)]"
          data-slot="generation-results-list"
        >
          {submissions.map((submission) => (
            <GenerationSubmissionRow
              key={submission.id}
              isStackPanelOpen={activeStackSubmissionId === submission.id}
              stackPanelId={stackPanelId}
              submission={submission}
              onStackPanelToggle={() => onStackSubmissionToggle(submission.id)}
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
          activeSubmission={activeStackSubmission}
          onClose={() => onStackSubmissionToggle(null)}
        />
      </div>
    </section>
  );
}

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
      className="relative z-[3] mx-auto flex min-h-[inherit] w-[var(--remora-generation-content-width)] flex-col pt-[clamp(2rem,6vh,3rem)] pb-[var(--remora-generation-results-bottom-reserve)]"
      data-slot="generation-results"
    >
      <div
        className={["relative flex-1", multiGenerationPanelShiftClassName].join(
          " ",
        )}
        data-stack-panel-state={isStackPanelOpen ? "open" : "closed"}
        data-slot="generation-results-layout"
        style={{
          transform: getMultiGenerationPanelShiftTransform(isStackPanelOpen),
        }}
      >
        <div
          className="flex flex-col gap-3"
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

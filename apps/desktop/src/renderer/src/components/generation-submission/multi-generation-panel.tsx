import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/backend/types";
import { Button } from "@remora/ui";
import { XIcon } from "lucide-react";

import { buildVideoPreviewStackForJob } from "../../lib/generation/index.ts";
import { TooltipWithShortcut } from "../tooltip-with-shortcut.tsx";
import { GenerationPreviewOutput } from "./generation-preview-output.tsx";

type MultiGenerationPanelProps = {
  activeSubmission: GenerationThreadSubmission | null;
  id: string;
  onClose: () => void;
};

export function MultiGenerationPanel({
  activeSubmission,
  id,
  onClose,
}: MultiGenerationPanelProps) {
  const isOpen = Boolean(activeSubmission);
  const jobs = activeSubmission
    ? listGenerationPanelJobs(activeSubmission.jobs)
    : [];

  return (
    <aside
      id={id}
      aria-hidden={!isOpen}
      aria-label="Generation stack panel"
      className="bg-card border-surface-strong pointer-events-none absolute top-0 bottom-[var(--remora-generation-composer-bottom-inset)] left-[calc(100%+var(--remora-generation-stack-panel-gap))] flex w-[var(--remora-generation-stack-panel-width)] translate-x-3 scale-[0.98] flex-col overflow-hidden rounded-lg border-[.5px] p-3 opacity-0 transition-[opacity,transform] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[opacity,transform] group-data-[state=collapsed]/sidebar-wrapper:w-[var(--remora-generation-stack-panel-expanded-width)] data-[state=open]:pointer-events-auto data-[state=open]:translate-x-0 data-[state=open]:scale-100 data-[state=open]:opacity-100 motion-reduce:transition-none"
      data-active-submission-id={activeSubmission?.id ?? undefined}
      data-slot="generation-stack-panel"
      data-state={isOpen ? "open" : "closed"}
    >
      <div className="flex shrink-0 justify-between">
        <div className="mt-1">
          <span className="text-foreground m-1 text-[15px] font-light">
            Generations
          </span>
        </div>
        <TooltipWithShortcut
          commandId="generation.closeStackPanel"
          side="left"
          sideOffset={8}
          text="Close panel"
        >
          <Button
            aria-label="Close generation panel"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <XIcon className="text-secondary-foreground" />
          </Button>
        </TooltipWithShortcut>
      </div>
      <div
        className="-mr-2 grid min-h-0 flex-1 auto-rows-max content-start gap-2 overflow-x-hidden overflow-y-auto pr-2"
        data-slot="generation-stack-panel-jobs"
      >
        {activeSubmission
          ? jobs.map((job) => (
              <SubmissionPreviewWrapper
                key={job.id}
                aspectRatio={activeSubmission.submittedInput.aspectRatio}
                job={job}
              />
            ))
          : null}
      </div>
    </aside>
  );
}

function listGenerationPanelJobs(jobs: GenerationThreadSubmissionJob[]) {
  return [...jobs].sort(
    (leftJob, rightJob) => leftJob.submissionIndex - rightJob.submissionIndex,
  );
}

function SubmissionPreviewWrapper({
  aspectRatio,
  job,
}: {
  aspectRatio: string;
  job: GenerationThreadSubmissionJob;
}) {
  return (
    <GenerationPreviewOutput
      aspectRatio={aspectRatio}
      previewStack={buildVideoPreviewStackForJob(job)}
    />
  );
}

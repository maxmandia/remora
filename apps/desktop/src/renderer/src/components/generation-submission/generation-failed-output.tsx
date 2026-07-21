import type { GenerationThreadSubmissionJob } from "@remora/domain/generation-submission/dto";
import { Tooltip, TooltipContent, TooltipTrigger } from "@remora/ui";
import { TriangleAlertIcon } from "lucide-react";

import { dotFieldSkeletonVisibleInset } from "./dot-field-skeleton.tsx";

export function GenerationFailedOutput({
  job,
  responsive = false,
}: {
  job: GenerationThreadSubmissionJob;
  responsive?: boolean;
}) {
  const errorMessage =
    job.terminalError?.message?.trim() ||
    job.result?.providerError?.message?.trim() ||
    "The generation could not be completed.";

  return (
    <div
      className={[
        "relative shrink-0",
        responsive ? "aspect-square w-full max-w-40" : "size-40",
      ].join(" ")}
      data-testid="generation-thread-job"
    >
      <Tooltip delay={0}>
        <TooltipTrigger
          render={
            <div
              aria-description={errorMessage}
              aria-label="Generation failed"
              className="bg-card focus-visible:ring-ring absolute grid place-items-center rounded-md outline-none focus-visible:ring-1"
              data-slot="generation-submission-failed-output"
              role="status"
              style={{ inset: dotFieldSkeletonVisibleInset }}
              tabIndex={0}
            >
              <TriangleAlertIcon
                aria-hidden="true"
                className="text-muted-foreground size-4"
                data-slot="generation-submission-failed-output-icon"
              />
            </div>
          }
        />
        <TooltipContent
          className="flex-col items-start gap-0.5"
          data-surface="card"
        >
          <span className="text-foreground font-medium">Generation failed</span>
          <span>{errorMessage}</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

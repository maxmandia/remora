import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { isTerminalGenerationJobStatus } from "@remora/domain/generation-submission/helpers";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@remora/ui";
import { BrushCleaningIcon, EllipsisIcon, RotateCcwIcon } from "lucide-react";
import { useState } from "react";

import { useRetryGenerationSubmissionMutation } from "../../hooks/use-retry-generation-submission-mutation.ts";
import { isFluxGenerationDraftSubmission } from "../../lib/generation/generation-draft-enhancement.ts";
import { isOptimisticGenerationSubmission } from "../../lib/generation/generation-submission-cache.ts";
import { EnhanceGenerationDraftDialog } from "./enhance-generation-draft-dialog.tsx";

export function GenerationSubmissionActionMenu({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  const { isPending, retryGeneration } = useRetryGenerationSubmissionMutation();
  const [isEnhanceDialogOpen, setIsEnhanceDialogOpen] = useState(false);
  const isDisabled = isPending || isOptimisticGenerationSubmission(submission);
  const canEnhanceDraft =
    isFluxGenerationDraftSubmission(submission) &&
    submission.jobs.length > 0 &&
    submission.jobs.every((job) => isTerminalGenerationJobStatus(job.status)) &&
    submission.jobs.some((job) => job.status === "succeeded");

  return (
    <div
      className="mb-3 shrink-0 self-end"
      data-slot="generation-submission-actions"
    >
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Submission actions"
              className="text-secondary-foreground"
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <EllipsisIcon />
            </Button>
          }
        />
        <DropdownMenuContent className="w-max" align="end">
          <DropdownMenuItem
            disabled={isDisabled}
            onClick={() => {
              void retryGeneration(submission).catch(() => undefined);
            }}
          >
            <RotateCcwIcon />
            Retry
          </DropdownMenuItem>
          {canEnhanceDraft ? (
            <DropdownMenuItem
              className="whitespace-nowrap"
              disabled={isOptimisticGenerationSubmission(submission)}
              onClick={() => setIsEnhanceDialogOpen(true)}
            >
              <BrushCleaningIcon />
              Enhance draft
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {canEnhanceDraft ? (
        <EnhanceGenerationDraftDialog
          onOpenChange={setIsEnhanceDialogOpen}
          open={isEnhanceDialogOpen}
          submission={submission}
        />
      ) : null}
    </div>
  );
}

import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@remora/ui";
import { EllipsisIcon, RotateCcwIcon } from "lucide-react";

import { useRetryGenerationSubmissionMutation } from "../../hooks/use-retry-generation-submission-mutation.ts";
import { isOptimisticGenerationSubmission } from "../../lib/generation/generation-submission-cache.ts";

export function GenerationSubmissionActionMenu({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  const { isPending, retryGeneration } = useRetryGenerationSubmissionMutation();
  const isDisabled = isPending || isOptimisticGenerationSubmission(submission);

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
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            disabled={isDisabled}
            onClick={() => {
              void retryGeneration(submission).catch(() => undefined);
            }}
          >
            <RotateCcwIcon />
            Retry
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

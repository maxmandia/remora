import type {
  GenerationThreadSubmission,
  GenerationThreadSubmissionJob,
} from "@remora/domain/generation-submission/dto";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@remora/ui";
import { BrushCleaningIcon } from "lucide-react";
import { useState, type ReactElement } from "react";

import { isFluxGenerationDraftSubmission } from "../../lib/generation/generation-draft-enhancement.ts";
import { EnhanceGenerationDraftDialog } from "./enhance-generation-draft-dialog.tsx";

export function EnhanceGenerationDraftContextMenu({
  children,
  hasDisplayableResult,
  job,
  submission,
}: {
  children: ReactElement;
  hasDisplayableResult: boolean;
  job: GenerationThreadSubmissionJob;
  submission: GenerationThreadSubmission;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const canEnhanceDraft =
    isFluxGenerationDraftSubmission(submission) &&
    job.submissionId === submission.id &&
    job.status === "succeeded" &&
    hasDisplayableResult;

  if (!canEnhanceDraft) {
    return children;
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger
          render={<div className="contents">{children}</div>}
        />
        <ContextMenuContent>
          <ContextMenuItem onClick={() => setIsDialogOpen(true)}>
            <BrushCleaningIcon />
            Enhance draft
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      <EnhanceGenerationDraftDialog
        onOpenChange={setIsDialogOpen}
        open={isDialogOpen}
        sourceJobId={job.id}
        submission={submission}
      />
    </>
  );
}

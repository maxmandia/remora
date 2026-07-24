import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { Button, cn } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/generation-preview.ts";
import { useTRPC } from "../../trpc.ts";
import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionPreviewGrid } from "./generation-submission-preview-grid.tsx";

export type GenerationResultsSurfaceVariant = "flow" | "overlay";

export type GenerationResultsSurfaceProps = {
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  threadId: string | null;
  variant: GenerationResultsSurfaceVariant;
  isSupplementalOpen?: boolean;
  renderMetadataAccessory?: (
    submission: GenerationThreadSubmission,
  ) => ReactNode;
  renderOutputs?: (submission: GenerationThreadSubmission) => ReactNode;
  renderSupplemental?: (submissions: GenerationThreadSubmission[]) => ReactNode;
};

export function GenerationResultsSurface({
  pendingFreshThreadSubmission,
  threadId,
  ...props
}: GenerationResultsSurfaceProps) {
  if (threadId) {
    return <ThreadGenerationResults threadId={threadId} {...props} />;
  }

  if (!pendingFreshThreadSubmission) {
    return null;
  }

  return (
    <GenerationResultsView
      submissions={[pendingFreshThreadSubmission]}
      {...props}
    />
  );
}

function ThreadGenerationResults({
  threadId,
  ...props
}: Omit<
  GenerationResultsSurfaceProps,
  "pendingFreshThreadSubmission" | "threadId"
> & {
  threadId: string;
}) {
  const trpc = useTRPC();
  const query = useQuery(
    trpc.generation.listSubmissionsFromThread.queryOptions(
      { threadId },
      { meta: { suppressErrorToast: true } },
    ),
  );

  if (query.isPending) {
    return (
      <GenerationResultsStatus variant={props.variant}>
        <p role="status">Loading generations...</p>
      </GenerationResultsStatus>
    );
  }

  if (query.isError) {
    return (
      <GenerationResultsStatus variant={props.variant}>
        <div className="flex flex-col items-center gap-3" role="alert">
          <p>Unable to load generations.</p>
          <Button
            onClick={() => void query.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </GenerationResultsStatus>
    );
  }

  return <GenerationResultsView submissions={query.data} {...props} />;
}

function GenerationResultsStatus({
  children,
  variant,
}: {
  children: ReactNode;
  variant: GenerationResultsSurfaceVariant;
}) {
  return (
    <section
      aria-label="Generation results"
      className={cn(
        "text-secondary-foreground grid min-h-40 place-items-center text-center text-sm",
        variant === "overlay" &&
          "absolute inset-0 z-[2] overflow-hidden pt-[clamp(2rem,6vh,3rem)]",
      )}
      data-slot="generation-results"
      data-variant={variant}
    >
      {children}
    </section>
  );
}

function GenerationResultsView({
  isSupplementalOpen = false,
  renderMetadataAccessory,
  renderOutputs,
  renderSupplemental,
  submissions,
  variant,
}: Omit<
  GenerationResultsSurfaceProps,
  "pendingFreshThreadSubmission" | "threadId"
> & {
  submissions: GenerationThreadSubmission[];
}) {
  if (submissions.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Generation results"
      className={cn(
        variant === "overlay"
          ? "absolute inset-0 z-[2] flex min-h-[inherit] flex-col overflow-x-hidden overflow-y-auto pt-[clamp(2rem,6vh,3rem)]"
          : "w-full",
      )}
      data-slot="generation-results"
      data-variant={variant}
    >
      <div
        className={cn(
          "relative flex min-h-0 flex-1 flex-col",
          variant === "overlay" && [
            "mx-auto w-[var(--remora-generation-content-width)]",
            multiGenerationPanelShiftClassName,
          ],
        )}
        data-stack-panel-state={isSupplementalOpen ? "open" : "closed"}
        data-slot="generation-results-layout"
        style={
          variant === "overlay"
            ? {
                transform:
                  getMultiGenerationPanelShiftTransform(isSupplementalOpen),
              }
            : undefined
        }
      >
        <div
          className={cn(
            "flex flex-col gap-10",
            variant === "overlay" &&
              "-mt-[var(--remora-preview-stack-overflow-inset)] pt-[var(--remora-preview-stack-overflow-inset)]",
          )}
          data-slot="generation-results-list"
        >
          {submissions.map((submission) => (
            <article
              className="flex w-full flex-nowrap items-start gap-6"
              data-slot="generation-submission-row"
              key={submission.id}
            >
              {renderOutputs ? (
                renderOutputs(submission)
              ) : (
                <GenerationSubmissionPreviewGrid submission={submission} />
              )}
              <GenerationResultSubmittedInput
                metadataAccessory={renderMetadataAccessory?.(submission)}
                submission={submission}
              />
            </article>
          ))}
          {variant === "overlay" ? (
            <div
              aria-hidden="true"
              className="h-[var(--remora-generation-results-bottom-reserve)] shrink-0"
              data-slot="generation-results-bottom-spacer"
            />
          ) : null}
        </div>
        {renderSupplemental?.(submissions)}
      </div>
    </section>
  );
}

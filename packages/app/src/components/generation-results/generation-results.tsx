import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { Button, cn } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/generation-preview.ts";
import { useTRPC } from "../../trpc.ts";
import type { GenerationResultsActivePanel } from "../../hooks/use-generation-results-panel-controller.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionPreviewGrid } from "./generation-submission-preview-grid.tsx";
import { SubmittedAttachmentMediaBadge } from "./submitted-attachment-media-badge.tsx";
import { SubmittedAttachmentMediaPanel } from "./submitted-attachment-media-panel.tsx";

export type GenerationResultsSurfaceVariant = "flow" | "overlay";

export type GenerationResultsSurfaceProps = {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  threadId: string | null;
  variant: GenerationResultsSurfaceVariant;
  renderAttachmentImageViewer?: GenerationImageViewerRenderer;
  renderMetadataAccessory?: (
    submission: GenerationThreadSubmission,
  ) => ReactNode;
  renderOutputs?: (submission: GenerationThreadSubmission) => ReactNode;
  renderSupplemental?: (submissions: GenerationThreadSubmission[]) => ReactNode;
  onActivePanelToggle: (panel: GenerationResultsActivePanel | null) => void;
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
  activePanel,
  attachmentMediaPanelId,
  renderAttachmentImageViewer,
  renderMetadataAccessory,
  renderOutputs,
  renderSupplemental,
  submissions,
  variant,
  onActivePanelToggle,
}: Omit<
  GenerationResultsSurfaceProps,
  "pendingFreshThreadSubmission" | "threadId"
> & {
  submissions: GenerationThreadSubmission[];
}) {
  if (submissions.length === 0) {
    return null;
  }

  const activeAttachmentMediaSubmission =
    activePanel?.kind === "attachmentMedia"
      ? (submissions.find(
          (submission) => submission.id === activePanel.submissionId,
        ) ?? null)
      : null;
  const isSupplementalOpen = Boolean(activePanel);

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
                metadataAccessory={
                  <>
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
                    {renderMetadataAccessory?.(submission)}
                  </>
                }
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
        <SubmittedAttachmentMediaPanel
          activeSubmission={activeAttachmentMediaSubmission}
          id={attachmentMediaPanelId}
          renderImageViewer={renderAttachmentImageViewer}
          onClose={() => onActivePanelToggle(null)}
        />
      </div>
    </section>
  );
}

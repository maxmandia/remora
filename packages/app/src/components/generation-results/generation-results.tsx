import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { Button, cn } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import type { GenerationResultsActivePanel } from "../../hooks/use-generation-results-panel-controller.ts";
import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/generation-preview.ts";
import type { GeneratedImageContextMenuActions } from "../../lib/generation/generated-image.ts";
import { useTRPC } from "../../trpc.ts";
import type { GenerationImageViewerRenderer } from "./generation-image-viewer-modal.tsx";
import type { GeneratedImageContextMenuHandler } from "./generation-preview-tile.tsx";
import { GenerationResultSubmittedInput } from "./generation-result-submitted-input.tsx";
import { GenerationSubmissionOutputs } from "./generation-submission-outputs.tsx";
import { GenerationSubmissionActionMenu } from "./generation-submission-action-menu.tsx";
import type { GenerationVideoPlaybackRenderer } from "./generation-video-playback-modal.tsx";
import { MultiGenerationPanel } from "./multi-generation-panel.tsx";
import { SubmittedAttachmentMediaBadge } from "./submitted-attachment-media-badge.tsx";
import { SubmittedAttachmentMediaPanel } from "./submitted-attachment-media-panel.tsx";

export type GenerationResultsSurfaceVariant = "flow" | "overlay";

export type GenerationResultsSurfaceProps = {
  activePanel: GenerationResultsActivePanel | null;
  attachmentMediaPanelId: string;
  generatedImageContextMenu?: GeneratedImageContextMenuActions;
  pendingFreshThreadSubmission: GenerationThreadSubmission | null;
  stackPanelId: string;
  threadId: string | null;
  variant: GenerationResultsSurfaceVariant;
  onGeneratedImageContextMenu?: GeneratedImageContextMenuHandler;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
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
          "absolute inset-x-0 top-0 bottom-[var(--remora-generation-results-bottom-reserve)] z-[2] overflow-hidden pt-[clamp(2rem,6vh,3rem)]",
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
  generatedImageContextMenu,
  onGeneratedImageContextMenu,
  renderImageViewer,
  renderVideoViewer,
  stackPanelId,
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
  const activeOutputSubmission =
    activePanel?.kind === "generationOutput"
      ? (submissions.find(
          (submission) => submission.id === activePanel.submissionId,
        ) ?? null)
      : null;
  const isSupplementalOpen = Boolean(
    activeAttachmentMediaSubmission || activeOutputSubmission,
  );

  return (
    <section
      aria-label="Generation results"
      className={cn(
        variant === "overlay"
          ? "absolute inset-x-0 top-0 bottom-[var(--remora-generation-results-bottom-reserve)] z-[2] flex min-h-0 flex-col overflow-hidden pt-[clamp(2rem,6vh,3rem)]"
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
              "-mt-[var(--remora-preview-stack-overflow-inset)] min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pt-[var(--remora-preview-stack-overflow-inset)]",
          )}
          data-slot="generation-results-list"
        >
          {submissions.map((submission) => (
            <article
              className="flex w-full shrink-0 flex-nowrap items-start gap-6"
              data-slot="generation-submission-row"
              key={submission.id}
            >
              <GenerationSubmissionOutputs
                generatedImageContextMenu={generatedImageContextMenu}
                isStackPanelOpen={
                  activePanel?.kind === "generationOutput" &&
                  activePanel.submissionId === submission.id
                }
                onGeneratedImageContextMenu={onGeneratedImageContextMenu}
                renderImageViewer={renderImageViewer}
                renderVideoViewer={renderVideoViewer}
                stackPanelId={stackPanelId}
                submission={submission}
                onStackPanelToggle={() =>
                  onActivePanelToggle({
                    kind: "generationOutput",
                    submissionId: submission.id,
                  })
                }
              />
              <GenerationResultSubmittedInput
                metadataAccessory={
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
                }
                submission={submission}
              />
              <GenerationSubmissionActionMenu submission={submission} />
            </article>
          ))}
        </div>
        <MultiGenerationPanel
          activeSubmission={activeOutputSubmission}
          generatedImageContextMenu={generatedImageContextMenu}
          id={stackPanelId}
          onGeneratedImageContextMenu={onGeneratedImageContextMenu}
          renderImageViewer={renderImageViewer}
          renderVideoViewer={renderVideoViewer}
          onClose={() => onActivePanelToggle(null)}
        />
        <SubmittedAttachmentMediaPanel
          activeSubmission={activeAttachmentMediaSubmission}
          id={attachmentMediaPanelId}
          renderImageViewer={renderImageViewer}
          onClose={() => onActivePanelToggle(null)}
        />
      </div>
    </section>
  );
}

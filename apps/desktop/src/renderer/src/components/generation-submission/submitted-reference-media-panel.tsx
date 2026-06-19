import type {
  GenerationThreadSubmission,
  SignedGenerationThreadReferenceMedia,
} from "@remora/backend/types";
import { useQuery } from "@tanstack/react-query";
import { AudioLinesIcon, FileQuestionIcon } from "lucide-react";

import { useTRPC } from "../../lib/trpc.ts";
import { dotFieldSkeletonVisibleInset } from "./dot-field-skeleton.tsx";
import { GenerationSubmissionSidePanel } from "./generation-submission-side-panel.tsx";

type SubmittedReferenceMediaPanelProps = {
  activeSubmission: GenerationThreadSubmission | null;
  id: string;
  onClose: () => void;
};

export function SubmittedReferenceMediaPanel({
  activeSubmission,
  id,
  onClose,
}: SubmittedReferenceMediaPanelProps) {
  const trpc = useTRPC();
  const isOpen = Boolean(activeSubmission);
  const { data: referenceMedia = [] } = useQuery(
    trpc.generation.listReferenceMediaFromSubmission.queryOptions(
      { submissionId: activeSubmission?.id ?? "" },
      { enabled: isOpen },
    ),
  );

  return (
    <GenerationSubmissionSidePanel
      activeSubmissionId={activeSubmission?.id}
      ariaLabel="Reference media panel"
      closeAriaLabel="Close reference media panel"
      contentAriaLabel="Submitted reference media"
      contentElement="ul"
      contentSlot="submitted-reference-media-panel-items"
      id={id}
      isOpen={isOpen}
      panelSlot="submitted-reference-media-panel"
      title="Reference media"
      onClose={onClose}
    >
      {isOpen
        ? referenceMedia.map((media) => (
            <SubmittedReferenceMediaPanelItem key={media.id} media={media} />
          ))
        : null}
    </GenerationSubmissionSidePanel>
  );
}

function SubmittedReferenceMediaPanelItem({
  media,
}: {
  media: SignedGenerationThreadReferenceMedia;
}) {
  const fileName = media.originalFileName || "Untitled media";

  return (
    <li
      className="relative -mt-[var(--remora-preview-stack-overflow-inset)] shrink-0 pt-[var(--remora-preview-stack-overflow-inset)] pr-[var(--remora-preview-stack-overflow-inset)]"
      data-media-kind={media.kind}
      data-slot="submitted-reference-media-panel-item"
    >
      <div className="relative size-40">
        <div
          className="bg-muted absolute overflow-hidden rounded-md shadow-[0_8px_20px_rgb(0_0_0_/_0.24)] ring-1 ring-white/10"
          data-slot="submitted-reference-media-panel-item-frame"
          style={{ inset: dotFieldSkeletonVisibleInset }}
        >
          {renderReferenceMediaContent(media, fileName)}
        </div>
      </div>
    </li>
  );
}

function renderReferenceMediaContent(
  media: SignedGenerationThreadReferenceMedia,
  fileName: string,
) {
  switch (media.kind) {
    case "image":
      return (
        <img
          alt={`Reference image: ${fileName}`}
          className="size-full object-cover select-none"
          draggable={false}
          src={media.url}
        />
      );
    case "video":
      return (
        <video
          aria-label={`Reference video: ${fileName}`}
          className="size-full object-cover"
          controls
          playsInline
          preload="metadata"
          src={media.url}
        />
      );
    case "audio":
      return (
        <div className="text-secondary-foreground flex size-full flex-col items-center justify-center gap-3 p-3">
          <AudioLinesIcon aria-hidden="true" className="size-8" />
          <span className="line-clamp-2 max-w-full text-center text-xs break-words">
            {fileName}
          </span>
          <audio
            aria-label={`Reference audio: ${fileName}`}
            className="w-full"
            controls
            preload="metadata"
            src={media.url}
          />
        </div>
      );
    default:
      return (
        <div className="text-secondary-foreground flex size-full items-center justify-center">
          <FileQuestionIcon aria-hidden="true" className="size-8" />
        </div>
      );
  }
}

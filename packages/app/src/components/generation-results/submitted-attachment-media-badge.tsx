import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { Badge, cn } from "@remora/ui";
import { PaperclipIcon } from "lucide-react";

export function SubmittedAttachmentMediaBadge({
  className,
  isPanelOpen,
  panelId,
  onPanelToggle,
  attachmentMedia,
}: {
  className?: string;
  isPanelOpen: boolean;
  panelId: string;
  onPanelToggle: () => void;
  attachmentMedia: GenerationThreadSubmission["attachmentMedia"];
}) {
  const hasAttachmentMedia = Object.values(attachmentMedia ?? {}).some(
    (items) => items.length > 0,
  );

  if (!hasAttachmentMedia) {
    return null;
  }

  return (
    <Badge
      aria-controls={panelId}
      aria-expanded={isPanelOpen}
      aria-label={isPanelOpen ? "Close attachments" : "Open attachments"}
      className={cn(
        "appearance-none outline-none focus-visible:border-transparent focus-visible:ring-0",
        className,
      )}
      render={<button type="button" onClick={onPanelToggle} />}
      variant="surface"
    >
      <PaperclipIcon />
      <span>Attachments</span>
    </Badge>
  );
}

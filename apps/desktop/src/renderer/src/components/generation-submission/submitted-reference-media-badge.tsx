import type { GenerationThreadSubmission } from "@remora/backend/types";
import { Badge, cn } from "@remora/ui";
import { PaperclipIcon } from "lucide-react";

export function SubmittedReferenceMediaBadge({
  className,
  isPanelOpen,
  panelId,
  onPanelToggle,
  referenceMedia,
}: {
  className?: string;
  isPanelOpen: boolean;
  panelId: string;
  onPanelToggle: () => void;
  referenceMedia: GenerationThreadSubmission["referenceMedia"];
}) {
  const hasReferenceMedia = Object.values(referenceMedia ?? {}).some(
    (items) => items.length > 0,
  );

  if (!hasReferenceMedia) {
    return null;
  }

  return (
    <Badge
      aria-controls={panelId}
      aria-expanded={isPanelOpen}
      aria-label={
        isPanelOpen ? "Close reference media" : "Open reference media"
      }
      className={cn(
        "cursor-pointer appearance-none outline-none focus-visible:border-transparent focus-visible:ring-0",
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

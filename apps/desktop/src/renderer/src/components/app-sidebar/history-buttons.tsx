import { Button } from "@remora/ui";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";

import { useNavigationHistoryControls } from "../../providers/navigation-history-controls.ts";
import { TooltipWithShortcut } from "../tooltip-with-shortcut.tsx";

export function HistoryButtons() {
  const { canNavigateBack, canNavigateForward, goBack, goForward } =
    useNavigationHistoryControls();

  return (
    <div className="pointer-events-auto flex shrink-0 items-center">
      <TooltipWithShortcut
        commandId="navigation.back"
        side="right"
        sideOffset={8}
        text="Back"
      >
        <Button
          aria-disabled={!canNavigateBack}
          aria-label="Back"
          size="icon-sm"
          type="button"
          variant="ghost"
          className="text-secondary-foreground aria-disabled:opacity-50"
          onClick={goBack}
        >
          <ArrowLeftIcon />
        </Button>
      </TooltipWithShortcut>
      <TooltipWithShortcut
        commandId="navigation.forward"
        side="right"
        sideOffset={8}
        text="Forward"
      >
        <Button
          aria-disabled={!canNavigateForward}
          aria-label="Forward"
          size="icon-sm"
          type="button"
          variant="ghost"
          className="text-secondary-foreground aria-disabled:opacity-50"
          onClick={goForward}
        >
          <ArrowRightIcon />
        </Button>
      </TooltipWithShortcut>
    </div>
  );
}

import { Button, cn } from "@remora/ui";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import {
  TooltipWithShortcut,
  type TooltipWithShortcutProps,
} from "../hotkeys/tooltip-with-shortcut.tsx";

type NavigationHistoryButtonsProps = Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
> & {
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  tooltipAlign?: TooltipWithShortcutProps["align"];
  tooltipAlignOffset?: TooltipWithShortcutProps["alignOffset"];
  tooltipSide?: TooltipWithShortcutProps["side"];
  tooltipSideOffset?: TooltipWithShortcutProps["sideOffset"];
  onBack: () => void;
  onForward: () => void;
};

function NavigationHistoryButtons({
  canNavigateBack,
  canNavigateForward,
  className,
  tooltipAlign,
  tooltipAlignOffset,
  tooltipSide = "right",
  tooltipSideOffset = 8,
  onBack,
  onForward,
  ...props
}: NavigationHistoryButtonsProps) {
  return (
    <div
      {...props}
      className={cn(
        "pointer-events-auto flex shrink-0 items-center",
        className,
      )}
    >
      <TooltipWithShortcut
        align={tooltipAlign}
        alignOffset={tooltipAlignOffset}
        commandId="navigation.back"
        side={tooltipSide}
        sideOffset={tooltipSideOffset}
        text="Back"
      >
        <Button
          aria-disabled={!canNavigateBack}
          aria-label="Back"
          className="text-secondary-foreground aria-disabled:opacity-50"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={canNavigateBack ? onBack : undefined}
        >
          <ArrowLeftIcon />
        </Button>
      </TooltipWithShortcut>
      <TooltipWithShortcut
        align={tooltipAlign}
        alignOffset={tooltipAlignOffset}
        commandId="navigation.forward"
        side={tooltipSide}
        sideOffset={tooltipSideOffset}
        text="Forward"
      >
        <Button
          aria-disabled={!canNavigateForward}
          aria-label="Forward"
          className="text-secondary-foreground aria-disabled:opacity-50"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={canNavigateForward ? onForward : undefined}
        >
          <ArrowRightIcon />
        </Button>
      </TooltipWithShortcut>
    </div>
  );
}

export { NavigationHistoryButtons };
export type { NavigationHistoryButtonsProps };

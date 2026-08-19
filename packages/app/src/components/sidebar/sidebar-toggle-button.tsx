import { Button, cn, useSidebar } from "@remora/ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";

import { useHotkey } from "../../providers/hotkeys-provider.tsx";
import {
  TooltipWithShortcut,
  type TooltipWithShortcutProps,
} from "../hotkeys/tooltip-with-shortcut.tsx";

type SidebarToggleButtonProps = Omit<
  ComponentPropsWithoutRef<typeof Button>,
  "aria-label" | "children" | "className" | "onClick" | "size" | "variant"
> & {
  className?: string;
  tooltipAlign?: TooltipWithShortcutProps["align"];
  tooltipAlignOffset?: TooltipWithShortcutProps["alignOffset"];
  tooltipSide?: TooltipWithShortcutProps["side"];
  tooltipSideOffset?: TooltipWithShortcutProps["sideOffset"];
};

function SidebarToggleButton({
  className,
  tooltipAlign,
  tooltipAlignOffset,
  tooltipSide = "right",
  tooltipSideOffset = 8,
  ...props
}: SidebarToggleButtonProps) {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";
  const Icon = isExpanded ? PanelLeftClose : PanelLeftOpen;
  const tooltipText = isExpanded ? "Hide sidebar" : "Show sidebar";

  useHotkey("app.toggleSidebar", {
    onKeyDown: toggleSidebar,
  });

  return (
    <TooltipWithShortcut
      align={tooltipAlign}
      alignOffset={tooltipAlignOffset}
      commandId="app.toggleSidebar"
      side={tooltipSide}
      sideOffset={tooltipSideOffset}
      text={tooltipText}
    >
      <Button
        {...props}
        aria-label={tooltipText}
        className={cn(
          "text-secondary-foreground hover:text-secondary-foreground hover:bg-transparent",
          className,
        )}
        size="icon"
        variant="ghost"
        onClick={toggleSidebar}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </Button>
    </TooltipWithShortcut>
  );
}

export { SidebarToggleButton };
export type { SidebarToggleButtonProps };

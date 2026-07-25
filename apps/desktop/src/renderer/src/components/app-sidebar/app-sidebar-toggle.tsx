import { TooltipWithShortcut, useHotkey } from "@remora/app/hotkeys";
import { Button, useSidebar } from "@remora/ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { CSSProperties } from "react";

const titlebarControlStyle = {
  WebkitAppRegion: "no-drag",
} as CSSProperties;

export function AppSidebarToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isExpanded = state === "expanded";
  const Icon = isExpanded ? PanelLeftClose : PanelLeftOpen;
  const tooltipText = isExpanded ? "Hide sidebar" : "Show sidebar";

  useHotkey("app.toggleSidebar", {
    allowInEditable: true,
    onKeyDown: toggleSidebar,
  });

  return (
    <TooltipWithShortcut
      commandId="app.toggleSidebar"
      side="right"
      sideOffset={8}
      text={tooltipText}
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label={tooltipText}
        onClick={toggleSidebar}
        className="text-secondary-foreground hover:text-secondary-foreground hover:bg-transparent"
        style={titlebarControlStyle}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </Button>
    </TooltipWithShortcut>
  );
}

import { useSidebar } from "@remora/ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { CSSProperties } from "react";

import { useHotkey } from "../../providers/hotkeys-provider.tsx";
import { TooltipWithShortcut } from "../tooltip-with-shortcut.tsx";

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
      <button
        type="button"
        aria-label={tooltipText}
        onClick={toggleSidebar}
        className="text-muted-foreground pointer-events-auto inline-flex size-6 shrink-0 appearance-none items-center justify-center border-0 bg-transparent p-0 shadow-none transition-[color,transform] duration-150 ease-out focus-visible:outline-none active:scale-95"
        style={titlebarControlStyle}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </button>
    </TooltipWithShortcut>
  );
}

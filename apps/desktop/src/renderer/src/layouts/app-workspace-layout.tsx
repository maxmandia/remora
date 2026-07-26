import {
  NavigationHistoryButtons,
  useNavigationHistoryHotkeys,
} from "@remora/app/navigation";
import { SidebarToggleButton } from "@remora/app/sidebar";
import { cn, SidebarInset, SidebarProvider } from "@remora/ui";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { DesktopUpdateButton } from "../components/app-sidebar/desktop-update-button.tsx";
import { useNavigationHistoryControls } from "../providers/navigation-history-controls.ts";
import { useDesktopPreferencesStore } from "../stores/preferences-store.ts";

type AppWorkspaceLayoutProps = Omit<
  ComponentPropsWithoutRef<typeof SidebarProvider>,
  "defaultOpen" | "onOpenChange" | "open" | "style"
> & {
  children: ReactNode;
  mainAriaLabel?: string;
  sidebar: ReactNode;
  style?: CSSProperties;
};

const appWorkspaceLayoutStyle = {
  "--sidebar-width": "var(--remora-sidebar-width)",
  "--workspace-sidebar-header-offset": "var(--remora-titlebar-height)",
} as CSSProperties;

const titlebarDragRegionStyle = {
  WebkitAppRegion: "drag",
} as CSSProperties;

const titlebarControlStyle = {
  WebkitAppRegion: "no-drag",
} as CSSProperties;

export function AppWorkspaceLayout({
  children,
  className,
  mainAriaLabel = "Generation workspace",
  sidebar,
  style,
  ...props
}: AppWorkspaceLayoutProps) {
  const open = useDesktopPreferencesStore((state) => state.sidebarOpen);
  const setOpen = useDesktopPreferencesStore((state) => state.setSidebarOpen);
  const {
    canNavigateBack,
    canNavigateForward,
    goBack,
    goForward,
    isNavigationEnabled,
  } = useNavigationHistoryControls();

  useNavigationHistoryHotkeys({
    enabled: isNavigationEnabled,
    onBack: goBack,
    onForward: goForward,
  });

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "remora-app-workspace relative isolate grid h-full min-h-0 grid-cols-[var(--sidebar-width)_minmax(0,1fr)] overflow-hidden bg-transparent text-[#f4eeee] transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=collapsed]:grid-cols-[0rem_minmax(0,1fr)] motion-reduce:transition-none",
        className,
      )}
      style={{ ...appWorkspaceLayoutStyle, ...style }}
      {...props}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 z-20 h-[var(--remora-titlebar-height)]"
        style={titlebarDragRegionStyle}
      />
      <div
        className="absolute -top-[3.25px] left-[5rem] z-30 flex h-[var(--remora-titlebar-height)] w-[calc(var(--sidebar-width)-5rem)] items-center pr-2.5 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=collapsed]/sidebar-wrapper:w-[10rem] motion-reduce:transition-none"
        data-slot="app-titlebar-controls"
      >
        <div className="flex shrink-0 items-center gap-[2px]">
          <SidebarToggleButton
            tooltipSide="right"
            tooltipSideOffset={8}
            style={titlebarControlStyle}
          />
          <DesktopUpdateButton />
        </div>
        <div
          aria-hidden="true"
          className="min-w-[2px] grow transition-[flex-grow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=collapsed]/sidebar-wrapper:grow-0 motion-reduce:transition-none"
          data-slot="app-titlebar-controls-spacer"
        />
        <NavigationHistoryButtons
          canNavigateBack={canNavigateBack}
          canNavigateForward={canNavigateForward}
          tooltipSide="right"
          tooltipSideOffset={8}
          onBack={goBack}
          onForward={goForward}
        />
      </div>
      {sidebar}
      <SidebarInset
        className="relative z-10 min-h-0 min-w-0 overflow-auto bg-[var(--remora-stage-background)] pt-[var(--remora-titlebar-height)] shadow-[-1px_0_rgb(0_0_0/0.18)]"
        aria-label={mainAriaLabel}
      >
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

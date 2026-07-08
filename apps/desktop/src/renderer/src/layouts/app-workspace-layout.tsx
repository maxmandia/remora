import { cn, SidebarInset, SidebarProvider } from "@remora/ui";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { AppSidebarToggle } from "../components/app-sidebar/app-sidebar-toggle.tsx";
import { DesktopUpdateButton } from "../components/app-sidebar/desktop-update-button.tsx";
import { HistoryButtons } from "../components/app-sidebar/history-buttons.tsx";
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
} as CSSProperties;

const titlebarDragRegionStyle = {
  WebkitAppRegion: "drag",
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
        className="absolute -top-[3.25px] left-[5rem] z-30 flex h-[var(--remora-titlebar-height)] w-[calc(var(--sidebar-width)-5rem)] items-center justify-between pr-2.5 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=collapsed]/sidebar-wrapper:w-[10rem] motion-reduce:transition-none"
        data-slot="app-titlebar-controls"
      >
        <div className="flex shrink-0 items-center gap-[2px]">
          <AppSidebarToggle />
          <DesktopUpdateButton />
        </div>
        <HistoryButtons />
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

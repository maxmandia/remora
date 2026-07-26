import { SidebarToggleButton } from "@remora/app/sidebar";
import { SidebarInset, SidebarProvider } from "@remora/ui";
import { Link } from "@tanstack/react-router";
import type { CSSProperties, ReactNode } from "react";

import { useWebPreferencesStore } from "../stores/preferences-store";

type WebAppWorkspaceLayoutProps = {
  children: ReactNode;
  mainAriaLabel?: string;
  sidebar: ReactNode;
};

const webAppWorkspaceLayoutStyle = {
  "--sidebar-width": "16rem",
  "--workspace-sidebar-header-offset": "44px",
} as CSSProperties;

export function WebAppWorkspaceLayout({
  children,
  mainAriaLabel = "Generation workspace",
  sidebar,
}: WebAppWorkspaceLayoutProps) {
  const open = useWebPreferencesStore((state) => state.sidebarOpen);
  const setOpen = useWebPreferencesStore((state) => state.setSidebarOpen);

  return (
    <SidebarProvider
      open={open}
      onOpenChange={setOpen}
      className="text-foreground relative isolate grid h-svh min-h-[28rem] grid-cols-[var(--sidebar-width)_minmax(0,1fr)] overflow-hidden bg-transparent transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[state=collapsed]:grid-cols-[0rem_minmax(0,1fr)] motion-reduce:transition-none"
      style={webAppWorkspaceLayoutStyle}
    >
      <div
        className="absolute top-0 left-0 z-30 flex h-11 w-[var(--sidebar-width)] items-center justify-between px-2.5 transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=collapsed]/sidebar-wrapper:w-14 motion-reduce:transition-none"
        data-slot="web-app-sidebar-controls"
      >
        <Link
          aria-label="Remora home"
          className="focus-visible:ring-ring ml-1 shrink-0 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
          to="/app"
          search={{}}
        >
          <img
            alt=""
            aria-hidden="true"
            className="h-auto w-16 transition-[width,opacity] duration-200 ease-out select-none group-data-[state=collapsed]/sidebar-wrapper:w-0 group-data-[state=collapsed]/sidebar-wrapper:opacity-0 motion-reduce:transition-none"
            data-slot="web-app-sidebar-logo"
            draggable={false}
            src="/remora-wordmark.svg"
          />
        </Link>
        <SidebarToggleButton
          tooltipAlign="start"
          tooltipSide="bottom"
          tooltipSideOffset={8}
        />
      </div>
      {sidebar}
      <SidebarInset
        aria-label={mainAriaLabel}
        className="bg-background min-h-0 min-w-0 overflow-hidden"
      >
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export type { WebAppWorkspaceLayoutProps };

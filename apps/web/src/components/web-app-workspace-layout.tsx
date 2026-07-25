import { SidebarInset, SidebarProvider } from "@remora/ui";
import type { CSSProperties, ReactNode } from "react";

type WebAppWorkspaceLayoutProps = {
  children: ReactNode;
  mainAriaLabel?: string;
  sidebar: ReactNode;
};

const webAppWorkspaceLayoutStyle = {
  "--sidebar-width": "16rem",
  "--workspace-sidebar-header-offset": "0px",
} as CSSProperties;

export function WebAppWorkspaceLayout({
  children,
  mainAriaLabel = "Generation workspace",
  sidebar,
}: WebAppWorkspaceLayoutProps) {
  return (
    <SidebarProvider
      open={true}
      className="text-foreground relative isolate grid h-svh min-h-[28rem] grid-cols-[var(--sidebar-width)_minmax(0,1fr)] overflow-hidden bg-transparent"
      style={webAppWorkspaceLayoutStyle}
    >
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

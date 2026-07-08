import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from "../primitives/sidebar.tsx";
import { cn } from "../utils.ts";

type WorkspaceSidebarProps = Omit<
  ComponentPropsWithoutRef<typeof Sidebar>,
  "aria-label" | "children" | "collapsible"
> & {
  "aria-label": string;
  children: ReactNode;
  footer?: ReactNode;
  header: ReactNode;
};

function WorkspaceSidebar({
  "aria-label": ariaLabel,
  children,
  className,
  footer,
  header,
  ...props
}: WorkspaceSidebarProps) {
  return (
    <Sidebar
      aria-label={ariaLabel}
      collapsible="none"
      className={cn(
        "border-sidebar-border bg-card text-sidebar-foreground relative z-10 min-h-0 !w-full min-w-0 overflow-hidden border-r font-normal shadow-[inset_-1px_0_rgb(255_255_255/0.09),inset_0_1px_rgb(255_255_255/0.06)]",
        className,
      )}
      {...props}
    >
      <div className="flex h-full min-h-0 w-[var(--sidebar-width)] max-w-[var(--sidebar-width)] min-w-[var(--sidebar-width)] shrink-0 flex-col transition-opacity duration-200 ease-out group-data-[state=collapsed]/sidebar-wrapper:pointer-events-none group-data-[state=collapsed]/sidebar-wrapper:opacity-0 motion-reduce:transition-none">
        <SidebarHeader className="gap-4 px-2.5 pt-[calc(var(--remora-titlebar-height))] pb-0">
          {header}
        </SidebarHeader>
        <SidebarContent className="px-2.5">{children}</SidebarContent>
        {footer && (
          <SidebarFooter className="px-2.5 pt-0 pb-3">{footer}</SidebarFooter>
        )}
      </div>
    </Sidebar>
  );
}

export { WorkspaceSidebar };

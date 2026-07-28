import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  WorkspaceSidebar,
} from "@remora/ui";
import { LayoutDashboardIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

type AdminSidebarProps = {
  overviewHref: string;
  isOverviewActive: boolean;
  onSelectOverview: () => void;
};

function AdminSidebar({
  overviewHref,
  isOverviewActive,
  onSelectOverview,
}: AdminSidebarProps) {
  function handleOverviewClick(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    event.preventDefault();
    onSelectOverview();
  }

  return (
    <WorkspaceSidebar aria-label="Admin" header={null}>
      <SidebarGroup className="min-h-0 p-0">
        <SidebarGroupLabel className="text-muted-foreground h-10 justify-between px-2 text-[15px]">
          <span className="select-none">Admin</span>
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuLink
                aria-current={isOverviewActive ? "page" : undefined}
                href={overviewHref}
                isActive={isOverviewActive}
                onClick={handleOverviewClick}
              >
                <LayoutDashboardIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 stroke-1"
                />
                <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
                  Overview
                </span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </WorkspaceSidebar>
  );
}

export { AdminSidebar };
export type { AdminSidebarProps };

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  WorkspaceSidebar,
} from "@remora/ui";
import { ScanFaceIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

type AdminSidebarProps = {
  impersonationHref: string;
  isImpersonationActive: boolean;
  onSelectImpersonation: () => void;
};

function AdminSidebar({
  impersonationHref,
  isImpersonationActive,
  onSelectImpersonation,
}: AdminSidebarProps) {
  function handleImpersonationClick(event: ReactMouseEvent<HTMLAnchorElement>) {
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
    onSelectImpersonation();
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
                aria-current={isImpersonationActive ? "page" : undefined}
                href={impersonationHref}
                isActive={isImpersonationActive}
                onClick={handleImpersonationClick}
              >
                <ScanFaceIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 stroke-1"
                />
                <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
                  Account impersonation
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

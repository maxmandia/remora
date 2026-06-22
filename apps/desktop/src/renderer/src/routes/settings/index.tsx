import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  WorkspaceSidebar,
} from "@remora/ui";
import { Outlet, createLink, useNavigate } from "@tanstack/react-router";
import { CircleDollarSignIcon } from "lucide-react";
import { useEffect } from "react";

import { AppWorkspaceLayout } from "../../layouts/app-workspace-layout.tsx";
import { useAuth } from "../../providers/auth-provider.tsx";

export function SettingsRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  return (
    <AppWorkspaceLayout
      data-auth-status={status}
      data-user-id={user?.id}
      mainAriaLabel="Settings workspace"
      sidebar={<SettingsSidebar />}
    >
      <Outlet />
    </AppWorkspaceLayout>
  );
}

function SettingsSidebar() {
  return (
    <WorkspaceSidebar aria-label="Settings" header={null}>
      <SidebarGroup className="min-h-0 p-0">
        <SidebarGroupLabel className="text-muted-foreground h-10 justify-between px-2 text-[15px]">
          <span className="select-none">General</span>
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SettingsSidebarMenuLink
                activeOptions={{ exact: true }}
                activeProps={{ "data-active": true }}
                to="/app/settings/credits"
              >
                <CircleDollarSignIcon className="size-4 shrink-0 stroke-1" />
                <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
                  Credits
                </span>
              </SettingsSidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </WorkspaceSidebar>
  );
}

const SettingsSidebarMenuLink = createLink(SidebarMenuLink);

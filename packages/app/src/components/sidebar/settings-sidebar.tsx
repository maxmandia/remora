import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
  WorkspaceSidebar,
} from "@remora/ui";
import { CircleDollarSignIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

type SettingsSidebarProps = {
  creditsHref: string;
  isCreditsActive: boolean;
  onSelectCredits: () => void;
};

function SettingsSidebar({
  creditsHref,
  isCreditsActive,
  onSelectCredits,
}: SettingsSidebarProps) {
  function handleCreditsClick(event: ReactMouseEvent<HTMLAnchorElement>) {
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
    onSelectCredits();
  }

  return (
    <WorkspaceSidebar aria-label="Settings" header={null}>
      <SidebarGroup className="min-h-0 p-0">
        <SidebarGroupLabel className="text-muted-foreground h-10 justify-between px-2 text-[15px]">
          <span className="select-none">General</span>
        </SidebarGroupLabel>
        <SidebarGroupContent className="min-h-0 flex-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuLink
                aria-current={isCreditsActive ? "page" : undefined}
                href={creditsHref}
                isActive={isCreditsActive}
                onClick={handleCreditsClick}
              >
                <CircleDollarSignIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 stroke-1"
                />
                <span className="text-secondary-foreground min-w-0 overflow-hidden text-sm text-ellipsis whitespace-nowrap select-none">
                  Credits
                </span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </WorkspaceSidebar>
  );
}

export { SettingsSidebar };
export type { SettingsSidebarProps };

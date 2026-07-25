import { useAuth } from "@remora/app/auth";
import { AppSidebar, type AppSidebarProps } from "@remora/app/sidebar";
import { useTRPC } from "@remora/app/trpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CircleDollarSignIcon, SettingsIcon } from "lucide-react";

type DesktopAppSidebarProps = Omit<AppSidebarProps, "footer" | "getThreadHref">;

function DesktopAppSidebar(props: DesktopAppSidebarProps) {
  return (
    <AppSidebar
      {...props}
      footer={<DesktopAppSidebarFooter />}
      getThreadHref={getThreadHref}
    />
  );
}

function getThreadHref(threadId: string) {
  return `/app/threads/${encodeURIComponent(threadId)}`;
}

function DesktopAppSidebarFooter() {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { user } = useAuth();
  const { data: balance } = useQuery(trpc.credits.getBalance.queryOptions());
  const shouldShowBuyCredits = Boolean(
    balance && balance.availableCreditAmountUsdMicros <= 0,
  );
  const displayName = user?.name?.trim() || user?.email || "Account";
  const initialsSource =
    user?.name?.trim() || user?.email?.split("@")[0] || "?";

  function handleOpenCredits() {
    void navigate({ to: "/app/settings/credits" });
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label="Settings"
              className="text-secondary-foreground flex min-w-0 flex-1 items-center justify-start gap-2 py-4"
              type="button"
              variant="ghost"
            >
              <SettingsIcon className="size-4 shrink-0" />
              <span>Settings</span>
            </Button>
          }
        />
        <DropdownMenuContent align="start" side="top">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-foreground flex items-center gap-2 px-1.5 py-1.5 font-normal">
              <SidebarUserAvatar image={user?.image} name={initialsSource} />
              <span className="text-secondary-foreground truncate text-sm">
                {displayName}
              </span>
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleOpenCredits}>
            <CircleDollarSignIcon />
            Credits
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {shouldShowBuyCredits ? (
        <Button
          className="ml-auto shrink-0 rounded-full"
          size="xs"
          type="button"
          onClick={handleOpenCredits}
        >
          Get Credits
        </Button>
      ) : null}
    </div>
  );
}

function SidebarUserAvatar({
  image,
  name,
}: {
  image: string | null | undefined;
  name: string;
}) {
  if (image) {
    return (
      <img
        alt=""
        className="size-6 shrink-0 rounded-full border-0 object-cover ring-0"
        src={image}
      />
    );
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase()
      : name.trim().slice(0, 2).toUpperCase() || "?";

  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-full border-0 bg-[#22201b] text-[10px] font-medium text-white ring-0 outline-none select-none"
    >
      {initials}
    </span>
  );
}

export { DesktopAppSidebar };
export type { DesktopAppSidebarProps };

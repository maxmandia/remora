import { useAuth } from "@remora/app/auth";
import { useTRPC } from "@remora/app/trpc";
import { useQuery } from "@tanstack/react-query";
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
import { CircleDollarSignIcon, SettingsIcon, ShieldIcon } from "lucide-react";

type AppSidebarFooterProps = {
  onOpenAdmin: () => void;
  onOpenCredits: () => void;
};

function AppSidebarFooter({
  onOpenAdmin,
  onOpenCredits,
}: AppSidebarFooterProps) {
  const trpc = useTRPC();
  const { user } = useAuth();
  const { data: balance } = useQuery(trpc.credits.getBalance.queryOptions());
  const shouldShowBuyCredits = Boolean(
    balance && balance.availableCreditAmountUsdMicros <= 0,
  );
  const displayName = user?.name?.trim() || user?.email || "Account";
  const initialsSource =
    user?.name?.trim() || user?.email?.split("@")[0] || "?";

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
          <DropdownMenuItem onClick={onOpenCredits}>
            <CircleDollarSignIcon />
            Credits
          </DropdownMenuItem>
          {user?.role === "admin" ? (
            <DropdownMenuItem onClick={onOpenAdmin}>
              <ShieldIcon />
              Admin
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      {shouldShowBuyCredits ? (
        <Button
          className="ml-auto shrink-0 rounded-full"
          size="xs"
          type="button"
          onClick={onOpenCredits}
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

export { AppSidebarFooter };
export type { AppSidebarFooterProps };

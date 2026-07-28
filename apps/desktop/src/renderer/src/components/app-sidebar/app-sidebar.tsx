import {
  AppSidebar,
  AppSidebarFooter,
  type AppSidebarProps,
} from "@remora/app/sidebar";
import { useNavigate } from "@tanstack/react-router";

type DesktopAppSidebarProps = Omit<AppSidebarProps, "footer" | "getThreadHref">;

function DesktopAppSidebar(props: DesktopAppSidebarProps) {
  const navigate = useNavigate();

  return (
    <AppSidebar
      {...props}
      footer={
        <AppSidebarFooter
          onOpenAdmin={() => navigate({ to: "/app/admin" })}
          onOpenCredits={() => navigate({ to: "/app/settings/credits" })}
        />
      }
      getThreadHref={getThreadHref}
    />
  );
}

function getThreadHref(threadId: string) {
  return `/app/threads/${encodeURIComponent(threadId)}`;
}

export { DesktopAppSidebar };
export type { DesktopAppSidebarProps };

import { WorkspaceSidebar } from "@remora/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import { useAuth } from "../providers/auth-provider.tsx";

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
      sidebar={
        <WorkspaceSidebar aria-label="Settings" header={null}>
          {null}
        </WorkspaceSidebar>
      }
    >
      <div className="h-full min-h-full" />
    </AppWorkspaceLayout>
  );
}

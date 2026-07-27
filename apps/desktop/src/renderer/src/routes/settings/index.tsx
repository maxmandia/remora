import { useAuth } from "@remora/app/auth";
import { SettingsSidebar } from "@remora/app/sidebar";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppWorkspaceLayout } from "../../layouts/app-workspace-layout.tsx";

export function SettingsRoute() {
  const { status, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const creditsSettingsPath = "/app/settings/credits";

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
        <SettingsSidebar
          creditsHref={creditsSettingsPath}
          isCreditsActive={location.pathname === creditsSettingsPath}
          onSelectCredits={() => navigate({ to: creditsSettingsPath })}
        />
      }
    >
      <Outlet />
    </AppWorkspaceLayout>
  );
}

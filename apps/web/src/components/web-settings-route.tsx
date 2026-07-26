import { SettingsSidebar } from "@remora/app/sidebar";
import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";

import { WebAppWorkspaceLayout } from "./web-app-workspace-layout";

export function WebSettingsRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  const creditsSettingsPath = "/app/settings/credits";

  return (
    <WebAppWorkspaceLayout
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
    </WebAppWorkspaceLayout>
  );
}

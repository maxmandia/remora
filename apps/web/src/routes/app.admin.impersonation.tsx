import { AccountImpersonationPage } from "@remora/app/admin";
import { AdminSidebar } from "@remora/app/sidebar";
import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { WebAppWorkspaceLayout } from "../components/web-app-workspace-layout";
import { accountImpersonationAdapter } from "../lib/account-impersonation-adapter";

const impersonationPath = "/app/admin/impersonation";

export const Route = createFileRoute("/app/admin/impersonation")({
  component: AccountImpersonationRoute,
});

function AccountImpersonationRoute() {
  const navigate = useNavigate();

  return (
    <WebAppWorkspaceLayout
      mainAriaLabel="Admin workspace"
      sidebar={
        <AdminSidebar
          impersonationHref={impersonationPath}
          isImpersonationActive
          onSelectImpersonation={() => navigate({ to: impersonationPath })}
        />
      }
    >
      <AccountImpersonationPage
        adapter={accountImpersonationAdapter}
        onImpersonated={() =>
          navigate({ to: "/app", search: {}, replace: true })
        }
      />
    </WebAppWorkspaceLayout>
  );
}

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
} from "@tanstack/react-router";
import { parseGenerationWorkspaceSearch } from "@remora/app/generation";
import { ImpersonationBanner } from "@remora/app/admin";

import { AppProviders } from "./providers/app-providers.tsx";
import { BootstrapGate } from "./providers/bootstrap-gate.tsx";
import { AdminRoute } from "./routes/admin-route.tsx";
import { AdminImpersonationRoute } from "./routes/admin-impersonation-route.tsx";
import { AppRoute } from "./routes/app-route.tsx";
import { BootstrapRoute } from "./routes/bootstrap-route.tsx";
import { CreditsSettingsRoute } from "./routes/settings/credits-settings-route.tsx";
import { ExploreRoute } from "./routes/explore-route.tsx";
import { SettingsRoute } from "./routes/settings/index.tsx";
import { WelcomeRoute } from "./routes/welcome-route.tsx";

const rootRoute = createRootRoute({
  component: Root,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: BootstrapRoute,
});

const welcomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/welcome",
  component: WelcomeRoute,
});

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  validateSearch: parseGenerationWorkspaceSearch,
  component: AppRoute,
});

const appThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/threads/$threadId",
  validateSearch: parseGenerationWorkspaceSearch,
  component: AppRoute,
});

const appAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/admin",
  component: AdminRoute,
});

const appAdminImpersonationRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/admin/impersonation",
  component: AdminImpersonationRoute,
});

const appSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/settings",
  component: SettingsRoute,
});

const appSettingsCreditsRoute = createRoute({
  getParentRoute: () => appSettingsRoute,
  path: "credits",
  component: CreditsSettingsRoute,
});

const exploreRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explore",
  component: ExploreRoute,
});

const exploreCategoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/explore/$category",
  component: ExploreRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  welcomeRoute,
  appRoute,
  appThreadRoute,
  appAdminRoute,
  appAdminImpersonationRoute,
  appSettingsRoute.addChildren([appSettingsCreditsRoute]),
  exploreRoute,
  exploreCategoryRoute,
]);

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({
    initialEntries: ["/"],
  }),
  scrollRestoration: true,
  defaultPreload: "intent",
});

function Root() {
  const navigate = useNavigate();

  return (
    <AppProviders>
      <ImpersonationBanner
        onStopped={() =>
          navigate({ to: "/app/admin/impersonation", replace: true })
        }
      />
      <div className="remora-desktop-shell">
        <div aria-hidden="true" className="remora-desktop-titlebar" />
        <div className="remora-desktop-content">
          <BootstrapGate>
            <Outlet />
          </BootstrapGate>
        </div>
      </div>
    </AppProviders>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";

import { AppProviders } from "./providers/app-providers.tsx";
import { BootstrapGate } from "./providers/bootstrap-gate.tsx";
import { AppRoute } from "./routes/app-route.tsx";
import { BootstrapRoute } from "./routes/bootstrap-route.tsx";
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

type AppSearch = {
  projectId?: string;
};

function validateAppSearch(search: Record<string, unknown>): AppSearch {
  return typeof search.projectId === "string" && search.projectId.length > 0
    ? { projectId: search.projectId }
    : {};
}

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app",
  validateSearch: validateAppSearch,
  component: AppRoute,
});

const appThreadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/app/threads/$threadId",
  validateSearch: validateAppSearch,
  component: AppRoute,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  welcomeRoute,
  appRoute,
  appThreadRoute,
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
  return (
    <AppProviders>
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

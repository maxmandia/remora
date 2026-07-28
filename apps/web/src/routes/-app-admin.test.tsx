/** @vitest-environment jsdom */
// The leading dash keeps this test out of TanStack's generated route tree.

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { Suspense, type ComponentType, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    current: {
      status: "signed-in" as "loading" | "signed-in" | "signed-out",
      user: {
        id: "admin_1",
        isAdmin: true,
      } as { id: string; isAdmin: boolean } | null,
    },
  },
  navigate: vi.fn(),
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.auth.current,
}));

vi.mock("@remora/app/sidebar", () => ({
  AdminSidebar: ({
    overviewHref,
    isOverviewActive,
    onSelectOverview,
  }: {
    overviewHref: string;
    isOverviewActive: boolean;
    onSelectOverview: () => void;
  }) => (
    <nav aria-label="Admin">
      <a
        aria-current={isOverviewActive ? "page" : undefined}
        href={overviewHref}
        onClick={(event) => {
          event.preventDefault();
          onSelectOverview();
        }}
      >
        Overview
      </a>
    </nav>
  ),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
  }),
  Navigate: ({
    replace,
    to,
  }: {
    replace: boolean;
    search: Record<string, never>;
    to: string;
  }) => <div data-replace={replace} data-testid="redirect" data-to={to} />,
  useNavigate: () => mocks.navigate,
}));

vi.mock("../components/web-app-workspace-layout", () => ({
  WebAppWorkspaceLayout: ({
    children,
    mainAriaLabel,
    sidebar,
  }: {
    children: ReactNode;
    mainAriaLabel: string;
    sidebar: ReactNode;
  }) => (
    <div>
      {sidebar}
      <main aria-label={mainAriaLabel}>{children}</main>
    </div>
  ),
}));

import { Route } from "./app.admin";

const AdminRoute = Route.options.component as ComponentType;

describe("web AdminRoute", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.auth.current = {
      status: "signed-in",
      user: {
        id: "admin_1",
        isAdmin: true,
      },
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the guarded admin placeholder and active destination", async () => {
    await renderAdminRoute();

    expect(
      await screen.findByRole("main", { name: "Admin workspace" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("Admin tools are coming soon.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeTruthy();
  });

  it("uses host navigation from the admin shell", async () => {
    await renderAdminRoute();

    fireEvent.click(await screen.findByRole("link", { name: "Overview" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/admin",
    });
  });

  it.each([
    {
      name: "a non-admin",
      status: "signed-in" as const,
      user: { id: "user_1", isAdmin: false },
    },
    {
      name: "a signed-out user",
      status: "signed-out" as const,
      user: null,
    },
  ])(
    "redirects $name without rendering protected content",
    async ({ status, user }) => {
      mocks.auth.current = { status, user };

      await renderAdminRoute();

      const redirect = await screen.findByTestId("redirect");

      expect(redirect.getAttribute("data-to")).toBe("/app");
      expect(redirect.getAttribute("data-replace")).toBe("true");
      expect(screen.queryByRole("heading", { name: "Admin" })).toBeNull();
    },
  );
});

async function renderAdminRoute() {
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <AdminRoute />
      </Suspense>,
    );
  });
}

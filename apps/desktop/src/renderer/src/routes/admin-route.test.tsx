/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
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

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../layouts/app-workspace-layout.tsx", () => ({
  AppWorkspaceLayout: ({
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

import { AdminRoute } from "./admin-route.tsx";

describe("desktop AdminRoute", () => {
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

  it("renders the guarded admin placeholder and active destination", () => {
    render(<AdminRoute />);

    expect(screen.getByRole("main", { name: "Admin workspace" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Admin" })).toBeTruthy();
    expect(screen.getByText("Admin tools are coming soon.")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Overview" })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByRole("navigation", { name: "Admin" })).toBeTruthy();
  });

  it("uses host navigation from the admin shell", () => {
    render(<AdminRoute />);

    fireEvent.click(screen.getByRole("link", { name: "Overview" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/admin",
    });
  });

  it("redirects non-admins without rendering protected content", async () => {
    mocks.auth.current = {
      status: "signed-in",
      user: {
        id: "user_1",
        isAdmin: false,
      },
    };

    render(<AdminRoute />);

    expect(screen.queryByRole("heading", { name: "Admin" })).toBeNull();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app",
        replace: true,
      }),
    );
  });

  it("redirects signed-out users to welcome without protected content", async () => {
    mocks.auth.current = {
      status: "signed-out",
      user: null,
    };

    render(<AdminRoute />);

    expect(screen.queryByRole("heading", { name: "Admin" })).toBeNull();
    await waitFor(() =>
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/welcome",
        replace: true,
      }),
    );
  });
});

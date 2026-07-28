/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  pathname: {
    current: "/app/settings/credits",
  },
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    status: "signed-in",
    user: {
      id: "user_1",
    },
  }),
}));

vi.mock("@remora/app/sidebar", () => ({
  SettingsSidebar: ({
    creditsHref,
    isCreditsActive,
    onSelectCredits,
  }: {
    creditsHref: string;
    isCreditsActive: boolean;
    onSelectCredits: () => void;
  }) => (
    <a
      aria-current={isCreditsActive ? "page" : undefined}
      href={creditsHref}
      onClick={(event) => {
        event.preventDefault();
        onSelectCredits();
      }}
    >
      Credits
    </a>
  ),
}));

vi.mock("@tanstack/react-router", () => ({
  Outlet: () => <div data-testid="settings-outlet" />,
  useLocation: () => ({ pathname: mocks.pathname.current }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("../../layouts/app-workspace-layout.tsx", () => ({
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

import { SettingsRoute } from "./index.tsx";

describe("SettingsRoute", () => {
  beforeEach(() => {
    mocks.navigate.mockReset();
    mocks.pathname.current = "/app/settings/credits";
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the shared settings sidebar with the active credits route", () => {
    render(<SettingsRoute />);

    expect(
      screen.getByRole("main", { name: "Settings workspace" }),
    ).toBeTruthy();
    expect(screen.getByTestId("settings-outlet")).toBeTruthy();

    const creditsLink = screen.getByRole("link", { name: "Credits" });

    expect(creditsLink.getAttribute("href")).toBe("/app/settings/credits");
    expect(creditsLink.getAttribute("aria-current")).toBe("page");
  });

  it("navigates to the existing desktop credits destination", () => {
    render(<SettingsRoute />);

    fireEvent.click(screen.getByRole("link", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("does not expose admin navigation from settings", () => {
    render(<SettingsRoute />);

    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
  });
});

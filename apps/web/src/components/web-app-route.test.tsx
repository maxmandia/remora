/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    current: {
      error: null as string | null,
      requestAuth: vi.fn(),
      signOut: vi.fn(),
      status: "loading" as "loading" | "signed-in" | "signed-out",
      user: null as {
        email: string;
        id: string;
        image: string | null;
        name: string;
      } | null,
    },
  },
  location: {
    current: {
      pathname: "/app",
      search: {} as Record<string, unknown>,
    },
  },
  navigateProps: vi.fn(),
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("@remora/app/admin", () => ({
  ImpersonationBanner: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  Navigate: (props: {
    replace: boolean;
    search: Record<string, unknown>;
    to: string;
  }) => {
    mocks.navigateProps(props);

    return <div data-testid="app-route-navigate" />;
  },
  Outlet: () => <div data-testid="app-route-outlet" />,
  useLocation: () => mocks.location.current,
  useNavigate: () => vi.fn(),
}));

vi.mock("../providers/app-providers", () => ({
  AppProviders: ({ children }: { children: ReactNode }) => children,
}));

import { WebAppRoute } from "./web-app-route";

describe("web app route", () => {
  beforeEach(() => {
    mocks.authState.current.requestAuth.mockReset();
    mocks.authState.current.requestAuth.mockResolvedValue(undefined);
    mocks.authState.current.status = "loading";
    mocks.authState.current.user = null;
    mocks.location.current = {
      pathname: "/app",
      search: {},
    };
    mocks.navigateProps.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("waits for the authenticated session before rendering app routes", () => {
    render(<WebAppRoute />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(screen.queryByTestId("app-route-outlet")).toBeNull();
  });

  it("renders direct signed-out app visits without requesting authentication", () => {
    mocks.authState.current.status = "signed-out";

    render(<WebAppRoute />);

    expect(screen.getByTestId("app-route-outlet")).toBeTruthy();
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
    expect(screen.queryByTestId("app-route-navigate")).toBeNull();
  });

  it.each([
    {
      pathname: "/app/threads/thread_1",
      search: {},
    },
    {
      pathname: "/app/settings/credits",
      search: {},
    },
    {
      pathname: "/app",
      search: { projectId: "project_1" },
    },
  ])(
    "normalizes signed-out private app locations to the clean workspace",
    (location) => {
      mocks.authState.current.status = "signed-out";
      mocks.location.current = location;

      render(<WebAppRoute />);

      expect(screen.getByTestId("app-route-navigate")).toBeTruthy();
      expect(mocks.navigateProps).toHaveBeenCalledWith({
        replace: true,
        search: {},
        to: "/app",
      });
      expect(screen.queryByTestId("app-route-outlet")).toBeNull();
      expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
    },
  );

  it.each(["/sign-up", "/sign-in"])(
    "does not redirect a signed-out transition to %s back into the app",
    (pathname) => {
      mocks.authState.current.status = "signed-out";
      mocks.location.current = {
        pathname,
        search: {
          guestGeneration: true,
          redirect: "/app",
        },
      };

      const rendered = render(<WebAppRoute />);

      expect(rendered.container.childElementCount).toBe(0);
      expect(mocks.navigateProps).not.toHaveBeenCalled();
      expect(screen.queryByTestId("app-route-navigate")).toBeNull();
      expect(screen.queryByTestId("app-route-outlet")).toBeNull();
      expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
    },
  );

  it("preserves private app locations for signed-in users", () => {
    mocks.authState.current.status = "signed-in";
    mocks.authState.current.user = {
      email: "max@example.com",
      id: "user_1",
      image: null,
      name: "Max Remora",
    };
    mocks.location.current = {
      pathname: "/app/threads/thread_1",
      search: {},
    };

    render(<WebAppRoute />);

    expect(screen.getByTestId("app-route-outlet")).toBeTruthy();
    expect(screen.queryByTestId("app-route-navigate")).toBeNull();
  });

  it("renders the matched generation or settings route when signed in", () => {
    mocks.authState.current.status = "signed-in";
    mocks.authState.current.user = {
      email: "max@example.com",
      id: "user_1",
      image: null,
      name: "Max Remora",
    };

    render(<WebAppRoute />);

    expect(screen.getByTestId("app-route-outlet")).toBeTruthy();
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
  });
});

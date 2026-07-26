/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("@tanstack/react-router", () => ({
  ClientOnly: ({ children }: { children: ReactNode }) => children,
  Outlet: () => <div data-testid="app-route-outlet" />,
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
  });

  afterEach(() => {
    cleanup();
  });

  it("waits for the authenticated session before rendering app routes", () => {
    render(<WebAppRoute />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(screen.queryByTestId("app-route-outlet")).toBeNull();
  });

  it("requests authentication for direct signed-out app visits", async () => {
    mocks.authState.current.status = "signed-out";

    render(<WebAppRoute />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId("app-route-outlet")).toBeNull();
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

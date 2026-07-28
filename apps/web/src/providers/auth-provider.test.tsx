/** @vitest-environment jsdom */

import { useAuth } from "@remora/app/auth";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "./auth-provider";

const mocks = vi.hoisted(() => ({
  identifyWebAnalyticsUser: vi.fn(),
  redirectAppToSignIn: vi.fn(),
  resetWebAnalyticsUser: vi.fn(),
  signOut: vi.fn(),
  stopImpersonating: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    admin: {
      stopImpersonating: mocks.stopImpersonating,
    },
    signOut: mocks.signOut,
    useSession: mocks.useSession,
  },
}));

vi.mock("../lib/app-redirect", () => ({
  redirectAppToSignIn: mocks.redirectAppToSignIn,
}));

vi.mock("../lib/analytics", () => ({
  identifyWebAnalyticsUser: mocks.identifyWebAnalyticsUser,
  resetWebAnalyticsUser: mocks.resetWebAnalyticsUser,
}));

describe("web AuthProvider", () => {
  beforeEach(() => {
    mocks.identifyWebAnalyticsUser.mockReset();
    mocks.identifyWebAnalyticsUser.mockResolvedValue(undefined);
    mocks.redirectAppToSignIn.mockReset();
    mocks.resetWebAnalyticsUser.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ data: null, error: null });
    mocks.stopImpersonating.mockReset();
    mocks.stopImpersonating.mockResolvedValue({ data: null, error: null });
    mocks.useSession.mockReset();
    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: true,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("maps the pending session to loading", () => {
    renderAuthProvider();

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "loading",
    );
    expect(screen.getByTestId("auth").getAttribute("data-user-id")).toBeNull();
  });

  it("maps, normalizes, and identifies a signed-in Better Auth session", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Remora User",
          email: "user@example.test",
          image: undefined,
          role: "admin",
        },
        session: { impersonatedBy: null },
      },
      error: null,
      isPending: false,
    });

    renderAuthProvider();

    const probe = screen.getByTestId("auth");
    expect(probe.getAttribute("data-status")).toBe("signed-in");
    expect(probe.getAttribute("data-user-id")).toBe("user_1");
    expect(probe.getAttribute("data-user-name")).toBe("Remora User");
    expect(probe.getAttribute("data-user-email")).toBe("user@example.test");
    expect(probe.getAttribute("data-user-image")).toBe("");
    expect(probe.getAttribute("data-user-role")).toBe("admin");
    await waitFor(() =>
      expect(mocks.identifyWebAnalyticsUser).toHaveBeenCalledWith("user_1"),
    );
  });

  it("maps a missing session and session errors to signed out", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      error: new Error("Session request failed"),
      isPending: false,
    });

    renderAuthProvider();

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Session request failed",
    );
  });

  it("preserves the signed-out status during background session refreshes", () => {
    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
    });

    const rendered = renderAuthProvider();

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );

    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: true,
    });
    rendered.rerender(
      <QueryClientProvider client={new QueryClient()}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );
  });

  it("requests browser authentication with the existing redirect", async () => {
    mocks.useSession.mockReturnValue({
      data: null,
      error: null,
      isPending: false,
    });

    renderAuthProvider();
    fireEvent.click(screen.getByRole("button", { name: "Request auth" }));

    await waitFor(() =>
      expect(mocks.redirectAppToSignIn).toHaveBeenCalledOnce(),
    );
  });

  it("signs out and redirects to sign in", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Remora User",
          email: "user@example.test",
          image: null,
          role: "user",
        },
        session: { impersonatedBy: null },
      },
      error: null,
      isPending: false,
    });

    renderAuthProvider();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
    expect(mocks.resetWebAnalyticsUser).toHaveBeenCalledOnce();
    expect(mocks.redirectAppToSignIn).toHaveBeenCalledOnce();
  });

  it("surfaces returned and thrown sign-out failures", async () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Remora User",
          email: "user@example.test",
          image: null,
          role: "user",
        },
        session: { impersonatedBy: null },
      },
      error: null,
      isPending: false,
    });
    mocks.signOut
      .mockResolvedValueOnce({
        data: null,
        error: {
          message: "Sign out rejected",
        },
      })
      .mockRejectedValueOnce(new Error("Network unavailable"));

    renderAuthProvider();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Sign out rejected")).toBeTruthy();
    expect(mocks.resetWebAnalyticsUser).not.toHaveBeenCalled();
    expect(mocks.redirectAppToSignIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Unable to sign out.")).toBeTruthy();
    expect(mocks.redirectAppToSignIn).not.toHaveBeenCalled();
  });

  it("clears cached identity data and suppresses analytics while impersonating", async () => {
    const queryClient = new QueryClient();
    const cancelQueries = vi.spyOn(queryClient, "cancelQueries");
    const clear = vi.spyOn(queryClient, "clear");
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "admin_1",
          name: "Administrator",
          email: "admin@example.test",
          image: null,
          role: "admin",
        },
        session: { impersonatedBy: null },
      },
      error: null,
      isPending: false,
    });
    const rendered = renderAuthProvider(queryClient);

    await waitFor(() =>
      expect(mocks.identifyWebAnalyticsUser).toHaveBeenCalledWith("admin_1"),
    );

    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Customer",
          email: "customer@example.test",
          image: null,
          role: "user",
        },
        session: { impersonatedBy: "admin_1" },
      },
      error: null,
      isPending: false,
    });
    rendered.rerender(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AuthProbe />
        </AuthProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(mocks.resetWebAnalyticsUser).toHaveBeenCalled());
    expect(mocks.identifyWebAnalyticsUser).not.toHaveBeenCalledWith("user_1");
    expect(cancelQueries).toHaveBeenCalled();
    expect(clear).toHaveBeenCalled();
  });
});

function renderAuthProvider(queryClient = new QueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

function AuthProbe() {
  const { error, requestAuth, signOut, status, user } = useAuth();

  return (
    <div
      data-status={status}
      data-user-email={user?.email}
      data-user-id={user?.id}
      data-user-image={user?.image ?? ""}
      data-user-role={user?.role}
      data-user-name={user?.name}
      data-testid="auth"
    >
      {error ? <p role="alert">{error}</p> : null}
      <button type="button" onClick={() => void requestAuth()}>
        Request auth
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

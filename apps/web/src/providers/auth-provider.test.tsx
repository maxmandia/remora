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

import { AuthProvider } from "./auth-provider";

const mocks = vi.hoisted(() => ({
  redirectAppToSignIn: vi.fn(),
  signOut: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("../lib/auth-client", () => ({
  authClient: {
    signOut: mocks.signOut,
    useSession: mocks.useSession,
  },
}));

vi.mock("../lib/app-redirect", () => ({
  redirectAppToSignIn: mocks.redirectAppToSignIn,
}));

describe("web AuthProvider", () => {
  beforeEach(() => {
    mocks.redirectAppToSignIn.mockReset();
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue({ data: null, error: null });
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

  it("maps and normalizes a signed-in Better Auth session", () => {
    mocks.useSession.mockReturnValue({
      data: {
        user: {
          id: "user_1",
          name: "Remora User",
          email: "user@example.test",
          image: undefined,
        },
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
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
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
        },
      },
      error: null,
      isPending: false,
    });

    renderAuthProvider();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce());
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
        },
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
    expect(mocks.redirectAppToSignIn).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByText("Unable to sign out.")).toBeTruthy();
    expect(mocks.redirectAppToSignIn).not.toHaveBeenCalled();
  });
});

function renderAuthProvider() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
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

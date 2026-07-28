/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { useAuth } from "@remora/app/auth";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider.tsx";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  identifyAnalyticsUser: vi.fn(),
  requestAuth: vi.fn(),
  resetAnalyticsUser: vi.fn(),
  signOut: vi.fn(),
  trackDesktopSessionStarted: vi.fn(),
  authenticatedCallback: null as ((user: unknown) => void) | null,
  authErrorCallback: null as ((context: unknown) => void) | null,
  userUpdatedCallback: null as ((user: unknown) => void) | null,
  unsubscribeAuthenticated: vi.fn(),
  unsubscribeAuthError: vi.fn(),
  unsubscribeUserUpdated: vi.fn(),
}));

vi.mock("../lib/auth-bridge.ts", () => ({
  authBridge: {
    getUser: mocks.getUser,
    requestAuth: mocks.requestAuth,
    signOut: mocks.signOut,
    onAuthenticated: (callback: (user: unknown) => void) => {
      mocks.authenticatedCallback = callback;
      return mocks.unsubscribeAuthenticated;
    },
    onUserUpdated: (callback: (user: unknown) => void) => {
      mocks.userUpdatedCallback = callback;
      return mocks.unsubscribeUserUpdated;
    },
    onAuthError: (callback: (context: unknown) => void) => {
      mocks.authErrorCallback = callback;
      return mocks.unsubscribeAuthError;
    },
  },
}));

vi.mock("../lib/analytics.ts", () => ({
  identifyAnalyticsUser: mocks.identifyAnalyticsUser,
  resetAnalyticsUser: mocks.resetAnalyticsUser,
  trackDesktopSessionStarted: mocks.trackDesktopSessionStarted,
}));

describe("AuthProvider analytics", () => {
  beforeEach(() => {
    mocks.getUser.mockReset();
    mocks.requestAuth.mockReset();
    mocks.requestAuth.mockResolvedValue(undefined);
    mocks.signOut.mockReset();
    mocks.signOut.mockResolvedValue(undefined);
    mocks.identifyAnalyticsUser.mockReset();
    mocks.resetAnalyticsUser.mockReset();
    mocks.trackDesktopSessionStarted.mockReset();
    mocks.unsubscribeAuthenticated.mockReset();
    mocks.unsubscribeAuthError.mockReset();
    mocks.unsubscribeUserUpdated.mockReset();
    mocks.authenticatedCallback = null;
    mocks.authErrorCallback = null;
    mocks.userUpdatedCallback = null;
    mocks.identifyAnalyticsUser.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
  });

  it("resolves the current desktop session into the shared context", async () => {
    mocks.getUser.mockResolvedValue(createUser("user_1"));

    renderAuthProvider();

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "loading",
    );
    await waitFor(() =>
      expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
        "signed-in",
      ),
    );
    expect(screen.getByTestId("auth").getAttribute("data-user-id")).toBe(
      "user_1",
    );
  });

  it("reports an initial session read failure as signed out", async () => {
    mocks.getUser.mockRejectedValue(new Error("Session unavailable"));

    renderAuthProvider();

    expect(
      await screen.findByText("Unable to read the current session."),
    ).toBeTruthy();
    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );
  });

  it("maps desktop auth events and unsubscribes on unmount", async () => {
    mocks.getUser.mockResolvedValue(null);
    const rendered = renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
        "signed-out",
      ),
    );

    act(() => mocks.authenticatedCallback?.(createUser("user_1")));
    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-in",
    );

    act(() =>
      mocks.authErrorCallback?.({
        statusText: "Desktop auth failed",
      }),
    );
    expect(screen.getByText("Desktop auth failed")).toBeTruthy();

    act(() => mocks.userUpdatedCallback?.(null));
    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );

    rendered.unmount();

    expect(mocks.unsubscribeAuthenticated).toHaveBeenCalledOnce();
    expect(mocks.unsubscribeUserUpdated).toHaveBeenCalledOnce();
    expect(mocks.unsubscribeAuthError).toHaveBeenCalledOnce();
  });

  it("surfaces request and sign-out failures without discarding the user", async () => {
    mocks.getUser.mockResolvedValue(createUser("user_1"));
    mocks.requestAuth.mockRejectedValue(new Error("Browser unavailable"));
    mocks.signOut.mockRejectedValue(new Error("IPC unavailable"));

    renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
        "signed-in",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Request auth" }));
    expect(
      await screen.findByText("Unable to open the sign-in flow."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("Unable to sign out.")).toBeTruthy();
    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-in",
    );
    expect(screen.getByTestId("auth").getAttribute("data-user-id")).toBe(
      "user_1",
    );
  });

  it("clears the desktop session after signing out", async () => {
    mocks.getUser.mockResolvedValue(createUser("user_1"));

    renderAuthProvider();

    await waitFor(() =>
      expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
        "signed-in",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    await waitFor(() =>
      expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
        "signed-out",
      ),
    );
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });

  it("does not create anonymous analytics sessions", async () => {
    mocks.getUser.mockResolvedValue(null);

    render(
      <AuthProvider>
        <div>signed out</div>
      </AuthProvider>,
    );

    await waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());
    expect(mocks.identifyAnalyticsUser).not.toHaveBeenCalled();
    expect(mocks.trackDesktopSessionStarted).not.toHaveBeenCalled();
    expect(mocks.resetAnalyticsUser).not.toHaveBeenCalled();
  });

  it("tracks once per authenticated user and resets on switches and logout", async () => {
    const firstUser = createUser("user_1");
    const secondUser = createUser("user_2");
    mocks.getUser.mockResolvedValue(firstUser);

    render(
      <AuthProvider>
        <div>signed in</div>
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(mocks.identifyAnalyticsUser).toHaveBeenCalledWith("user_1"),
    );
    expect(mocks.trackDesktopSessionStarted).toHaveBeenCalledOnce();
    expect(
      mocks.identifyAnalyticsUser.mock.invocationCallOrder[0],
    ).toBeLessThan(
      mocks.trackDesktopSessionStarted.mock.invocationCallOrder[0]!,
    );

    act(() => mocks.userUpdatedCallback?.(firstUser));
    expect(mocks.trackDesktopSessionStarted).toHaveBeenCalledOnce();

    act(() => mocks.authenticatedCallback?.(secondUser));
    await waitFor(() =>
      expect(mocks.identifyAnalyticsUser).toHaveBeenLastCalledWith("user_2"),
    );
    expect(mocks.resetAnalyticsUser).toHaveBeenCalledOnce();
    expect(mocks.trackDesktopSessionStarted).toHaveBeenCalledTimes(2);

    act(() => mocks.userUpdatedCallback?.(null));
    await waitFor(() =>
      expect(mocks.resetAnalyticsUser).toHaveBeenCalledTimes(2),
    );
  });

  it("does not track a session when identification fails", async () => {
    mocks.getUser.mockResolvedValue(createUser("user_1"));
    mocks.identifyAnalyticsUser.mockReturnValue(false);

    render(
      <AuthProvider>
        <div>signed in</div>
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(mocks.identifyAnalyticsUser).toHaveBeenCalledWith("user_1"),
    );
    expect(mocks.trackDesktopSessionStarted).not.toHaveBeenCalled();
  });
});

function createUser(id: string) {
  return {
    id,
    name: "User",
    email: "user@example.test",
    emailVerified: true,
    isAdmin: false,
    image: null,
    createdAt: new Date("2026-07-13T12:00:00.000Z"),
    updatedAt: new Date("2026-07-13T12:00:00.000Z"),
  };
}

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
    <div data-status={status} data-user-id={user?.id} data-testid="auth">
      {error ? <p>{error}</p> : null}
      <button type="button" onClick={() => void requestAuth()}>
        Request auth
      </button>
      <button type="button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}

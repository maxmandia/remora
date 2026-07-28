/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthProvider,
  useAuth,
  type AuthContextValue,
} from "./auth-provider.tsx";

describe("AuthProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("provides the supplied auth value and actions", () => {
    const requestAuth = vi.fn(async () => undefined);
    const signOut = vi.fn(async () => undefined);
    const value = createAuthValue({
      requestAuth,
      signOut,
      status: "signed-in",
      user: {
        id: "user_1",
        name: "Remora User",
        email: "user@example.test",
        role: "admin",
        image: null,
      },
    });

    render(
      <AuthProvider value={value}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-in",
    );
    expect(screen.getByTestId("auth").getAttribute("data-user-id")).toBe(
      "user_1",
    );
    expect(screen.getByTestId("auth").getAttribute("data-role")).toBe("admin");

    fireEvent.click(screen.getByRole("button", { name: "Request auth" }));
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(requestAuth).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledOnce();
  });

  it("propagates a replacement auth value", () => {
    const initialValue = createAuthValue();
    const nextValue = createAuthValue({
      error: "Unable to read the current session.",
      status: "signed-out",
    });
    const { rerender } = render(
      <AuthProvider value={initialValue}>
        <AuthProbe />
      </AuthProvider>,
    );

    rerender(
      <AuthProvider value={nextValue}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth").getAttribute("data-status")).toBe(
      "signed-out",
    );
    expect(screen.getByRole("alert").textContent).toBe(
      "Unable to read the current session.",
    );
  });

  it("rejects consumers outside the provider", () => {
    expect(() => render(<AuthProbe />)).toThrow(
      "Auth consumers must be rendered inside AuthProvider.",
    );
  });
});

function AuthProbe() {
  const { error, requestAuth, signOut, status, user } = useAuth();

  return (
    <div
      data-role={user?.role}
      data-status={status}
      data-user-id={user?.id}
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

function createAuthValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    error: null,
    impersonatedBy: null,
    requestAuth: async () => undefined,
    signOut: async () => undefined,
    stopImpersonating: async () => undefined,
    status: "loading",
    user: null,
    ...overrides,
  };
}

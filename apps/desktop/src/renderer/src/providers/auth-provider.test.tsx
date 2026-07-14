/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider } from "./auth-provider.tsx";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  identifyAnalyticsUser: vi.fn(),
  resetAnalyticsUser: vi.fn(),
  trackDesktopSessionStarted: vi.fn(),
  authenticatedCallback: null as ((user: unknown) => void) | null,
  userUpdatedCallback: null as ((user: unknown) => void) | null,
}));

vi.mock("../lib/auth-bridge.ts", () => ({
  authBridge: {
    getUser: mocks.getUser,
    requestAuth: vi.fn(),
    signOut: vi.fn(),
    onAuthenticated: (callback: (user: unknown) => void) => {
      mocks.authenticatedCallback = callback;
      return vi.fn();
    },
    onUserUpdated: (callback: (user: unknown) => void) => {
      mocks.userUpdatedCallback = callback;
      return vi.fn();
    },
    onAuthError: () => vi.fn(),
  },
}));

vi.mock("../lib/analytics.ts", () => ({
  identifyAnalyticsUser: mocks.identifyAnalyticsUser,
  resetAnalyticsUser: mocks.resetAnalyticsUser,
  trackDesktopSessionStarted: mocks.trackDesktopSessionStarted,
}));

describe("AuthProvider analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authenticatedCallback = null;
    mocks.userUpdatedCallback = null;
    mocks.identifyAnalyticsUser.mockReturnValue(true);
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
    image: null,
    createdAt: new Date("2026-07-13T12:00:00.000Z"),
    updatedAt: new Date("2026-07-13T12:00:00.000Z"),
  };
}

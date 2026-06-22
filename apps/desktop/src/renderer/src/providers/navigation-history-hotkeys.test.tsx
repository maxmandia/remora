/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthStatus } from "./auth-provider.tsx";
import { HotkeysProvider } from "./hotkeys-provider.tsx";
import { NavigationHistoryHotkeys } from "./navigation-history-hotkeys.tsx";

const mocks = vi.hoisted(() => ({
  authStatus: "signed-in" as AuthStatus,
  canGoBack: true,
  historyIndex: 1,
  historyLength: 3,
  routerBack: vi.fn(),
  routerForward: vi.fn(),
}));

vi.mock("./auth-provider.tsx", () => ({
  useAuth: () => ({
    error: null,
    requestAuth: vi.fn(),
    signOut: vi.fn(),
    status: mocks.authStatus,
    user: mocks.authStatus === "signed-in" ? { id: "user_1" } : null,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => mocks.canGoBack,
  useLocation: ({
    select,
  }: {
    select?: (location: { state: { __TSR_index: number } }) => unknown;
  } = {}) => {
    const location = { state: { __TSR_index: mocks.historyIndex } };

    return select ? select(location) : location;
  },
  useRouter: () => ({
    history: {
      back: mocks.routerBack,
      forward: mocks.routerForward,
      length: mocks.historyLength,
    },
  }),
}));

describe("NavigationHistoryHotkeys", () => {
  beforeEach(() => {
    mocks.authStatus = "signed-in";
    mocks.canGoBack = true;
    mocks.historyIndex = 1;
    mocks.historyLength = 3;
    mocks.routerBack.mockReset();
    mocks.routerForward.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates back when the user is signed in and history can go back", () => {
    renderNavigationHistoryHotkeys();

    fireEvent.keyDown(document, { key: "ArrowLeft", metaKey: true });

    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });

  it("does not navigate back when history cannot go back", () => {
    mocks.canGoBack = false;

    renderNavigationHistoryHotkeys();

    const wasNotPrevented = fireEvent.keyDown(document, {
      key: "ArrowLeft",
      metaKey: true,
    });

    expect(wasNotPrevented).toBe(false);
    expect(mocks.routerBack).not.toHaveBeenCalled();
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });

  it.each(["loading", "signed-out"] as const)(
    "does not navigate back while auth status is %s",
    (authStatus) => {
      mocks.authStatus = authStatus;

      renderNavigationHistoryHotkeys();

      fireEvent.keyDown(document, { key: "ArrowLeft", metaKey: true });

      expect(mocks.routerBack).not.toHaveBeenCalled();
      expect(mocks.routerForward).not.toHaveBeenCalled();
    },
  );

  it("navigates forward when the user is signed in and history can go forward", () => {
    renderNavigationHistoryHotkeys();

    fireEvent.keyDown(document, { key: "ArrowRight", metaKey: true });

    expect(mocks.routerForward).toHaveBeenCalledTimes(1);
    expect(mocks.routerBack).not.toHaveBeenCalled();
  });

  it("does not navigate forward when history cannot go forward", () => {
    mocks.historyIndex = 2;
    mocks.historyLength = 3;

    renderNavigationHistoryHotkeys();

    const wasNotPrevented = fireEvent.keyDown(document, {
      key: "ArrowRight",
      metaKey: true,
    });

    expect(wasNotPrevented).toBe(false);
    expect(mocks.routerForward).not.toHaveBeenCalled();
    expect(mocks.routerBack).not.toHaveBeenCalled();
  });

  it.each(["loading", "signed-out"] as const)(
    "does not navigate forward while auth status is %s",
    (authStatus) => {
      mocks.authStatus = authStatus;

      renderNavigationHistoryHotkeys();

      fireEvent.keyDown(document, { key: "ArrowRight", metaKey: true });

      expect(mocks.routerForward).not.toHaveBeenCalled();
      expect(mocks.routerBack).not.toHaveBeenCalled();
    },
  );

  it("preserves native editable-field behavior for history shortcuts", () => {
    const { getByLabelText } = render(
      <HotkeysProvider>
        <NavigationHistoryHotkeys />
        <input aria-label="Prompt" />
      </HotkeysProvider>,
    );

    const wasBackNotPrevented = fireEvent.keyDown(getByLabelText("Prompt"), {
      key: "ArrowLeft",
      metaKey: true,
    });
    const wasForwardNotPrevented = fireEvent.keyDown(getByLabelText("Prompt"), {
      key: "ArrowRight",
      metaKey: true,
    });

    expect(wasBackNotPrevented).toBe(true);
    expect(wasForwardNotPrevented).toBe(true);
    expect(mocks.routerBack).not.toHaveBeenCalled();
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });

  it("ignores nearby non-matching keys", () => {
    renderNavigationHistoryHotkeys();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    fireEvent.keyDown(document, { key: "ArrowRight" });
    fireEvent.keyDown(document, { key: "ArrowDown", metaKey: true });

    expect(mocks.routerBack).not.toHaveBeenCalled();
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });
});

function renderNavigationHistoryHotkeys() {
  return render(
    <HotkeysProvider>
      <NavigationHistoryHotkeys />
    </HotkeysProvider>,
  );
}

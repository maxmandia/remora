/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthStatus } from "../../providers/auth-provider.tsx";

const mocks = vi.hoisted(() => ({
  authStatus: "signed-in" as AuthStatus,
  canGoBack: true,
  historyIndex: 1,
  historyLength: 3,
  routerBack: vi.fn(),
  routerForward: vi.fn(),
}));

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    Button: ({
      children,
      size: _size,
      variant: _variant,
      ...props
    }: React.ComponentPropsWithoutRef<"button"> & {
      size?: string;
      variant?: string;
    }) => React.createElement("button", props, children),
    Tooltip: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    TooltipContent: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", { role: "tooltip", ...props }, children),
    TooltipTrigger: ({
      children,
      render,
      ...props
    }: React.ComponentPropsWithoutRef<"button"> & {
      render?: React.ReactElement<Record<string, unknown>>;
    }) =>
      render
        ? React.cloneElement(render, props)
        : React.createElement("button", props, children),
  };
});

vi.mock("../../providers/auth-provider.tsx", () => ({
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

import { HistoryButtons } from "./history-buttons.tsx";

describe("HistoryButtons", () => {
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

  it("renders history controls with shortcut tooltips", () => {
    render(<HistoryButtons />);

    const backButton = screen.getByRole("button", { name: "Back" });
    const forwardButton = screen.getByRole("button", { name: "Forward" });

    expect(
      backButton.getAttribute("aria-keyshortcuts"),
    ).toBe("Meta+ArrowLeft");
    expect(
      forwardButton.getAttribute("aria-keyshortcuts"),
    ).toBe("Meta+ArrowRight");
    expect(getTooltipText("Back")).toContain("CmdLeft");
    expect(getTooltipText("Forward")).toContain("CmdRight");
  });

  it("navigates back when back history is available", () => {
    render(<HistoryButtons />);

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });

  it("navigates forward when forward history is available", () => {
    render(<HistoryButtons />);

    fireEvent.click(screen.getByRole("button", { name: "Forward" }));

    expect(mocks.routerForward).toHaveBeenCalledTimes(1);
    expect(mocks.routerBack).not.toHaveBeenCalled();
  });

  it("marks unavailable history controls as aria-disabled and no-ops", () => {
    mocks.canGoBack = false;
    mocks.historyIndex = 2;
    mocks.historyLength = 3;

    render(<HistoryButtons />);

    const backButton = screen.getByRole("button", { name: "Back" });
    const forwardButton = screen.getByRole("button", { name: "Forward" });

    expect(backButton.getAttribute("aria-disabled")).toBe("true");
    expect(forwardButton.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(backButton);
    fireEvent.click(forwardButton);

    expect(mocks.routerBack).not.toHaveBeenCalled();
    expect(mocks.routerForward).not.toHaveBeenCalled();
  });

  it.each(["loading", "signed-out"] as const)(
    "no-ops while auth status is %s",
    (authStatus) => {
      mocks.authStatus = authStatus;

      render(<HistoryButtons />);

      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      fireEvent.click(screen.getByRole("button", { name: "Forward" }));

      expect(mocks.routerBack).not.toHaveBeenCalled();
      expect(mocks.routerForward).not.toHaveBeenCalled();
    },
  );
});

function getTooltipText(text: string) {
  const tooltip = screen
    .getAllByRole("tooltip")
    .find((candidate) => candidate.textContent?.includes(text));

  if (!tooltip) {
    throw new Error(`Expected tooltip containing "${text}".`);
  }

  return tooltip.textContent ?? "";
}

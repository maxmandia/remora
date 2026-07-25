/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
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

import { TooltipWithShortcut } from "./tooltip-with-shortcut.tsx";

describe("TooltipWithShortcut", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders tooltip text and the registered multi-key shortcut", () => {
    const { container } = render(
      <TooltipWithShortcut commandId="app.toggleSidebar" text="Toggle sidebar">
        <button type="button">Sidebar</button>
      </TooltipWithShortcut>,
    );

    const trigger = screen.getByRole("button", { name: "Sidebar" });

    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("Meta+B");
    expect(screen.getByRole("tooltip").textContent).toContain("Toggle sidebar");
    expect(
      Array.from(container.querySelectorAll("kbd"), (key) => key.textContent),
    ).toEqual(["Cmd", "B"]);
  });

  it("renders single-key shortcuts", () => {
    const { container } = render(
      <TooltipWithShortcut commandId="auth.requestSignIn" text="Get started">
        <button type="button">Sign in</button>
      </TooltipWithShortcut>,
    );

    const trigger = screen.getByRole("button", { name: "Sign in" });

    expect(trigger.getAttribute("aria-keyshortcuts")).toBe("S");
    expect(screen.getByRole("tooltip").textContent).toContain("Get started");
    expect(
      Array.from(container.querySelectorAll("kbd"), (key) => key.textContent),
    ).toEqual(["S"]);
  });
});

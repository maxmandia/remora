/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WebAppWorkspaceLayout } from "./web-app-workspace-layout";

describe("web app workspace layout", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders a permanently expanded fixed-width browser shell", () => {
    const { container } = render(
      <WebAppWorkspaceLayout
        sidebar={<aside aria-label="Test sidebar">Sidebar</aside>}
      >
        Workspace
      </WebAppWorkspaceLayout>,
    );

    const workspace = container.querySelector('[data-slot="sidebar-wrapper"]');

    expect(workspace?.getAttribute("data-state")).toBe("expanded");
    expect(
      (workspace as HTMLElement).style.getPropertyValue("--sidebar-width"),
    ).toBe("16rem");
    expect(
      (workspace as HTMLElement).style.getPropertyValue(
        "--workspace-sidebar-header-offset",
      ),
    ).toBe("0px");
    expect(workspace?.className).toContain(
      "grid-cols-[var(--sidebar-width)_minmax(0,1fr)]",
    );
    expect(
      screen.getByRole("main", { name: "Generation workspace" }),
    ).toBeTruthy();
  });
});

/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { CSSProperties } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { SidebarProvider } from "../primitives/sidebar.tsx";
import { WorkspaceSidebar } from "./workspace-sidebar.tsx";

describe("WorkspaceSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("uses a zero header offset when the host does not provide one", () => {
    const { container } = render(
      <SidebarProvider>
        <WorkspaceSidebar aria-label="Workspace" header={<span>Header</span>}>
          Content
        </WorkspaceSidebar>
      </SidebarProvider>,
    );

    const header = getSidebarHeader(container);

    expect(header.className).toContain(
      "pt-[var(--workspace-sidebar-header-offset,0px)]",
    );
  });

  it("accepts an inherited host header offset", () => {
    render(
      <SidebarProvider
        data-testid="sidebar-host"
        style={
          {
            "--workspace-sidebar-header-offset": "3rem",
          } as CSSProperties
        }
      >
        <WorkspaceSidebar aria-label="Workspace" header={<span>Header</span>}>
          Content
        </WorkspaceSidebar>
      </SidebarProvider>,
    );

    expect(
      screen
        .getByTestId("sidebar-host")
        .style.getPropertyValue("--workspace-sidebar-header-offset"),
    ).toBe("3rem");
  });

  it("preserves its width and collapsed-state animation", () => {
    const { container } = render(
      <SidebarProvider defaultOpen={false}>
        <WorkspaceSidebar aria-label="Workspace" header={<span>Header</span>}>
          Content
        </WorkspaceSidebar>
      </SidebarProvider>,
    );

    const sidebar = screen.getByRole("complementary", { name: "Workspace" });
    const frame = getSidebarHeader(container).parentElement;

    expect(sidebar.getAttribute("data-state")).toBe("collapsed");
    expect(frame).not.toBeNull();
    expect(frame?.className).toContain("w-[var(--sidebar-width)]");
    expect(frame?.className).toContain("max-w-[var(--sidebar-width)]");
    expect(frame?.className).toContain("min-w-[var(--sidebar-width)]");
    expect(frame?.className).toContain("transition-opacity");
    expect(frame?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:opacity-0",
    );
    expect(frame?.className).toContain("motion-reduce:transition-none");
  });
});

function getSidebarHeader(container: HTMLElement) {
  const header = container.querySelector<HTMLElement>(
    '[data-slot="sidebar-header"]',
  );

  if (!header) {
    throw new Error("Expected the workspace sidebar header to be rendered.");
  }

  return header;
}

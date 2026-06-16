/** @vitest-environment jsdom */

import type { ProjectSummary } from "@remora/domain/project/dto";
import { SidebarProvider } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "./app-sidebar.tsx";

describe("AppSidebar", () => {
  afterEach(() => {
    cleanup();
  });

  it("keeps project action visibility tied to row hover or direct action focus", () => {
    renderAppSidebar({
      projects: [
        createProjectSummary({ id: "project_1", name: "Launch concepts" }),
        createProjectSummary({ id: "project_2", name: "Storyboard pass" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    const firstProjectAction = screen.getByRole("button", {
      name: "New generation in Launch concepts",
    });

    expect(firstProjectAction.className).toContain("opacity-0");
    expect(firstProjectAction.className).toContain(
      "group-hover/menu-item:opacity-100",
    );
    expect(firstProjectAction.className).toContain("focus-visible:opacity-100");
    expect(firstProjectAction.className).not.toContain(
      "group-focus-within/menu-item:opacity-100",
    );
  });
});

function renderAppSidebar({ projects = [] }: { projects?: ProjectSummary[] }) {
  return render(
    <SidebarProvider>
      <AppSidebar
        selectedThreadId={null}
        threads={[]}
        projects={projects}
        onCreateProject={vi.fn()}
        onNewGeneration={vi.fn()}
        onNewGenerationInProject={vi.fn()}
        onSelectThread={vi.fn()}
        onSignOut={vi.fn()}
      />
    </SidebarProvider>,
  );
}

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Launch concepts",
    archivedAt: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

/** @vitest-environment jsdom */

import type { GenerationThreadSummary } from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { SidebarProvider } from "@remora/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppSidebar,
  type ProjectThreadRevealRequest,
} from "./app-sidebar.tsx";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

describe("AppSidebar", () => {
  afterEach(() => {
    mocks.navigate.mockReset();
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

  it("reveals project threads when clicking a project row", () => {
    const { container } = renderAppSidebar({
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
      ],
    });

    expect(screen.queryByRole("link", { name: "Hero frames" })).toBeNull();
    expect(container.querySelector(".lucide-folder-open")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    expect(screen.getByRole("link", { name: "Hero frames" })).toBeTruthy();
    expect(container.querySelector(".lucide-folder-open")).toBeTruthy();
  });

  it("reveals project threads from an external reveal request", async () => {
    renderAppSidebar({
      projectThreadRevealRequest: {
        projectId: "project_1",
        threadId: "thread_project_1",
      },
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
      ],
    });

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Hero frames" })).toBeTruthy();
    });
  });

  it("keeps a reveal request ready until refreshed project threads arrive", async () => {
    const projectThreadRevealRequest = {
      projectId: "project_1",
      threadId: "thread_project_1",
    };
    const rendered = renderAppSidebar({
      projectThreadRevealRequest,
      projects: [
        createProjectSummary({ id: "project_1", name: "Launch concepts" }),
      ],
    });

    expect(screen.queryByRole("link", { name: "Hero frames" })).toBeNull();

    rendered.rerender(
      createAppSidebarTestElement({
        projectThreadRevealRequest,
        projects: [
          createProjectSummary({
            id: "project_1",
            name: "Launch concepts",
            threads: [
              createProjectThreadSummary({
                id: "thread_project_1",
                name: "Hero frames",
              }),
            ],
          }),
        ],
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Hero frames" })).toBeTruthy();
    });
  });

  it("animates project thread disclosure without exposing closed links", () => {
    const { container } = renderAppSidebar({
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
      ],
    });

    const projectThreads = container.querySelector<HTMLElement>(
      "[data-slot='app-sidebar-project-threads']",
    );

    expect(projectThreads).not.toBeNull();
    expect(projectThreads?.dataset.state).toBe("closed");
    expect(projectThreads?.getAttribute("aria-hidden")).toBe("true");
    expect(projectThreads?.className).toContain(
      "transition-[grid-template-rows,opacity,transform]",
    );
    expect(projectThreads?.className).toContain(
      "motion-reduce:transition-none",
    );
    expect(screen.queryByRole("link", { name: "Hero frames" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    expect(projectThreads?.dataset.state).toBe("open");
    expect(projectThreads?.hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getByRole("link", { name: "Hero frames" })).toBeTruthy();
  });

  it("keeps multiple projects expanded at the same time", () => {
    renderAppSidebar({
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
        createProjectSummary({
          id: "project_2",
          name: "Storyboard pass",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_2",
              name: "Opening shot",
            }),
          ],
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));
    fireEvent.click(screen.getByRole("button", { name: "Storyboard pass" }));

    expect(screen.getByRole("link", { name: "Hero frames" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Opening shot" })).toBeTruthy();
  });

  it("keeps empty projects closed when clicked", () => {
    const { container } = renderAppSidebar({
      projects: [
        createProjectSummary({ id: "project_1", name: "Launch concepts" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    expect(
      container.querySelector("[data-slot='sidebar-menu-sub']"),
    ).toBeNull();
    expect(container.querySelector(".lucide-folder-open")).toBeNull();
  });

  it("selects nested project threads", () => {
    const onSelectThread = vi.fn();
    renderAppSidebar({
      onSelectThread,
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));
    fireEvent.click(screen.getByRole("link", { name: "Hero frames" }));

    expect(onSelectThread).toHaveBeenCalledWith("thread_project_1");
  });

  it("shows unprojected threads in the global thread section", () => {
    renderAppSidebar({
      threads: [
        createThreadSummary({
          id: "thread_unprojected",
          name: "Loose exploration",
        }),
      ],
      projects: [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_project_1",
              name: "Hero frames",
            }),
          ],
        }),
      ],
    });

    expect(
      screen.getByRole("button", { name: "Loose exploration" }),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Hero frames" })).toBeNull();
  });

  it("opens credits from the settings dropdown", async () => {
    renderAppSidebar();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });
});

function renderAppSidebar({
  onSelectThread = vi.fn(),
  projectThreadRevealRequest = null,
  projects = [],
  threads = [],
}: {
  onSelectThread?: (threadId: string) => void;
  projectThreadRevealRequest?: ProjectThreadRevealRequest | null;
  projects?: ProjectSummary[];
  threads?: GenerationThreadSummary[];
} = {}) {
  return render(
    createAppSidebarTestElement({
      onSelectThread,
      projectThreadRevealRequest,
      projects,
      threads,
    }),
  );
}

function createAppSidebarTestElement({
  onSelectThread = vi.fn(),
  projectThreadRevealRequest = null,
  projects = [],
  threads = [],
}: {
  onSelectThread?: (threadId: string) => void;
  projectThreadRevealRequest?: ProjectThreadRevealRequest | null;
  projects?: ProjectSummary[];
  threads?: GenerationThreadSummary[];
}) {
  return (
    <SidebarProvider>
      <AppSidebar
        projectThreadRevealRequest={projectThreadRevealRequest}
        selectedThreadId={null}
        threads={threads}
        projects={projects}
        onCreateProject={vi.fn()}
        onNewGeneration={vi.fn()}
        onNewGenerationInProject={vi.fn()}
        onSelectThread={onSelectThread}
      />
    </SidebarProvider>
  );
}

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Launch concepts",
    threads: [],
    archivedAt: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

function createProjectThreadSummary(
  overrides: Partial<ProjectSummary["threads"][number]> = {},
): ProjectSummary["threads"][number] {
  return {
    id: "thread_project_1",
    name: "Hero frames",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function createThreadSummary(
  overrides: Partial<GenerationThreadSummary> = {},
): GenerationThreadSummary {
  return {
    id: "thread_1",
    name: "Soft studio treatment",
    createdAt: "2026-06-08T12:00:00.000Z",
    updatedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

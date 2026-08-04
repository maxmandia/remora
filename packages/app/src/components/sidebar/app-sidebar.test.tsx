/** @vitest-environment jsdom */

import type { GenerationThreadSummary } from "@remora/domain/generation-thread/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { SidebarProvider } from "@remora/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppSidebar, type ProjectThreadRevealRequest } from "./app-sidebar.tsx";

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

  it("uses real links for nested and unprojected threads", () => {
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

    const unprojectedThreadLink = screen.getByRole("link", {
      name: "Loose exploration",
    });

    expect(unprojectedThreadLink.getAttribute("href")).toBe(
      "/app/threads/thread_unprojected",
    );
    expect(screen.queryByRole("link", { name: "Hero frames" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    expect(
      screen.getByRole("link", { name: "Hero frames" }).getAttribute("href"),
    ).toBe("/app/threads/thread_project_1");
  });

  it("delegates sidebar actions through explicit callbacks", () => {
    const onCreateProject = vi.fn();
    const onNewGeneration = vi.fn();
    const onNewGenerationInProject = vi.fn();
    renderAppSidebar({
      onCreateProject,
      onNewGeneration,
      onNewGenerationInProject,
      projects: [
        createProjectSummary({ id: "project_1", name: "Launch concepts" }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /^New generation$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation in Launch concepts",
      }),
    );

    expect(onNewGeneration).toHaveBeenCalledTimes(1);
    expect(onCreateProject).toHaveBeenCalledTimes(1);
    expect(onNewGenerationInProject).toHaveBeenCalledWith("project_1");
  });

  it("opens a single-option project menu and delegates rename", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });
    const onRenameProject = vi.fn();
    renderAppSidebar({ onRenameProject, projects: [project] });

    const projectActions = screen.getByRole("button", {
      name: "Project actions for Launch concepts",
    });

    expect(projectActions.className).toContain("opacity-0");
    expect(projectActions.className).toContain("right-7");
    expect(projectActions.className).toContain("hover:bg-transparent");
    expect(projectActions.className).toContain(
      "group-hover/menu-item:opacity-100",
    );
    expect(projectActions.className).toContain("focus-visible:opacity-100");
    expect(projectActions.className).toContain("data-popup-open:opacity-100");
    expect(
      screen.getByRole("button", {
        name: "New generation in Launch concepts",
      }).className,
    ).not.toContain("right-7");

    fireEvent.click(projectActions);

    const renameItem = await screen.findByRole("menuitem", { name: "Rename" });

    expect(screen.getAllByRole("menuitem")).toHaveLength(1);
    fireEvent.click(renameItem);
    expect(onRenameProject).toHaveBeenCalledWith(project);
  });

  it("disables project creation when the host does not allow it", () => {
    const onCreateProject = vi.fn();
    renderAppSidebar({
      createProjectDisabled: true,
      onCreateProject,
    });

    const createProjectButton = screen.getByRole("button", {
      name: "Create project",
    }) as HTMLButtonElement;

    expect(createProjectButton.disabled).toBe(true);
    fireEvent.click(createProjectButton);
    expect(onCreateProject).not.toHaveBeenCalled();
  });

  it("delegates unmodified thread clicks to the host", () => {
    const onSelectThread = vi.fn();
    renderAppSidebar({
      onSelectThread,
      threads: [
        createThreadSummary({
          id: "thread_unprojected",
          name: "Loose exploration",
        }),
      ],
    });

    const threadLink = screen.getByRole("link", {
      name: "Loose exploration",
    });

    expect(fireEvent.click(threadLink)).toBe(false);
    expect(onSelectThread).toHaveBeenCalledWith("thread_unprojected");
  });

  it("preserves native link behavior for modified thread clicks", () => {
    const onSelectThread = vi.fn();
    renderAppSidebar({
      getThreadHref: () => "#thread_unprojected",
      onSelectThread,
      threads: [
        createThreadSummary({
          id: "thread_unprojected",
          name: "Loose exploration",
        }),
      ],
    });

    const threadLink = screen.getByRole("link", {
      name: "Loose exploration",
    });

    expect(fireEvent.click(threadLink, { metaKey: true })).toBe(true);
    expect(onSelectThread).not.toHaveBeenCalled();
  });

  it("marks projected and unprojected active threads as the current page", () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
      threads: [
        createProjectThreadSummary({
          id: "thread_project_1",
          name: "Hero frames",
        }),
      ],
    });
    const rendered = renderAppSidebar({
      projects: [project],
      selectedThreadId: "thread_project_1",
      threads: [
        createThreadSummary({
          id: "thread_unprojected",
          name: "Loose exploration",
        }),
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: "Launch concepts" }));

    expect(
      screen
        .getByRole("link", { name: "Hero frames" })
        .getAttribute("aria-current"),
    ).toBe("page");

    rendered.rerender(
      createAppSidebarTestElement({
        projects: [project],
        selectedThreadId: "thread_unprojected",
        threads: [
          createThreadSummary({
            id: "thread_unprojected",
            name: "Loose exploration",
          }),
        ],
      }),
    );

    expect(
      screen
        .getByRole("link", { name: "Loose exploration" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("renders the empty unprojected-thread state", () => {
    renderAppSidebar();

    expect(screen.getByText("No generations")).toBeTruthy();
  });

  it("renders an optional host footer", () => {
    renderAppSidebar({ footer: <span>Host footer</span> });

    expect(screen.getByText("Host footer")).toBeTruthy();
  });
});

function renderAppSidebar({
  createProjectDisabled,
  footer,
  getThreadHref = (threadId) => `/app/threads/${threadId}`,
  onCreateProject = vi.fn(),
  onNewGeneration = vi.fn(),
  onNewGenerationInProject = vi.fn(),
  onRenameProject = vi.fn(),
  onSelectThread = vi.fn(),
  projectThreadRevealRequest = null,
  projects = [],
  selectedThreadId = null,
  threads = [],
}: {
  createProjectDisabled?: boolean;
  footer?: ReactNode;
  getThreadHref?: (threadId: string) => string;
  onCreateProject?: () => void;
  onNewGeneration?: () => void;
  onNewGenerationInProject?: (projectId: string) => void;
  onRenameProject?: (project: ProjectSummary) => void;
  onSelectThread?: (threadId: string) => void;
  projectThreadRevealRequest?: ProjectThreadRevealRequest | null;
  projects?: ProjectSummary[];
  selectedThreadId?: string | null;
  threads?: GenerationThreadSummary[];
} = {}) {
  return render(
    createAppSidebarTestElement({
      createProjectDisabled,
      footer,
      getThreadHref,
      onCreateProject,
      onNewGeneration,
      onNewGenerationInProject,
      onRenameProject,
      onSelectThread,
      projectThreadRevealRequest,
      projects,
      selectedThreadId,
      threads,
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SidebarProvider>{children}</SidebarProvider>
      ),
    },
  );
}

function createAppSidebarTestElement({
  createProjectDisabled,
  footer,
  getThreadHref = (threadId) => `/app/threads/${threadId}`,
  onCreateProject = vi.fn(),
  onNewGeneration = vi.fn(),
  onNewGenerationInProject = vi.fn(),
  onRenameProject = vi.fn(),
  onSelectThread = vi.fn(),
  projectThreadRevealRequest = null,
  projects = [],
  selectedThreadId = null,
  threads = [],
}: {
  createProjectDisabled?: boolean;
  footer?: ReactNode;
  getThreadHref?: (threadId: string) => string;
  onCreateProject?: () => void;
  onNewGeneration?: () => void;
  onNewGenerationInProject?: (projectId: string) => void;
  onRenameProject?: (project: ProjectSummary) => void;
  onSelectThread?: (threadId: string) => void;
  projectThreadRevealRequest?: ProjectThreadRevealRequest | null;
  projects?: ProjectSummary[];
  selectedThreadId?: string | null;
  threads?: GenerationThreadSummary[];
}) {
  return (
    <AppSidebar
      createProjectDisabled={createProjectDisabled}
      footer={footer}
      getThreadHref={getThreadHref}
      projectThreadRevealRequest={projectThreadRevealRequest}
      selectedThreadId={selectedThreadId}
      threads={threads}
      projects={projects}
      onCreateProject={onCreateProject}
      onNewGeneration={onNewGeneration}
      onNewGenerationInProject={onNewGenerationInProject}
      onRenameProject={onRenameProject}
      onSelectThread={onSelectThread}
    />
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

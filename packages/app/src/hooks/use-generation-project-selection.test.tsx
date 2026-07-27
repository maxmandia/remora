/** @vitest-environment jsdom */

import type { ProjectSummary } from "@remora/domain/project/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useGenerationProjectSelection } from "./use-generation-project-selection.ts";

const mocks = vi.hoisted(() => {
  const listProjects = vi.fn();
  const queryOptions = vi.fn(
    (_input: unknown, options?: Record<string, unknown>) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: listProjects,
    }),
  );

  return {
    authStatus: {
      current: "signed-out" as "loading" | "signed-in" | "signed-out",
    },
    listProjects,
    queryOptions,
  };
});

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    status: mocks.authStatus.current,
  }),
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    project: {
      listProjects: {
        queryOptions: mocks.queryOptions,
      },
    },
  }),
}));

describe("useGenerationProjectSelection", () => {
  beforeEach(() => {
    mocks.authStatus.current = "signed-out";
    mocks.listProjects.mockReset();
    mocks.queryOptions.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not load projects while signed out", async () => {
    const { result } = renderSelection({
      requestedProjectId: null,
      threadId: null,
    });

    await waitFor(() => {
      expect(result.current.projects).toEqual([]);
    });

    expect(mocks.queryOptions).toHaveBeenCalledWith(undefined, {
      enabled: false,
    });
    expect(mocks.listProjects).not.toHaveBeenCalled();
    expect(result.current.isSelectedProjectResolved).toBe(true);
  });

  it("does not expose cached projects after signing out", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      ["project", "listProjects"],
      [createProject("project_1", "Launch concepts")],
    );

    const { result } = renderSelection(
      {
        requestedProjectId: null,
        threadId: null,
      },
      queryClient,
    );

    expect(result.current.projects).toEqual([]);
    expect(result.current.selectedProject).toBeNull();
  });

  it("resolves a requested project for a fresh generation", async () => {
    const project = createProject("project_1", "Launch concepts");
    mocks.authStatus.current = "signed-in";
    mocks.listProjects.mockResolvedValue([project]);

    const { result } = renderSelection({
      requestedProjectId: project.id,
      threadId: null,
    });

    await waitFor(() => {
      expect(result.current.selectedProject).toBe(project);
    });

    expect(result.current.selectedProjectId).toBe(project.id);
    expect(result.current.isSelectedProjectResolved).toBe(true);
  });

  it("preserves an unresolved requested project ID", async () => {
    mocks.authStatus.current = "signed-in";
    mocks.listProjects.mockResolvedValue([]);

    const { result } = renderSelection({
      requestedProjectId: "missing_project",
      threadId: null,
    });

    await waitFor(() => {
      expect(mocks.listProjects).toHaveBeenCalledOnce();
    });

    expect(result.current.selectedProject).toBeNull();
    expect(result.current.selectedProjectId).toBe("missing_project");
    expect(result.current.isSelectedProjectResolved).toBe(false);
  });

  it("uses the active thread's project instead of requested search state", async () => {
    const project = createProject("project_1", "Launch concepts", [
      {
        id: "thread_1",
        name: "Hero frames",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mocks.authStatus.current = "signed-in";
    mocks.listProjects.mockResolvedValue([project]);

    const { result } = renderSelection({
      requestedProjectId: "other_project",
      threadId: "thread_1",
    });

    await waitFor(() => {
      expect(result.current.selectedProject).toBe(project);
    });

    expect(result.current.selectedProjectId).toBe(project.id);
    expect(result.current.isSelectedProjectResolved).toBe(true);
  });

  it("represents a thread outside projects as no project", async () => {
    mocks.authStatus.current = "signed-in";
    mocks.listProjects.mockResolvedValue([
      createProject("project_1", "Launch concepts"),
    ]);

    const { result } = renderSelection({
      requestedProjectId: null,
      threadId: "thread_without_project",
    });

    await waitFor(() => {
      expect(mocks.listProjects).toHaveBeenCalledOnce();
    });

    expect(result.current.selectedProject).toBeNull();
    expect(result.current.selectedProjectId).toBeNull();
    expect(result.current.isSelectedProjectResolved).toBe(true);
  });
});

function renderSelection(
  input: {
    requestedProjectId: string | null;
    threadId: string | null;
  },
  queryClient = createTestQueryClient(),
) {
  return renderHook(() => useGenerationProjectSelection(input), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children),
  });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createProject(
  id: string,
  name: string,
  threads: ProjectSummary["threads"] = [],
): ProjectSummary {
  return {
    id,
    name,
    threads,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

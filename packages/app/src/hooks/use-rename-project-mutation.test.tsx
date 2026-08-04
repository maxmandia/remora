/**
 * @vitest-environment jsdom
 */

import type { ProjectSummary } from "@remora/domain/project/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useRenameProjectMutation } from "./use-rename-project-mutation.ts";

const projectListQueryKey = ["project", "listProjects"] as const;

const mocks = vi.hoisted(() => ({
  projectListQueryFilter: vi.fn(),
  renameProject: vi.fn(),
  renameProjectMutationOptions: vi.fn(),
}));

vi.mock("../trpc.ts", () => ({
  useTRPC: () => ({
    project: {
      listProjects: {
        queryFilter: mocks.projectListQueryFilter,
      },
      renameProject: {
        mutationOptions: mocks.renameProjectMutationOptions,
      },
    },
  }),
}));

describe("useRenameProjectMutation", () => {
  beforeEach(() => {
    mocks.projectListQueryFilter.mockReset();
    mocks.renameProject.mockReset();
    mocks.renameProjectMutationOptions.mockReset();
    mocks.projectListQueryFilter.mockReturnValue({
      queryKey: projectListQueryKey,
    });
    mocks.renameProjectMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.renameProject,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("optimistically renames, reorders, and reconciles a project", async () => {
    const firstProject = createProjectSummary({
      id: "project_1",
      name: "First project",
    });
    const renamedProject = createProjectSummary({
      id: "project_2",
      name: "Old name",
    });
    const renameProject =
      createDeferred<Pick<ProjectSummary, "id" | "name" | "updatedAt">>();
    const onSuccess = vi.fn();
    const rendered = renderRenameProjectMutation({ onSuccess });
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );

    rendered.queryClient.setQueryData(projectListQueryKey, [
      firstProject,
      renamedProject,
    ]);
    mocks.renameProject.mockReturnValueOnce(renameProject.promise);

    const mutationPromise = rendered.result.current.mutateAsync({
      projectId: renamedProject.id,
      name: "New name",
    });

    await waitFor(() => {
      expect(
        rendered.queryClient
          .getQueryData<ProjectSummary[]>(projectListQueryKey)
          ?.map(({ id, name }) => ({ id, name })),
      ).toEqual([
        { id: "project_2", name: "New name" },
        { id: "project_1", name: "First project" },
      ]);
    });

    await act(async () => {
      renameProject.resolve({
        id: renamedProject.id,
        name: "New name",
        updatedAt: "2026-06-16T12:00:00.000Z",
      });
      await mutationPromise;
    });

    expect(
      rendered.queryClient.getQueryData<ProjectSummary[]>(
        projectListQueryKey,
      )?.[0],
    ).toEqual({
      ...renamedProject,
      name: "New name",
      updatedAt: "2026-06-16T12:00:00.000Z",
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: projectListQueryKey,
    });
  });

  it("rolls back the failed project while preserving concurrent entries", async () => {
    const firstProject = createProjectSummary({
      id: "project_1",
      name: "First project",
    });
    const renamedProject = createProjectSummary({
      id: "project_2",
      name: "Old name",
    });
    const concurrentProject = createProjectSummary({
      id: "project_concurrent",
      name: "Concurrent project",
    });
    const renameProject = createDeferred<never>();
    const error = new Error("Project already exists");
    const onError = vi.fn();
    const rendered = renderRenameProjectMutation({ onError });

    rendered.queryClient.setQueryData(projectListQueryKey, [
      firstProject,
      renamedProject,
    ]);
    mocks.renameProject.mockReturnValueOnce(renameProject.promise);

    const mutationPromise = rendered.result.current.mutateAsync({
      projectId: renamedProject.id,
      name: "New name",
    });

    await waitFor(() => {
      expect(
        rendered.queryClient.getQueryData<ProjectSummary[]>(
          projectListQueryKey,
        )?.[0]?.name,
      ).toBe("New name");
    });

    rendered.queryClient.setQueryData(
      projectListQueryKey,
      (projects: ProjectSummary[]) => [...projects, concurrentProject],
    );

    await act(async () => {
      renameProject.reject(error);
      await expect(mutationPromise).rejects.toBe(error);
    });

    expect(
      rendered.queryClient.getQueryData<ProjectSummary[]>(projectListQueryKey),
    ).toEqual([firstProject, renamedProject, concurrentProject]);
    expect(onError).toHaveBeenCalledWith({
      error,
      input: { projectId: "project_2", name: "New name" },
    });
  });
});

function renderRenameProjectMutation(
  options: Parameters<typeof useRenameProjectMutation>[0] = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const rendered = renderHook(() => useRenameProjectMutation(options), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return { ...rendered, queryClient };
}

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Project",
    threads: [],
    archivedAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

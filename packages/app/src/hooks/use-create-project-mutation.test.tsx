/**
 * @vitest-environment jsdom
 */

import type { ProjectSummary } from "@remora/domain/project/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCreateProjectMutation } from "./use-create-project-mutation.ts";

const projectListQueryKey = ["project", "listProjects"] as const;

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  createProjectMutationOptions: vi.fn(),
  projectListQueryFilter: vi.fn(),
}));

vi.mock("../trpc.ts", () => ({
  useTRPC: () => ({
    project: {
      createProject: {
        mutationOptions: mocks.createProjectMutationOptions,
      },
      listProjects: {
        queryFilter: mocks.projectListQueryFilter,
      },
    },
  }),
}));

describe("useCreateProjectMutation", () => {
  beforeEach(() => {
    mocks.createProject.mockReset();
    mocks.createProjectMutationOptions.mockReset();
    mocks.projectListQueryFilter.mockReset();
    mocks.createProjectMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createProject,
    }));
    mocks.projectListQueryFilter.mockReturnValue({
      queryKey: projectListQueryKey,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("inserts and reconciles an optimistic project", async () => {
    const createdProject = createProjectSummary({
      id: "project_created",
      name: "Launch concepts",
    });
    const duplicateCreatedProject = createProjectSummary({
      id: createdProject.id,
      name: "Stale project",
    });
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });
    const createProject = createDeferred<ProjectSummary>();
    const rendered = renderCreateProjectMutation();
    const cancelQueries = vi.spyOn(rendered.queryClient, "cancelQueries");
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );
    let mutationPromise!: Promise<ProjectSummary>;

    rendered.queryClient.setQueryData(projectListQueryKey, [
      duplicateCreatedProject,
      existingProject,
    ]);
    mocks.createProject.mockReturnValueOnce(createProject.promise);

    act(() => {
      mutationPromise = rendered.result.current.mutateAsync({
        name: "Launch concepts",
      });
    });

    await waitFor(() => {
      expect(cancelQueries).toHaveBeenCalledWith({
        queryKey: projectListQueryKey,
      });
      expect(
        rendered.queryClient.getQueryData<ProjectSummary[]>(
          projectListQueryKey,
        )?.[0],
      ).toEqual(
        expect.objectContaining({
          id: expect.stringMatching(/^optimistic-project:\d+$/),
          name: "Launch concepts",
        }),
      );
    });

    await act(async () => {
      createProject.resolve(createdProject);
      await mutationPromise;
    });

    expect(
      rendered.queryClient.getQueryData<ProjectSummary[]>(projectListQueryKey),
    ).toEqual([createdProject, existingProject]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: projectListQueryKey,
    });
    expect(mocks.createProjectMutationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: {
          suppressErrorToast: true,
        },
      }),
    );
  });

  it("rolls back only its optimistic project and reports the failed input", async () => {
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });
    const concurrentProject = createProjectSummary({
      id: "project_concurrent",
      name: "Concurrent project",
    });
    const error = new Error("Project already exists");
    const createProject = createDeferred<ProjectSummary>();
    const onError = vi.fn();
    const rendered = renderCreateProjectMutation({ onError });
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );
    let mutationPromise!: Promise<ProjectSummary>;

    rendered.queryClient.setQueryData(projectListQueryKey, [existingProject]);
    mocks.createProject.mockReturnValueOnce(createProject.promise);

    act(() => {
      mutationPromise = rendered.result.current.mutateAsync({
        name: "Launch concepts",
      });
    });

    let optimisticProject!: ProjectSummary;

    await waitFor(() => {
      const projects =
        rendered.queryClient.getQueryData<ProjectSummary[]>(
          projectListQueryKey,
        );

      expect(projects).toHaveLength(2);
      optimisticProject = projects![0]!;
    });

    rendered.queryClient.setQueryData(projectListQueryKey, [
      optimisticProject,
      concurrentProject,
      existingProject,
    ]);

    await act(async () => {
      createProject.reject(error);

      await expect(mutationPromise).rejects.toBe(error);
    });

    expect(
      rendered.queryClient.getQueryData<ProjectSummary[]>(projectListQueryKey),
    ).toEqual([concurrentProject, existingProject]);
    expect(onError).toHaveBeenCalledWith({
      error,
      input: { name: "Launch concepts" },
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: projectListQueryKey,
    });
  });
});

function renderCreateProjectMutation(
  options: Parameters<typeof useCreateProjectMutation>[0] = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: {
        retry: false,
      },
      queries: {
        retry: false,
      },
    },
  });
  const rendered = renderHook(() => useCreateProjectMutation(options), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return {
    ...rendered,
    queryClient,
  };
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

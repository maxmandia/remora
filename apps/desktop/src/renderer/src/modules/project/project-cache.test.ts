import { describe, expect, it } from "vitest";

import {
  createOptimisticProject,
  prependProject,
  removeProjectById,
  replaceOptimisticProject,
} from "./project-cache.ts";

import type { ProjectSummary } from "@remora/domain/project/dto";

describe("project cache helpers", () => {
  it("creates optimistic project summaries", () => {
    const project = createOptimisticProject(
      { name: "Launch concepts" },
      new Date("2026-06-15T12:00:00.000Z"),
    );

    expect(project).toEqual({
      id: expect.stringMatching(/^optimistic-project:\d+$/),
      name: "Launch concepts",
      archivedAt: null,
      createdAt: "2026-06-15T12:00:00.000Z",
      updatedAt: "2026-06-15T12:00:00.000Z",
    });
  });

  it("prepends optimistic projects without mutating the current list", () => {
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });
    const optimisticProject = createProjectSummary({
      id: "optimistic-project:1",
      name: "Launch concepts",
    });
    const currentProjects = [existingProject];

    const nextProjects = prependProject(currentProjects, optimisticProject);

    expect(nextProjects).toEqual([optimisticProject, existingProject]);
    expect(currentProjects).toEqual([existingProject]);
    expect(nextProjects).not.toBe(currentProjects);
  });

  it("replaces optimistic projects and removes duplicate server projects", () => {
    const optimisticProject = createProjectSummary({
      id: "optimistic-project:1",
      name: "Launch concepts",
    });
    const createdProject = createProjectSummary({
      id: "project_created",
      name: "Launch concepts",
    });
    const duplicateCreatedProject = createProjectSummary({
      id: "project_created",
      name: "Stale project",
    });
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });

    expect(
      replaceOptimisticProject(
        [optimisticProject, duplicateCreatedProject, existingProject],
        optimisticProject.id,
        createdProject,
      ),
    ).toEqual([createdProject, existingProject]);
  });

  it("removes only the optimistic project on rollback", () => {
    const optimisticProject = createProjectSummary({
      id: "optimistic-project:1",
      name: "Launch concepts",
    });
    const concurrentProject = createProjectSummary({
      id: "project_concurrent",
      name: "Concurrent project",
    });
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });

    expect(
      removeProjectById(
        [optimisticProject, concurrentProject, existingProject],
        optimisticProject.id,
      ),
    ).toEqual([concurrentProject, existingProject]);
  });
});

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Project",
    archivedAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

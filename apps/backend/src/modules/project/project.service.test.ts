import { describe, expect, it, vi } from "vitest";

import { ProjectService } from "./project.service.ts";

vi.mock("./project.repository.ts", () => ({
  projectRepository: { createProject: vi.fn() },
}));

describe("project service", () => {
  it("tracks successfully created projects without exposing the name", async () => {
    const project = {
      id: "project_1",
      name: "Launch concepts",
      threads: [],
      archivedAt: null,
      createdAt: "2026-07-13T12:00:00.000Z",
      updatedAt: "2026-07-13T12:00:00.000Z",
    };
    const repository = { createProject: vi.fn().mockResolvedValue(project) };
    const analytics = { track: vi.fn() };
    const service = new ProjectService(repository as never, analytics);

    await expect(
      service.createProject({ userId: "user_1", name: project.name }),
    ).resolves.toBe(project);
    expect(analytics.track).toHaveBeenCalledWith({
      type: "project_created",
      userId: "user_1",
      projectId: "project_1",
      occurredAt: new Date("2026-07-13T12:00:00.000Z"),
    });
    expect(analytics.track).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: project.name }),
    );
  });

  it("does not track failed project creation", async () => {
    const repository = {
      createProject: vi.fn().mockRejectedValue(new Error("insert failed")),
    };
    const analytics = { track: vi.fn() };
    const service = new ProjectService(repository as never, analytics);

    await expect(
      service.createProject({ userId: "user_1", name: "Launch concepts" }),
    ).rejects.toThrow("insert failed");
    expect(analytics.track).not.toHaveBeenCalled();
  });
});

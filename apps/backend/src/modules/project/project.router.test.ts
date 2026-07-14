import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectRouter } from "./project.router.ts";
import { DuplicateProjectNameError } from "./project.types.ts";

import type { TRPCContext } from "../../trpc/context.ts";

const mocks = vi.hoisted(() => ({
  createProject: vi.fn(),
  listProjectsForUser: vi.fn(),
}));

vi.mock("./project.repository.ts", () => ({
  projectRepository: {
    listProjectsForUser: mocks.listProjectsForUser,
  },
}));

vi.mock("../../app.service.ts", () => ({
  projectService: {
    createProject: mocks.createProject,
  },
}));

describe("project router", () => {
  beforeEach(() => {
    mocks.createProject.mockReset();
    mocks.listProjectsForUser.mockReset();
    mocks.createProject.mockResolvedValue({
      id: "project_1",
      name: "Launch concepts",
      threads: [],
      archivedAt: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    mocks.listProjectsForUser.mockResolvedValue([
      {
        id: "project_1",
        name: "Launch concepts",
        threads: [],
        archivedAt: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ]);
  });

  it("lists projects for the signed-in user", async () => {
    const caller = projectRouter.createCaller(createSignedInContext());

    await expect(caller.listProjects()).resolves.toEqual([
      {
        id: "project_1",
        name: "Launch concepts",
        threads: [],
        archivedAt: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ]);
    expect(mocks.listProjectsForUser).toHaveBeenCalledWith("user_1");
  });

  it("creates projects with trimmed names for the signed-in user", async () => {
    const caller = projectRouter.createCaller(createSignedInContext());

    await expect(
      caller.createProject({ name: "  Launch concepts  " }),
    ).resolves.toEqual({
      id: "project_1",
      name: "Launch concepts",
      threads: [],
      archivedAt: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    expect(mocks.createProject).toHaveBeenCalledWith({
      userId: "user_1",
      name: "Launch concepts",
    });
  });

  it("rejects invalid create project input", async () => {
    const caller = projectRouter.createCaller(createSignedInContext());

    await expect(caller.createProject({ name: "   " })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      caller.createProject({ name: "a".repeat(51) }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mocks.createProject).not.toHaveBeenCalled();
  });

  it("maps duplicate project names to conflicts", async () => {
    const caller = projectRouter.createCaller(createSignedInContext());
    mocks.createProject.mockRejectedValue(
      new DuplicateProjectNameError("Launch concepts"),
    );

    await expect(
      caller.createProject({ name: "Launch concepts" }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: 'A project named "Launch concepts" already exists.',
    });
  });
});

function createSignedInContext(): TRPCContext {
  return {
    session: {
      id: "session_1",
    },
    user: {
      id: "user_1",
      name: "User",
      email: "user@example.test",
      emailVerified: true,
      image: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    },
  } as unknown as TRPCContext;
}

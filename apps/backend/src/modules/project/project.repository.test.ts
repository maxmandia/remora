import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectRepository } from "./project.repository.ts";
import { DuplicateProjectNameError } from "./project.types.ts";

const mocks = vi.hoisted(() => ({
  projectRows: [] as unknown[],
  findManyProjects: vi.fn(),
  insertRows: [] as unknown[],
  insertError: null as unknown,
  insertValues: vi.fn(),
  randomUUID: vi.fn(),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  eq: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
  projectTable: {
    id: "project.id",
    userId: "project.user_id",
    name: "project.name",
    archivedAt: "project.archived_at",
    createdAt: "project.created_at",
    updatedAt: "project.updated_at",
  },
  generationThreadTable: {
    id: "generation_thread.id",
    projectId: "generation_thread.project_id",
    userId: "generation_thread.user_id",
    name: "generation_thread.name",
    createdAt: "generation_thread.created_at",
    updatedAt: "generation_thread.updated_at",
  },
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("../../db/client.ts", () => ({
  db: {
    query: {
      project: {
        findMany: mocks.findManyProjects,
      },
    },
    insert: vi.fn(() => createInsertChain()),
  },
  schema: {
    project: mocks.projectTable,
    generationThread: mocks.generationThreadTable,
  },
}));

describe("project repository", () => {
  beforeEach(() => {
    mocks.projectRows = [];
    mocks.findManyProjects.mockReset();
    mocks.findManyProjects.mockImplementation(
      async (options: {
        where?: (
          project: typeof mocks.projectTable,
          operators: {
            and: typeof mocks.and;
            eq: typeof mocks.eq;
            isNull: typeof mocks.isNull;
          },
        ) => unknown;
        orderBy?: (
          project: typeof mocks.projectTable,
          operators: { desc: typeof mocks.desc },
        ) => unknown;
        with?: {
          threads?: {
            orderBy?: (
              thread: typeof mocks.generationThreadTable,
              operators: { desc: typeof mocks.desc },
            ) => unknown;
          };
        };
      }) => {
        options.where?.(mocks.projectTable, {
          and: mocks.and,
          eq: mocks.eq,
          isNull: mocks.isNull,
        });
        options.orderBy?.(mocks.projectTable, { desc: mocks.desc });
        options.with?.threads?.orderBy?.(mocks.generationThreadTable, {
          desc: mocks.desc,
        });

        return mocks.projectRows;
      },
    );
    mocks.insertRows = [];
    mocks.insertError = null;
    mocks.insertValues.mockClear();
    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("project_1");
    mocks.and.mockClear();
    mocks.desc.mockClear();
    mocks.eq.mockClear();
    mocks.isNull.mockClear();
  });

  it("lists active user projects by most recently updated", async () => {
    mocks.projectRows = [
      {
        id: "project_2",
        name: "Second project",
        threads: [],
        archivedAt: null,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-06T00:00:00.000Z"),
      },
      {
        id: "project_1",
        name: "First project",
        threads: [
          {
            id: "thread_2",
            name: "Second thread",
            createdAt: new Date("2026-06-08T00:00:00.000Z"),
            updatedAt: new Date("2026-06-09T00:00:00.000Z"),
          },
          {
            id: "thread_1",
            name: "First thread",
            createdAt: new Date("2026-06-07T00:00:00.000Z"),
            updatedAt: new Date("2026-06-08T00:00:00.000Z"),
          },
        ],
        archivedAt: null,
        createdAt: new Date("2026-06-04T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    ];

    await expect(
      projectRepository.listProjectsForUser("user_1"),
    ).resolves.toEqual([
      {
        id: "project_2",
        name: "Second project",
        threads: [],
        archivedAt: null,
        createdAt: "2026-06-05T00:00:00.000Z",
        updatedAt: "2026-06-06T00:00:00.000Z",
      },
      {
        id: "project_1",
        name: "First project",
        threads: [
          {
            id: "thread_2",
            name: "Second thread",
            createdAt: "2026-06-08T00:00:00.000Z",
            updatedAt: "2026-06-09T00:00:00.000Z",
          },
          {
            id: "thread_1",
            name: "First thread",
            createdAt: "2026-06-07T00:00:00.000Z",
            updatedAt: "2026-06-08T00:00:00.000Z",
          },
        ],
        archivedAt: null,
        createdAt: "2026-06-04T00:00:00.000Z",
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ]);
    expect(mocks.eq).toHaveBeenCalledWith("project.user_id", "user_1");
    expect(mocks.isNull).toHaveBeenCalledWith("project.archived_at");
    expect(mocks.desc).toHaveBeenCalledWith("project.updated_at");
    expect(mocks.desc).toHaveBeenCalledWith("generation_thread.updated_at");
  });

  it("returns no projects", async () => {
    mocks.projectRows = [];

    await expect(
      projectRepository.listProjectsForUser("user_1"),
    ).resolves.toEqual([]);
    expect(mocks.findManyProjects).toHaveBeenCalledTimes(1);
  });

  it("creates projects with trimmed names and generated ids", async () => {
    mocks.insertRows = [
      {
        id: "project_1",
        name: "Launch concepts",
        archivedAt: null,
        createdAt: new Date("2026-06-05T00:00:00.000Z"),
        updatedAt: new Date("2026-06-05T00:00:00.000Z"),
      },
    ];

    await expect(
      projectRepository.createProject({
        userId: "user_1",
        name: "  Launch concepts  ",
      }),
    ).resolves.toEqual({
      id: "project_1",
      name: "Launch concepts",
      threads: [],
      archivedAt: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    expect(mocks.insertValues).toHaveBeenCalledWith({
      id: "project_1",
      userId: "user_1",
      name: "Launch concepts",
    });
  });

  it("maps project name unique index conflicts", async () => {
    mocks.insertError = {
      code: "23505",
      constraint_name: "project_user_id_lower_name_idx",
    };

    await expect(
      projectRepository.createProject({
        userId: "user_1",
        name: "  Launch concepts  ",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_PROJECT_NAME",
      name: "Launch concepts",
    });
    await expect(
      projectRepository.createProject({
        userId: "user_1",
        name: "Launch concepts",
      }),
    ).rejects.toBeInstanceOf(DuplicateProjectNameError);
  });

  it("maps wrapped project name unique index conflicts", async () => {
    mocks.insertError = {
      message:
        'Failed query: insert into "project" ("id", "user_id", "name") values ($1, $2, $3)',
      cause: {
        code: "23505",
        constraint_name: "project_user_id_lower_name_idx",
      },
    };

    await expect(
      projectRepository.createProject({
        userId: "user_1",
        name: "  Launch concepts  ",
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_PROJECT_NAME",
      name: "Launch concepts",
    });
  });
});

function createInsertChain() {
  const chain = {
    values: vi.fn((values: unknown) => {
      mocks.insertValues(values);

      return chain;
    }),
    returning: vi.fn(async () => {
      if (mocks.insertError) {
        throw mocks.insertError;
      }

      return mocks.insertRows;
    }),
  };

  return chain;
}

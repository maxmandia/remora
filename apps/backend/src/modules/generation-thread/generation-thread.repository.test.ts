import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationThreadRepository } from "./generation-thread.repository.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
} from "./generation-thread.types.ts";

const schema = vi.hoisted(() => ({
  generationThread: {
    id: "generation_thread.id",
    projectId: "generation_thread.project_id",
    userId: "generation_thread.user_id",
    name: "generation_thread.name",
    createdAt: "generation_thread.created_at",
    updatedAt: "generation_thread.updated_at",
  },
  project: {
    id: "project.id",
    userId: "project.user_id",
    archivedAt: "project.archived_at",
  },
}));

vi.mock("../../db/client.ts", () => ({
  db: {},
  schema,
}));

const randomUUID = vi.hoisted(() => vi.fn(() => "thread_1"));

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  randomUUID,
}));

describe("GenerationThreadRepository", () => {
  let state: ReturnType<typeof createExecutorState>;
  let repository: GenerationThreadRepository;

  beforeEach(() => {
    state = createExecutorState();
    repository = new GenerationThreadRepository(state.executor as never);
    randomUUID.mockReset();
    randomUUID.mockReturnValue("thread_1");
  });

  it("lists standalone threads by most recent activity", async () => {
    state.selectRows = [
      createThread({
        id: "thread_2",
        name: "Second thread",
        updatedAt: new Date("2026-07-02T00:00:00.000Z"),
      }),
      createThread({
        id: "thread_1",
        name: "First thread",
        updatedAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ];

    await expect(
      repository.listThreadsWithoutProjectForUser("user_1"),
    ).resolves.toEqual([
      {
        id: "thread_2",
        name: "Second thread",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-02T00:00:00.000Z",
      },
      {
        id: "thread_1",
        name: "First thread",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z",
      },
    ]);
  });

  it("creates threads inside owned active projects", async () => {
    state.selectRows = [{ id: "project_1" }];
    state.insertRows = [
      createThread({ projectId: "project_1", name: "Quiet ocean studio" }),
    ];

    await expect(
      repository.createThread({
        userId: "user_1",
        projectId: "project_1",
        name: "Quiet ocean studio",
      }),
    ).resolves.toMatchObject({
      id: "thread_1",
      projectId: "project_1",
      name: "Quiet ocean studio",
    });
    expect(state.insertValues).toHaveBeenCalledWith({
      id: "thread_1",
      userId: "user_1",
      projectId: "project_1",
      name: "Quiet ocean studio",
    });
  });

  it("rejects missing, cross-user, or archived projects", async () => {
    state.selectRows = [];

    await expect(
      repository.createThread({
        userId: "user_1",
        projectId: "project_1",
        name: "Quiet ocean studio",
      }),
    ).rejects.toBeInstanceOf(GenerationProjectNotFoundError);
    expect(state.insertValues).not.toHaveBeenCalled();
  });

  it("touches only owned threads", async () => {
    state.updateRows = [{ id: "thread_1" }];

    await expect(
      repository.touchOwnedThread({
        userId: "user_1",
        threadId: "thread_1",
      }),
    ).resolves.toBeUndefined();
    expect(state.updateSet).toHaveBeenCalledWith({
      updatedAt: expect.any(Date),
    });

    state.updateRows = [];
    await expect(
      repository.touchOwnedThread({
        userId: "user_2",
        threadId: "thread_1",
      }),
    ).rejects.toBeInstanceOf(GenerationThreadNotFoundError);
  });

  it("updates a generated name only while the provisional name is unchanged", async () => {
    state.updateRows = [{ id: "thread_1" }];

    await expect(
      repository.updateNameIfUnchanged({
        userId: "user_1",
        threadId: "thread_1",
        expectedName: "A quiet ocean studio",
        name: "Quiet Ocean Studio",
      }),
    ).resolves.toBe(true);
    expect(state.updateSet).toHaveBeenCalledWith({
      name: "Quiet Ocean Studio",
    });

    state.updateRows = [];
    await expect(
      repository.updateNameIfUnchanged({
        userId: "user_1",
        threadId: "thread_1",
        expectedName: "A quiet ocean studio",
        name: "Quiet Ocean Studio",
      }),
    ).resolves.toBe(false);
  });
});

function createExecutorState() {
  const state = {
    selectRows: [] as unknown[],
    insertRows: [] as unknown[],
    updateRows: [] as unknown[],
    insertValues: vi.fn(),
    updateSet: vi.fn(),
    executor: {} as Record<string, unknown>,
  };
  const selectTail = {
    limit: vi.fn(async () => state.selectRows),
    orderBy: vi.fn(async () => state.selectRows),
  };

  state.executor = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => selectTail),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values) => {
        state.insertValues(values);
        return {
          returning: vi.fn(async () => state.insertRows),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values) => {
        state.updateSet(values);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => state.updateRows),
          })),
        };
      }),
    })),
  };

  return state;
}

function createThread(overrides: Record<string, unknown> = {}) {
  return {
    id: "thread_1",
    projectId: null,
    userId: "user_1",
    name: "Thread",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    ...overrides,
  };
}

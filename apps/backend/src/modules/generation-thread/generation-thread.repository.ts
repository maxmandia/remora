import { and, desc, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import type { GenerationThreadSummary } from "@remora/domain/generation-thread/dto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import {
  GenerationProjectNotFoundError,
  GenerationThreadNotFoundError,
  type GenerationThreadRecord,
} from "./generation-thread.types.ts";

export class GenerationThreadRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listThreadsWithoutProjectForUser(
    userId: string,
  ): Promise<GenerationThreadSummary[]> {
    const rows = await this.executor
      .select({
        id: schema.generationThread.id,
        name: schema.generationThread.name,
        createdAt: schema.generationThread.createdAt,
        updatedAt: schema.generationThread.updatedAt,
      })
      .from(schema.generationThread)
      .where(
        and(
          eq(schema.generationThread.userId, userId),
          isNull(schema.generationThread.projectId),
        ),
      )
      .orderBy(desc(schema.generationThread.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async createThread({
    userId,
    projectId,
    name,
  }: {
    userId: string;
    projectId?: string;
    name: string;
  }): Promise<GenerationThreadRecord> {
    if (projectId) {
      const [project] = await this.executor
        .select({ id: schema.project.id })
        .from(schema.project)
        .where(
          and(
            eq(schema.project.id, projectId),
            eq(schema.project.userId, userId),
            isNull(schema.project.archivedAt),
          ),
        )
        .limit(1);

      if (!project) {
        throw new GenerationProjectNotFoundError(projectId);
      }
    }

    const [thread] = await this.executor
      .insert(schema.generationThread)
      .values({
        id: randomUUID(),
        userId,
        name,
        ...(projectId ? { projectId } : {}),
      })
      .returning();

    if (!thread) {
      throw new Error("Generation thread was not created");
    }

    return thread;
  }

  async touchOwnedThread({
    userId,
    threadId,
  }: {
    userId: string;
    threadId: string;
  }): Promise<void> {
    const [thread] = await this.executor
      .update(schema.generationThread)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(schema.generationThread.id, threadId),
          eq(schema.generationThread.userId, userId),
        ),
      )
      .returning({ id: schema.generationThread.id });

    if (!thread) {
      throw new GenerationThreadNotFoundError(threadId);
    }
  }

  async updateNameIfUnchanged({
    userId,
    threadId,
    expectedName,
    name,
  }: {
    userId: string;
    threadId: string;
    expectedName: string;
    name: string;
  }): Promise<boolean> {
    const [thread] = await this.executor
      .update(schema.generationThread)
      .set({ name })
      .where(
        and(
          eq(schema.generationThread.id, threadId),
          eq(schema.generationThread.userId, userId),
          eq(schema.generationThread.name, expectedName),
        ),
      )
      .returning({ id: schema.generationThread.id });

    return Boolean(thread);
  }
}

export const generationThreadRepository = new GenerationThreadRepository();

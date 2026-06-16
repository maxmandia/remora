import { randomUUID } from "node:crypto";

import type { ProjectSummary } from "@remora/domain/project/dto";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "../../db/client.ts";
import {
  DuplicateProjectNameError,
  projectUserIdLowerNameIndexName,
} from "./project.types.ts";

export class ProjectRepository {
  async listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
    const rows = await db
      .select({
        id: schema.project.id,
        name: schema.project.name,
        archivedAt: schema.project.archivedAt,
        createdAt: schema.project.createdAt,
        updatedAt: schema.project.updatedAt,
      })
      .from(schema.project)
      .where(
        and(
          eq(schema.project.userId, userId),
          isNull(schema.project.archivedAt),
        ),
      )
      .orderBy(desc(schema.project.updatedAt));

    return rows.map(serializeProjectSummary);
  }

  async createProject({
    userId,
    name,
  }: {
    userId: string;
    name: string;
  }): Promise<ProjectSummary> {
    const projectName = name.trim();

    try {
      const [project] = await db
        .insert(schema.project)
        .values({
          id: randomUUID(),
          userId,
          name: projectName,
        })
        .returning({
          id: schema.project.id,
          name: schema.project.name,
          archivedAt: schema.project.archivedAt,
          createdAt: schema.project.createdAt,
          updatedAt: schema.project.updatedAt,
        });

      if (!project) {
        throw new Error("Project was not created");
      }

      return serializeProjectSummary(project);
    } catch (error) {
      if (isDuplicateProjectNameError(error)) {
        throw new DuplicateProjectNameError(projectName);
      }

      throw error;
    }
  }
}

export const projectRepository = new ProjectRepository();

function serializeProjectSummary(project: {
  id: string;
  name: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function isDuplicateProjectNameError(error: unknown) {
  const visitedErrors = new Set<unknown>();
  let currentError: unknown = error;

  while (isRecord(currentError) && !visitedErrors.has(currentError)) {
    if (
      currentError.code === "23505" &&
      currentError.constraint_name === projectUserIdLowerNameIndexName
    ) {
      return true;
    }

    visitedErrors.add(currentError);
    currentError = currentError.cause;
  }

  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

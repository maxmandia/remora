import { randomUUID } from "node:crypto";

import type {
  ProjectSummary,
  ProjectThreadSummary,
} from "@remora/domain/project/dto";

import { db, schema, type DatabaseExecutor } from "../../db/client.ts";
import {
  DuplicateProjectNameError,
  projectUserIdLowerNameIndexName,
} from "./project.types.ts";

export class ProjectRepository {
  constructor(private readonly executor: DatabaseExecutor = db) {}

  async listProjectsForUser(userId: string): Promise<ProjectSummary[]> {
    const projectRows = await this.executor.query.project.findMany({
      columns: {
        id: true,
        name: true,
        archivedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      where: (project, { and, eq, isNull }) =>
        and(eq(project.userId, userId), isNull(project.archivedAt)),
      orderBy: (project, { desc }) => [desc(project.updatedAt)],
      with: {
        threads: {
          columns: {
            id: true,
            name: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: (thread, { desc }) => [desc(thread.updatedAt)],
        },
      },
    });

    return projectRows.map((project) =>
      serializeProjectSummary(
        project,
        project.threads.map(serializeProjectThreadSummary),
      ),
    );
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
      const [project] = await this.executor
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

      return serializeProjectSummary(project, []);
    } catch (error) {
      if (isDuplicateProjectNameError(error)) {
        throw new DuplicateProjectNameError(projectName);
      }

      throw error;
    }
  }
}

export const projectRepository = new ProjectRepository();

function serializeProjectSummary(
  project: {
    id: string;
    name: string;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  threads: ProjectThreadSummary[],
): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    threads,
    archivedAt: project.archivedAt?.toISOString() ?? null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function serializeProjectThreadSummary(thread: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): ProjectThreadSummary {
  return {
    id: thread.id,
    name: thread.name,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
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

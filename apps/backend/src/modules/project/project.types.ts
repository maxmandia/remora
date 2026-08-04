export const projectUserIdLowerNameIndexName = "project_user_id_lower_name_idx";

export class DuplicateProjectNameError extends Error {
  readonly code = "DUPLICATE_PROJECT_NAME";

  constructor(readonly name: string) {
    super(`A project named "${name}" already exists.`);
  }
}

export class ProjectNotFoundError extends Error {
  readonly code = "PROJECT_NOT_FOUND";

  constructor(projectId: string) {
    super(`Project was not found: ${projectId}`);
    this.name = "ProjectNotFoundError";
  }
}

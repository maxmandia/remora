export const projectUserIdLowerNameIndexName = "project_user_id_lower_name_idx";

export class DuplicateProjectNameError extends Error {
  readonly code = "DUPLICATE_PROJECT_NAME";

  constructor(readonly name: string) {
    super(`A project named "${name}" already exists.`);
  }
}

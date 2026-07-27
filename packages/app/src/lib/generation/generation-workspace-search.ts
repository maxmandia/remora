export type GenerationWorkspaceSearch = {
  projectId?: string;
};

export function parseGenerationWorkspaceSearch(
  search: Record<string, unknown>,
): GenerationWorkspaceSearch {
  return typeof search.projectId === "string" && search.projectId.length > 0
    ? { projectId: search.projectId }
    : {};
}

import type { ProjectSummary } from "@remora/domain/project/dto";
import type { CreateProjectInput } from "@remora/domain/project/validator";

let optimisticProjectSequence = 0;

function createOptimisticProjectId() {
  optimisticProjectSequence += 1;

  return `optimistic-project:${optimisticProjectSequence}`;
}

export function createOptimisticProject(
  input: CreateProjectInput,
  now = new Date(),
): ProjectSummary {
  const timestamp = now.toISOString();

  return {
    id: createOptimisticProjectId(),
    name: input.name,
    threads: [],
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function prependProject(
  projects: readonly ProjectSummary[] | undefined,
  project: ProjectSummary,
): ProjectSummary[] {
  return [project, ...(projects ?? [])];
}

export function replaceOptimisticProject(
  projects: readonly ProjectSummary[] | undefined,
  optimisticProjectId: string | undefined,
  createdProject: ProjectSummary,
): ProjectSummary[] {
  const remainingProjects = (projects ?? []).filter(
    (project) =>
      project.id !== optimisticProjectId && project.id !== createdProject.id,
  );

  return [createdProject, ...remainingProjects];
}

export function removeProjectById(
  projects: readonly ProjectSummary[] | undefined,
  projectId: string,
): ProjectSummary[] {
  return (projects ?? []).filter((project) => project.id !== projectId);
}

export function renameProjectInList(
  projects: readonly ProjectSummary[] | undefined,
  renamedProject: Pick<ProjectSummary, "id" | "name" | "updatedAt">,
): ProjectSummary[] {
  const project = projects?.find(({ id }) => id === renamedProject.id);

  if (!project) {
    return [...(projects ?? [])];
  }

  return [
    { ...project, ...renamedProject },
    ...(projects ?? []).filter(({ id }) => id !== renamedProject.id),
  ];
}

export function restoreProjectInList(
  projects: readonly ProjectSummary[] | undefined,
  project: ProjectSummary,
  index: number,
): ProjectSummary[] {
  const nextProjects = (projects ?? []).filter(({ id }) => id !== project.id);

  nextProjects.splice(Math.min(index, nextProjects.length), 0, project);

  return nextProjects;
}

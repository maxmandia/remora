import { useAuth } from "@remora/app/auth";
import { useTRPC } from "@remora/app/trpc";
import { useQuery } from "@tanstack/react-query";

export function useGenerationProjectSelection({
  requestedProjectId,
  threadId,
}: {
  requestedProjectId: string | null;
  threadId: string | null;
}) {
  const { status } = useAuth();
  const trpc = useTRPC();
  const { data: queriedProjects = [] } = useQuery(
    trpc.project.listProjects.queryOptions(undefined, {
      enabled: status === "signed-in",
    }),
  );
  const projects = status === "signed-in" ? queriedProjects : [];
  const selectedProject = threadId
    ? (projects.find((project) =>
        project.threads.some((thread) => thread.id === threadId),
      ) ?? null)
    : requestedProjectId
      ? (projects.find((project) => project.id === requestedProjectId) ?? null)
      : null;
  const selectedProjectId = threadId
    ? (selectedProject?.id ?? null)
    : requestedProjectId;

  return {
    isSelectedProjectResolved:
      threadId !== null ||
      requestedProjectId === null ||
      selectedProject !== null,
    projects,
    selectedProject,
    selectedProjectId,
  };
}

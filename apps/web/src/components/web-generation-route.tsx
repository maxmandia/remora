import { useParams, useSearch } from "@tanstack/react-router";

import { AppBootstrap } from "./app-bootstrap";

export function WebGenerationRoute() {
  const { threadId } = useParams({ strict: false });
  const { projectId } = useSearch({ from: "/app/_workspace" });

  return (
    <AppBootstrap
      projectId={projectId ?? null}
      threadId={typeof threadId === "string" ? threadId : null}
    />
  );
}

import {
  resolveGenerationWorkspacePreset,
  resolveGenerationWorkspacePrompt,
} from "@remora/app/generation";
import { useParams, useSearch } from "@tanstack/react-router";

import { AppBootstrap } from "./app-bootstrap";

export function WebGenerationRoute() {
  const { threadId } = useParams({ strict: false });
  const search = useSearch({ from: "/app/_workspace" });
  const selectedThreadId = typeof threadId === "string" ? threadId : null;
  const initialGenerationPreset = selectedThreadId
    ? null
    : resolveGenerationWorkspacePreset(search);
  const initialPrompt = selectedThreadId
    ? ""
    : resolveGenerationWorkspacePrompt(search);

  return (
    <AppBootstrap
      initialGenerationPreset={initialGenerationPreset}
      initialPrompt={initialPrompt}
      projectId={search.projectId ?? null}
      threadId={selectedThreadId}
    />
  );
}

import { useAuth } from "@remora/app/auth";
import type { GenerationWorkspacePreset } from "@remora/app/generation";

import {
  FullPageWorkspaceStatus,
  WebGenerationWorkspaceBootstrap,
} from "./web-generation-workspace-bootstrap";

export function AppBootstrap({
  initialGenerationPreset = null,
  initialPrompt = "",
  projectId = null,
  threadId = null,
}: {
  initialGenerationPreset?: GenerationWorkspacePreset | null;
  initialPrompt?: string;
  projectId?: string | null;
  threadId?: string | null;
}) {
  const { requestAuth, status, user } = useAuth();

  // TODO: Add a fullscreen loading page that actually looks presentable
  if (status === "loading") {
    return (
      <FullPageWorkspaceStatus>Resolving session...</FullPageWorkspaceStatus>
    );
  }

  return (
    <WebGenerationWorkspaceBootstrap
      initialGenerationPreset={initialGenerationPreset}
      initialPrompt={initialPrompt}
      isSignedIn={status === "signed-in" && Boolean(user)}
      projectId={projectId}
      requestAuth={requestAuth}
      threadId={threadId}
      userId={user?.id ?? null}
    />
  );
}

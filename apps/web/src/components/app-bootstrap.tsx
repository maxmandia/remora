import { useAuth } from "@remora/app/auth";

import {
  FullPageWorkspaceStatus,
  WebGenerationWorkspaceBootstrap,
} from "./web-generation-workspace-bootstrap";

export function AppBootstrap({
  projectId = null,
  threadId = null,
}: {
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
      isSignedIn={status === "signed-in" && Boolean(user)}
      projectId={projectId}
      requestAuth={requestAuth}
      threadId={threadId}
      userId={user?.id ?? null}
    />
  );
}

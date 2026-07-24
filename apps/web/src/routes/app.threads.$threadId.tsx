import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { AppBootstrap } from "../components/app-bootstrap";

export const Route = createFileRoute("/app/threads/$threadId")({
  component: AppThread,
});

function AppThread() {
  const { threadId } = Route.useParams();

  return (
    <ClientOnly>
      <AppBootstrap threadId={threadId} />
    </ClientOnly>
  );
}

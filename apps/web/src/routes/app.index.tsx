import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { AppBootstrap } from "../components/app-bootstrap";

export const Route = createFileRoute("/app/")({
  component: App,
});

function App() {
  const { projectId } = Route.useSearch();

  return (
    <ClientOnly>
      <AppBootstrap projectId={projectId ?? null} threadId={null} />
    </ClientOnly>
  );
}

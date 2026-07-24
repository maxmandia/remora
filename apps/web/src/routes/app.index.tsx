import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { AppBootstrap } from "../components/app-bootstrap";

export const Route = createFileRoute("/app/")({
  component: App,
});

function App() {
  return (
    <main>
      <ClientOnly>
        <AppBootstrap />
      </ClientOnly>
    </main>
  );
}

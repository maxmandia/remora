import { ClientOnly, createFileRoute } from "@tanstack/react-router";

import { AppBootstrap } from "../components/app-bootstrap";
import { createSeoHead } from "../lib/seo";

export const Route = createFileRoute("/app")({
  component: App,
  head: () =>
    createSeoHead({
      canonicalPath: "/app",
      description: "Use Remora in your browser.",
      index: false,
      title: "Remora",
    }),
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

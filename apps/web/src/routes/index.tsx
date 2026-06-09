import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-6">
      <p>Nothing to see here for now.</p>
    </main>
  );
}

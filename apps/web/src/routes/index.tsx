import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-6 text-foreground">
      <p>Nothing to see here for now.</p>
    </main>
  );
}

import {
  Link,
  createRouter as createTanStackRouter,
} from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFoundPage,
  });

  return router;
}

function NotFoundPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#101111] px-5 py-6 text-center text-[#f7f3eb]">
      <section className="flex max-w-md flex-col items-center gap-4">
        <p className="text-muted-foreground text-sm font-light">
          Page not found
        </p>
        <Link
          to="/"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-[#f7f3eb] px-5 text-sm font-medium text-[#101111] transition-colors hover:bg-[#dfe3ef] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}

import { ClientOnly, useParams, useSearch } from "@tanstack/react-router";

import { AppProviders } from "../providers/app-providers";
import { AppBootstrap } from "./app-bootstrap";

export function WebAppRoute() {
  const { threadId } = useParams({ strict: false });
  const { projectId } = useSearch({ from: "/app" });

  return (
    <AppProviders>
      <ClientOnly>
        <AppBootstrap
          projectId={projectId ?? null}
          threadId={typeof threadId === "string" ? threadId : null}
        />
      </ClientOnly>
    </AppProviders>
  );
}

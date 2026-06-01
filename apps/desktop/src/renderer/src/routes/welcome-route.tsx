import { Button } from "@remora/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAuth } from "../providers/auth-provider.tsx";
import { BlankRouteSurface } from "./blank-route-surface.tsx";

export function WelcomeRoute() {
  const { error, isAuthOpening, requestAuth, status, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === "signed-in") {
      void navigate({ to: "/app", replace: true });
    }
  }, [navigate, status]);

  if (status !== "signed-out") {
    return <BlankRouteSurface status={status} user={user} />;
  }

  return (
    <main
      className="flex h-full min-h-full items-center justify-center bg-background px-6 py-8 text-foreground"
      data-auth-status={status}
      data-user-id={user?.id}
    >
      <section className="flex flex-col items-center text-center">
        <h1 className="text-2xl font-regular">Welcome to Remora</h1>
        <p className="font-light text-muted-foreground w-2/3 mt-1">
          An opinionated tool purpose built for generative media.
        </p>
        <Button
          className="mt-4"
          size="sm"
          disabled={isAuthOpening}
          onClick={() => void requestAuth()}
        >
          Get started
        </Button>
        {error ? (
          <p className="max-w-xs text-xs text-red-200" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}

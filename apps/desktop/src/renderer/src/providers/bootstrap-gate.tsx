import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@remora/ui";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useTRPC } from "../lib/trpc.ts";
import { BlankRouteSurface } from "../routes/blank-route-surface.tsx";
import { useAuth } from "./auth-provider.tsx";

const modelStaleTimeMs = 5 * 60 * 1000;

type BootstrapStatus = "idle" | "loading" | "ready" | "error";

export function BootstrapGate({ children }: { children: ReactNode }) {
  const { signOut, status, user } = useAuth();
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const previousUserIdRef = useRef<string | null>(null);
  const [bootstrapStatus, setBootstrapStatus] =
    useState<BootstrapStatus>("idle");
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    const nextUserId = status === "signed-in" ? (user?.id ?? null) : null;

    if (previousUserIdRef.current !== nextUserId) {
      queryClient.removeQueries(trpc.model.listPublished.queryFilter());
      queryClient.removeQueries(trpc.generation.listThreads.queryFilter());
    }

    previousUserIdRef.current = nextUserId;
  }, [queryClient, status, trpc, user?.id]);

  useEffect(() => {
    if (status !== "signed-in") {
      setBootstrapStatus("idle");
      return;
    }

    let isMounted = true;

    setBootstrapStatus("loading");

    void Promise.all([
      queryClient.ensureQueryData(
        trpc.model.listPublished.queryOptions(undefined, {
          staleTime: modelStaleTimeMs,
        }),
      ),
      queryClient.ensureQueryData(
        trpc.generation.listThreads.queryOptions(),
      ),
    ])
      .then(() => {
        if (isMounted) {
          setBootstrapStatus("ready");
        }
      })
      .catch(() => {
        if (isMounted) {
          setBootstrapStatus("error");
        }
      });

    return () => {
      isMounted = false;
    };
  }, [bootstrapAttempt, queryClient, status, trpc, user?.id]);

  const handleRetry = useCallback(() => {
    setBootstrapAttempt((attempt) => attempt + 1);
  }, []);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  if (status === "loading") {
    return <BlankRouteSurface status={status} user={user} />;
  }

  if (status === "signed-out") {
    return children;
  }

  if (bootstrapStatus === "error") {
    return (
      <StartupErrorSurface onRetry={handleRetry} onSignOut={handleSignOut} />
    );
  }

  if (bootstrapStatus !== "ready") {
    return <BlankRouteSurface status={status} user={user} />;
  }

  return children;
}

function StartupErrorSurface({
  onRetry,
  onSignOut,
}: {
  onRetry: () => void;
  onSignOut: () => void;
}) {
  return (
    <main className="bg-background text-foreground flex h-full min-h-full items-center justify-center px-6 py-8">
      <section className="flex flex-col items-center gap-4 text-center">
        <img
          src="/remora.png"
          alt="Remora Icon"
          draggable={false}
          className="h-12 w-12 select-none"
        />
        <div className="space-y-1">
          <h1 className="text-base font-normal">Unable to prepare Remora.</h1>
          <p className="text-muted-foreground text-sm font-light">
            Check your connection and try again.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onRetry}>Retry</Button>
          <Button variant="ghost" onClick={onSignOut}>
            Sign out
          </Button>
        </div>
      </section>
    </main>
  );
}

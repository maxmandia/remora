import { useAuth } from "@remora/app/auth";
import {
  GenerationModelSelector,
  useGenerationModelSelection,
} from "@remora/app/generation";
import { useEffect, type ReactNode } from "react";

export function AppBootstrap() {
  const { requestAuth, status, user } = useAuth();

  if (status === "loading") {
    return <p>Resolving session...</p>;
  }

  if (status === "signed-out" || !user) {
    return <SignedOutRedirect requestAuth={requestAuth} />;
  }

  return <AuthenticatedWorkspace requestAuth={requestAuth} />;
}

function SignedOutRedirect({
  requestAuth,
}: {
  requestAuth: () => Promise<void>;
}) {
  useEffect(() => {
    void requestAuth();
  }, [requestAuth]);

  return <p>Redirecting to sign in...</p>;
}

function AuthenticatedWorkspace({
  requestAuth,
}: {
  requestAuth: () => Promise<void>;
}) {
  const { error, isPending, models, retry, selectedModel, setSelectedModel } =
    useGenerationModelSelection();
  const isUnauthorized = isUnauthorizedError(error);

  useEffect(() => {
    if (isUnauthorized) {
      void requestAuth();
    }
  }, [isUnauthorized, requestAuth]);

  if (isPending) {
    return <WorkspaceStatus>Preparing workspace...</WorkspaceStatus>;
  }

  if (isUnauthorized) {
    return <WorkspaceStatus>Redirecting to sign in...</WorkspaceStatus>;
  }

  if (error) {
    return (
      <WorkspaceStatus>
        <p>Unable to prepare the workspace.</p>
        <button type="button" onClick={() => void retry()}>
          Retry
        </button>
      </WorkspaceStatus>
    );
  }

  return (
    <main
      aria-label="Generation workspace"
      className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8"
    >
      <section
        className="bg-surface-strong flex w-full max-w-xl flex-col gap-5 rounded-xl px-5 py-6"
        data-surface="strong"
      >
        <div className="space-y-1">
          <h1 className="text-lg font-medium">Create a generation</h1>
          <p className="text-secondary-foreground text-sm font-light">
            Choose a model to get started.
          </p>
        </div>
        <GenerationModelSelector
          models={models}
          selectedModel={selectedModel}
          onSelectedModelChange={setSelectedModel}
        />
      </section>
    </main>
  );
}

function WorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
}

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return false;
  }

  const data = error.data;

  if (!data || typeof data !== "object" || !("code" in data)) {
    return false;
  }

  return data.code === "UNAUTHORIZED";
}

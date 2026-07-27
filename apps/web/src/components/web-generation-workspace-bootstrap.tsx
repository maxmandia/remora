import { useGenerationModelSelection } from "@remora/app/generation";
import { useTRPC } from "@remora/app/trpc";
import { toast } from "@remora/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useCallback, type ReactNode } from "react";

import { useGuestGenerationRestore } from "../hooks/use-guest-generation-restore";
import type { GuestGenerationDraftInput } from "../lib/guest-generation-draft";
import { WebGenerationWorkspace } from "./web-generation-workspace";

export function WebGenerationWorkspaceBootstrap({
  isSignedIn,
  projectId,
  requestAuth,
  threadId,
  userId,
}: {
  isSignedIn: boolean;
  projectId: string | null;
  requestAuth: () => Promise<void>;
  threadId: string | null;
  userId: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const modelSelection = useGenerationModelSelection();
  const {
    error: modelError,
    isPending: areModelsPending,
    models,
    retry: retryModels,
    setSelectedModel,
  } = modelSelection;
  const invalidatePromotionalCredit = useCallback(
    () => queryClient.invalidateQueries(trpc.credits.getBalance.queryFilter()),
    [queryClient, trpc],
  );
  const selectRestoredModel = useCallback(
    (draft: GuestGenerationDraftInput) => {
      setSelectedModel(draft.model);
    },
    [setSelectedModel],
  );
  const notifyDiscardedDraft = useCallback(
    (reason: "expired" | "incompatible" | "malformed") => {
      toast.error(getDiscardedGuestGenerationMessage(reason));
    },
    [],
  );
  const guestGenerationRestore = useGuestGenerationRestore({
    enabled: isSignedIn,
    models,
    modelsReady: !areModelsPending && !modelError,
    onDraftDiscarded: notifyDiscardedDraft,
    onDraftRestored: selectRestoredModel,
    onPromotionalCreditReady: invalidatePromotionalCredit,
    scopeKey: userId,
  });

  if (modelError) {
    return (
      <FullPageWorkspaceStatus>
        <p>Unable to prepare the workspace.</p>
        <button type="button" onClick={() => void retryModels()}>
          Retry
        </button>
      </FullPageWorkspaceStatus>
    );
  }

  if (guestGenerationRestore.phase === "verification-required") {
    return (
      <FullPageWorkspaceStatus>
        Returning to email verification...
        <Navigate replace search={{}} to="/check-email" />
      </FullPageWorkspaceStatus>
    );
  }

  if (areModelsPending || guestGenerationRestore.phase === "loading") {
    return (
      <FullPageWorkspaceStatus>
        {areModelsPending
          ? "Preparing workspace..."
          : "Restoring your generation..."}
      </FullPageWorkspaceStatus>
    );
  }

  if (
    guestGenerationRestore.phase === "error" &&
    guestGenerationRestore.error
  ) {
    return (
      <FullPageWorkspaceStatus>
        <p>{guestGenerationRestore.error.message}</p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void guestGenerationRestore.retry()}
          >
            Retry
          </button>
          {guestGenerationRestore.error.kind === "storage" ? (
            <button
              type="button"
              onClick={() => {
                void guestGenerationRestore.discard().then((discarded) => {
                  if (!discarded) {
                    toast.error(
                      "Unable to discard your saved generation. Try again.",
                    );
                  }
                });
              }}
            >
              Continue without saved generation
            </button>
          ) : null}
        </div>
      </FullPageWorkspaceStatus>
    );
  }

  return (
    <WebGenerationWorkspace
      guestGenerationRestore={{
        complete: guestGenerationRestore.complete,
        discard: guestGenerationRestore.discard,
        draft: guestGenerationRestore.draft,
      }}
      isSignedIn={isSignedIn}
      modelSelection={modelSelection}
      projectId={projectId}
      requestAuth={requestAuth}
      threadId={threadId}
      userId={userId}
    />
  );
}

export function FullPageWorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
}

function getDiscardedGuestGenerationMessage(
  reason: "expired" | "incompatible" | "malformed",
) {
  switch (reason) {
    case "expired":
      return "Your saved generation expired. Start a new one.";
    case "incompatible":
      return "The saved model or settings are no longer available. Start a new generation.";
    case "malformed":
      return "Your saved generation could not be restored and was removed.";
  }
}

import { toast } from "@remora/ui";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  isGuestGenerationDraftInputValid,
  type GuestGenerationDraftInput,
} from "../lib/guest-generation-draft";
import {
  GuestGenerationPreviewError,
  guestGenerationPreviewService,
} from "../lib/guest-generation-preview";

const guestGenerationPreviewDurationMs = 3_000;

type GuestGenerationPreviewState =
  | { phase: "idle" | "preparing" }
  | {
      draft: GuestGenerationDraftInput;
      phase: "auth" | "previewing";
    };

export function useGuestGenerationPreview({
  draft,
  enabled,
  onSubmitted,
}: {
  draft: GuestGenerationDraftInput | null;
  enabled: boolean;
  onSubmitted?: (draft: GuestGenerationDraftInput) => void;
}) {
  const [state, setState] = useState<GuestGenerationPreviewState>({
    phase: "idle",
  });
  const attemptRef = useRef(0);
  const lockedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const cancelPendingAttempt = useCallback(() => {
    attemptRef.current += 1;
    lockedRef.current = false;

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancelPendingAttempt();
    setState({ phase: "idle" });
  }, [cancelPendingAttempt]);

  const submit = useCallback(async () => {
    if (
      !enabled ||
      lockedRef.current ||
      !draft ||
      !isGuestGenerationDraftInputValid(draft)
    ) {
      return;
    }

    lockedRef.current = true;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setState({ phase: "preparing" });

    try {
      await guestGenerationPreviewService.prepare(draft);
    } catch (error) {
      if (attemptRef.current !== attempt) {
        return;
      }

      lockedRef.current = false;
      setState({ phase: "idle" });
      toast.error(
        error instanceof GuestGenerationPreviewError
          ? error.message
          : "Unable to prepare your guest generation. Try again.",
      );
      return;
    }

    if (attemptRef.current !== attempt) {
      return;
    }

    setState({ draft, phase: "previewing" });

    try {
      onSubmitted?.(draft);
    } catch {
      // Observational callbacks must not interrupt the guest preview.
    }

    timeoutRef.current = window.setTimeout(() => {
      if (attemptRef.current !== attempt) {
        return;
      }

      timeoutRef.current = null;
      setState({ draft, phase: "auth" });
    }, guestGenerationPreviewDurationMs);
  }, [draft, enabled, onSubmitted]);

  useEffect(() => {
    if (!enabled && state.phase !== "idle") {
      reset();
    }
  }, [enabled, reset, state.phase]);

  useEffect(
    () => () => {
      cancelPendingAttempt();
    },
    [cancelPendingAttempt],
  );

  const previewDraft =
    state.phase === "previewing" || state.phase === "auth" ? state.draft : null;

  return {
    canSubmit:
      enabled &&
      state.phase === "idle" &&
      Boolean(draft && isGuestGenerationDraftInputValid(draft)),
    isAuthDialogOpen: enabled && state.phase === "auth",
    isInteractionLocked: enabled && state.phase !== "idle",
    previewDraft,
    reset,
    submit,
  };
}

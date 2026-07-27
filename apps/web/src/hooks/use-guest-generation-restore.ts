import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  GuestGenerationRestoreError,
  guestGenerationRestoreService,
  type GuestGenerationRestoreErrorKind,
  type ReadyGuestGenerationPromotionStatus,
} from "../lib/guest-generation-restore";
import type { GuestGenerationDraftInput } from "../lib/guest-generation-draft";

type GuestGenerationRestoreState =
  | {
      phase: "loading";
    }
  | {
      errorKind: GuestGenerationRestoreErrorKind;
      message: string;
      phase: "error";
    }
  | {
      phase: "verification-required";
    }
  | {
      draft: GuestGenerationDraftInput | null;
      phase: "ready";
    };

const emptyRestoreState = {
  draft: null,
  phase: "ready",
} as const;

export function useGuestGenerationRestore({
  enabled,
  models,
  modelsReady,
  onDraftDiscarded,
  onDraftRestored,
  onPromotionalCreditReady,
  scopeKey,
}: {
  enabled: boolean;
  models: PublishedGenerationModelSummary[];
  modelsReady: boolean;
  onDraftDiscarded: (reason: "expired" | "incompatible" | "malformed") => void;
  onDraftRestored: (draft: GuestGenerationDraftInput) => void;
  onPromotionalCreditReady: () => Promise<void>;
  scopeKey: string | null;
}) {
  const [state, setState] = useState<GuestGenerationRestoreState>(() =>
    enabled ? { phase: "loading" } : emptyRestoreState,
  );
  const [promotionStatus, setPromotionStatus] =
    useState<ReadyGuestGenerationPromotionStatus | null>(null);
  const attemptRef = useRef(0);
  const hasStartedRef = useRef(false);
  const promotionInFlightRef = useRef<Promise<void> | null>(null);
  const draftInFlightRef = useRef<Promise<void> | null>(null);
  const clearInFlightRef = useRef<Promise<boolean> | null>(null);
  const scopeKeyRef = useRef(scopeKey);

  const resolvePromotion = useCallback(() => {
    if (!enabled) {
      return Promise.resolve();
    }

    if (promotionInFlightRef.current) {
      return promotionInFlightRef.current;
    }

    if (draftInFlightRef.current) {
      return draftInFlightRef.current;
    }

    hasStartedRef.current = true;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    setPromotionStatus(null);
    setState({ phase: "loading" });

    const operation = guestGenerationRestoreService
      .resolvePromotion()
      .then(async (status) => {
        if (attemptRef.current !== attempt) {
          return;
        }

        if (status === "verification_required") {
          setState({ phase: "verification-required" });
        } else {
          if (status === "redeemed") {
            await onPromotionalCreditReady();
          }

          if (attemptRef.current !== attempt) {
            return;
          }

          setPromotionStatus(status);
        }
      })
      .catch((error: unknown) => {
        if (attemptRef.current !== attempt) {
          return;
        }

        setState({
          errorKind:
            error instanceof GuestGenerationRestoreError
              ? error.kind
              : "promotion",
          message:
            error instanceof GuestGenerationRestoreError
              ? error.message
              : "Unable to restore your saved generation. Try again.",
          phase: "error",
        });
      })
      .finally(() => {
        if (attemptRef.current === attempt) {
          promotionInFlightRef.current = null;
        }
      });

    promotionInFlightRef.current = operation;
    return operation;
  }, [enabled, onPromotionalCreditReady, scopeKey]);

  const restoreDraft = useCallback(() => {
    if (
      !enabled ||
      !modelsReady ||
      !promotionStatus ||
      state.phase !== "loading"
    ) {
      return Promise.resolve();
    }

    if (draftInFlightRef.current) {
      return draftInFlightRef.current;
    }

    const attempt = attemptRef.current;
    const operation = guestGenerationRestoreService
      .restoreDraft(models, promotionStatus)
      .then((result) => {
        if (attemptRef.current !== attempt) {
          return;
        }

        if (result.status === "restored") {
          onDraftRestored(result.draft);
        } else if (result.status === "discarded") {
          onDraftDiscarded(result.reason);
        }

        setState({
          draft: result.status === "restored" ? result.draft : null,
          phase: "ready",
        });
      })
      .catch((error: unknown) => {
        if (attemptRef.current !== attempt) {
          return;
        }

        setState({
          errorKind:
            error instanceof GuestGenerationRestoreError
              ? error.kind
              : "storage",
          message:
            error instanceof GuestGenerationRestoreError
              ? error.message
              : "Unable to restore your saved generation. Try again.",
          phase: "error",
        });
      })
      .finally(() => {
        if (attemptRef.current === attempt) {
          draftInFlightRef.current = null;
        }
      });

    draftInFlightRef.current = operation;
    return operation;
  }, [
    enabled,
    models,
    modelsReady,
    onDraftDiscarded,
    onDraftRestored,
    promotionStatus,
    state.phase,
  ]);

  const retry = useCallback(
    () =>
      promotionInFlightRef.current ??
      draftInFlightRef.current ??
      resolvePromotion(),
    [resolvePromotion],
  );

  const clear = useCallback((deactivateOnFailure: boolean) => {
    if (clearInFlightRef.current) {
      return clearInFlightRef.current;
    }

    const operation = guestGenerationRestoreService
      .clear()
      .then((result) => {
        const cleared = result.status === "cleared";

        if (cleared || deactivateOnFailure) {
          attemptRef.current += 1;
          promotionInFlightRef.current = null;
          draftInFlightRef.current = null;
          setPromotionStatus(null);
          setState(emptyRestoreState);
        }

        return cleared;
      })
      .catch(() => {
        if (deactivateOnFailure) {
          attemptRef.current += 1;
          promotionInFlightRef.current = null;
          draftInFlightRef.current = null;
          setPromotionStatus(null);
          setState(emptyRestoreState);
        }

        return false;
      })
      .finally(() => {
        clearInFlightRef.current = null;
      });

    clearInFlightRef.current = operation;
    return operation;
  }, []);

  const discard = useCallback(() => clear(false), [clear]);
  const complete = useCallback(() => clear(true), [clear]);

  useEffect(() => {
    if (scopeKeyRef.current === scopeKey) {
      return;
    }

    scopeKeyRef.current = scopeKey;
    attemptRef.current += 1;
    hasStartedRef.current = false;
    promotionInFlightRef.current = null;
    draftInFlightRef.current = null;
    clearInFlightRef.current = null;
    setPromotionStatus(null);
    setState(enabled ? { phase: "loading" } : emptyRestoreState);
  }, [enabled, scopeKey]);

  useEffect(() => {
    if (!enabled) {
      attemptRef.current += 1;
      hasStartedRef.current = false;
      promotionInFlightRef.current = null;
      draftInFlightRef.current = null;
      setPromotionStatus(null);
      setState(emptyRestoreState);
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled && !hasStartedRef.current) {
      void resolvePromotion();
    }
  }, [enabled, resolvePromotion]);

  useEffect(() => {
    if (modelsReady && promotionStatus && state.phase === "loading") {
      void restoreDraft();
    }
  }, [modelsReady, promotionStatus, restoreDraft, state.phase]);

  useEffect(
    () => () => {
      attemptRef.current += 1;
      hasStartedRef.current = false;
      promotionInFlightRef.current = null;
      draftInFlightRef.current = null;
      clearInFlightRef.current = null;
    },
    [],
  );

  return {
    complete,
    discard,
    draft: state.phase === "ready" ? state.draft : null,
    error:
      state.phase === "error"
        ? { kind: state.errorKind, message: state.message }
        : null,
    phase: state.phase,
    retry,
  };
}

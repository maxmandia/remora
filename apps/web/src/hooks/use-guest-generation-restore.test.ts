/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clear: vi.fn(),
  onDraftDiscarded: vi.fn(),
  onDraftRestored: vi.fn(),
  onPromotionalCreditReady: vi.fn(),
  resolvePromotion: vi.fn(),
  restoreDraft: vi.fn(),
}));

vi.mock("../lib/guest-generation-restore", () => {
  class GuestGenerationRestoreError extends Error {
    constructor(
      readonly kind: "promotion" | "storage",
      message: string,
    ) {
      super(message);
    }
  }

  return {
    GuestGenerationRestoreError,
    guestGenerationRestoreService: {
      clear: mocks.clear,
      resolvePromotion: mocks.resolvePromotion,
      restoreDraft: mocks.restoreDraft,
    },
  };
});

import { GuestGenerationRestoreError } from "../lib/guest-generation-restore";
import { useGuestGenerationRestore } from "./use-guest-generation-restore";

describe("useGuestGenerationRestore", () => {
  beforeEach(() => {
    mocks.clear.mockReset();
    mocks.clear.mockResolvedValue({ status: "cleared" });
    mocks.onDraftDiscarded.mockReset();
    mocks.onDraftRestored.mockReset();
    mocks.onPromotionalCreditReady.mockReset();
    mocks.onPromotionalCreditReady.mockResolvedValue(undefined);
    mocks.resolvePromotion.mockReset();
    mocks.resolvePromotion.mockResolvedValue("none");
    mocks.restoreDraft.mockReset();
    mocks.restoreDraft.mockResolvedValue({
      promotionStatus: "none",
      status: "empty",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("does not restore while signed out", () => {
    const { result } = renderHook(() =>
      useGuestGenerationRestore({
        enabled: false,
        models: [model],
        modelsReady: true,
        onDraftDiscarded: mocks.onDraftDiscarded,
        onDraftRestored: mocks.onDraftRestored,
        onPromotionalCreditReady: mocks.onPromotionalCreditReady,
        scopeKey: null,
      }),
    );

    expect(result.current).toEqual(
      expect.objectContaining({
        draft: null,
        error: null,
        phase: "ready",
      }),
    );
    expect(mocks.resolvePromotion).not.toHaveBeenCalled();
    expect(mocks.restoreDraft).not.toHaveBeenCalled();
  });

  it("restarts restoration after Strict Mode abandons the first attempt", async () => {
    let resolveAbandonedAttempt:
      | ((status: "verification_required") => void)
      | undefined;
    mocks.resolvePromotion
      .mockImplementationOnce(
        () =>
          new Promise<"verification_required">((resolve) => {
            resolveAbandonedAttempt = resolve;
          }),
      )
      .mockResolvedValueOnce("none");
    const { result } = renderHook(
      () =>
        useGuestGenerationRestore({
          enabled: true,
          models: [model],
          modelsReady: true,
          onDraftDiscarded: mocks.onDraftDiscarded,
          onDraftRestored: mocks.onDraftRestored,
          onPromotionalCreditReady: mocks.onPromotionalCreditReady,
          scopeKey: "user_1",
        }),
      { wrapper: StrictMode },
    );

    await waitFor(() =>
      expect(mocks.resolvePromotion).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(result.current.phase).toBe("ready"));

    expect(mocks.restoreDraft).toHaveBeenCalledOnce();

    await act(async () => {
      resolveAbandonedAttempt?.("verification_required");
      await Promise.resolve();
    });

    expect(result.current.phase).toBe("ready");
    expect(mocks.restoreDraft).toHaveBeenCalledOnce();
  });

  it("waits for models and deduplicates concurrent retries", async () => {
    let resolveRestore:
      | ((value: { promotionStatus: "none"; status: "empty" }) => void)
      | undefined;
    mocks.restoreDraft.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRestore = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      ({ modelsReady }) =>
        useGuestGenerationRestore({
          enabled: true,
          models: [model],
          modelsReady,
          onDraftDiscarded: mocks.onDraftDiscarded,
          onDraftRestored: mocks.onDraftRestored,
          onPromotionalCreditReady: mocks.onPromotionalCreditReady,
          scopeKey: "user_1",
        }),
      { initialProps: { modelsReady: false } },
    );

    await waitFor(() => expect(mocks.resolvePromotion).toHaveBeenCalledOnce());
    expect(mocks.restoreDraft).not.toHaveBeenCalled();

    rerender({ modelsReady: true });

    await waitFor(() => expect(mocks.restoreDraft).toHaveBeenCalledOnce());
    await act(async () => {
      void result.current.retry();
      void result.current.retry();
      resolveRestore?.({ promotionStatus: "none", status: "empty" });
      await Promise.resolve();
    });

    expect(mocks.resolvePromotion).toHaveBeenCalledOnce();
    expect(mocks.restoreDraft).toHaveBeenCalledOnce();
    expect(result.current.phase).toBe("ready");
  });

  it("re-runs the full restoration attempt after an error", async () => {
    mocks.resolvePromotion
      .mockRejectedValueOnce(
        new GuestGenerationRestoreError(
          "promotion",
          "Unable to apply your $5 credit.",
        ),
      )
      .mockResolvedValueOnce("redeemed");
    mocks.restoreDraft.mockResolvedValueOnce({
      promotionStatus: "redeemed",
      status: "empty",
    });
    const { result } = renderHook(() =>
      useGuestGenerationRestore({
        enabled: true,
        models: [model],
        modelsReady: true,
        onDraftDiscarded: mocks.onDraftDiscarded,
        onDraftRestored: mocks.onDraftRestored,
        onPromotionalCreditReady: mocks.onPromotionalCreditReady,
        scopeKey: "user_1",
      }),
    );

    await waitFor(() =>
      expect(result.current).toEqual(
        expect.objectContaining({
          error: {
            kind: "promotion",
            message: "Unable to apply your $5 credit.",
          },
          phase: "error",
        }),
      ),
    );

    await act(async () => {
      await result.current.retry();
    });

    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(mocks.resolvePromotion).toHaveBeenCalledTimes(2);
    expect(mocks.restoreDraft).toHaveBeenCalledOnce();
    expect(mocks.onPromotionalCreditReady).toHaveBeenCalledOnce();
    expect(result.current).toEqual(
      expect.objectContaining({
        draft: null,
        error: null,
        phase: "ready",
      }),
    );
  });

  it("restarts restoration when the authenticated user changes", async () => {
    const { result, rerender } = renderHook(
      ({ scopeKey }) =>
        useGuestGenerationRestore({
          enabled: true,
          models: [model],
          modelsReady: true,
          onDraftDiscarded: mocks.onDraftDiscarded,
          onDraftRestored: mocks.onDraftRestored,
          onPromotionalCreditReady: mocks.onPromotionalCreditReady,
          scopeKey,
        }),
      { initialProps: { scopeKey: "user_1" } },
    );

    await waitFor(() => expect(result.current.phase).toBe("ready"));

    rerender({ scopeKey: "user_2" });

    await waitFor(() =>
      expect(mocks.resolvePromotion).toHaveBeenCalledTimes(2),
    );
    await waitFor(() => expect(mocks.restoreDraft).toHaveBeenCalledTimes(2));
  });

  it("keeps state intact when explicit discard fails", async () => {
    mocks.restoreDraft.mockResolvedValue({
      draft: createDraft(),
      promotionStatus: "none",
      status: "restored",
    });
    mocks.clear.mockResolvedValue({
      reason: "storage-error",
      status: "failed",
    });
    const { result } = renderHook(() =>
      useGuestGenerationRestore({
        enabled: true,
        models: [model],
        modelsReady: true,
        onDraftDiscarded: mocks.onDraftDiscarded,
        onDraftRestored: mocks.onDraftRestored,
        onPromotionalCreditReady: mocks.onPromotionalCreditReady,
        scopeKey: "user_1",
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("ready"));
    expect(mocks.onDraftRestored).toHaveBeenCalledWith(createDraft());

    await expect(act(async () => result.current.discard())).resolves.toBe(
      false,
    );
    expect(result.current.phase).toBe("ready");
    expect(result.current.draft).toEqual(createDraft());
  });

  it("deactivates restoration after submission even if clearing fails", async () => {
    mocks.restoreDraft.mockResolvedValue({
      draft: createDraft(),
      promotionStatus: "none",
      status: "restored",
    });
    mocks.clear.mockResolvedValue({
      reason: "storage-error",
      status: "failed",
    });
    const { result } = renderHook(() =>
      useGuestGenerationRestore({
        enabled: true,
        models: [model],
        modelsReady: true,
        onDraftDiscarded: mocks.onDraftDiscarded,
        onDraftRestored: mocks.onDraftRestored,
        onPromotionalCreditReady: mocks.onPromotionalCreditReady,
        scopeKey: "user_1",
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("ready"));

    await expect(act(async () => result.current.complete())).resolves.toBe(
      false,
    );
    expect(result.current).toEqual(
      expect.objectContaining({
        draft: null,
        error: null,
        phase: "ready",
      }),
    );
  });

  it("emits a discarded-draft event before publishing the ready state", async () => {
    mocks.restoreDraft.mockResolvedValue({
      promotionStatus: "none",
      reason: "expired",
      status: "discarded",
    });
    const { result } = renderHook(() =>
      useGuestGenerationRestore({
        enabled: true,
        models: [model],
        modelsReady: true,
        onDraftDiscarded: mocks.onDraftDiscarded,
        onDraftRestored: mocks.onDraftRestored,
        onPromotionalCreditReady: mocks.onPromotionalCreditReady,
        scopeKey: "user_1",
      }),
    );

    await waitFor(() => expect(result.current.phase).toBe("ready"));

    expect(mocks.onDraftDiscarded).toHaveBeenCalledOnce();
    expect(mocks.onDraftDiscarded).toHaveBeenCalledWith("expired");
    expect(result.current.draft).toBeNull();
  });
});

const model = {
  id: "image-model",
  displayName: "Image Model",
  latestSpecId: "image-model-spec",
  type: "image",
} as unknown as PublishedGenerationModelSummary;

function createDraft() {
  return {
    attachmentMedia: {
      audios: [],
      images: [],
      videos: [],
    },
    model,
    prompt: "A glass studio above the ocean",
    settings: {
      aspectRatio: "1:1",
      modelType: "image" as const,
      requestedGenerations: 1,
      resolution: "1024p",
    },
  };
}

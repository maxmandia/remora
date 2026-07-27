/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestGenerationDraftInput } from "../lib/guest-generation-draft";

const mocks = vi.hoisted(() => ({
  isDraftValid: vi.fn(),
  prepare: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@remora/ui", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("../lib/guest-generation-draft", () => ({
  isGuestGenerationDraftInputValid: mocks.isDraftValid,
}));

vi.mock("../lib/guest-generation-preview", () => {
  class GuestGenerationPreviewError extends Error {}

  return {
    GuestGenerationPreviewError,
    guestGenerationPreviewService: {
      prepare: mocks.prepare,
    },
  };
});

import { GuestGenerationPreviewError } from "../lib/guest-generation-preview";
import { useGuestGenerationPreview } from "./use-guest-generation-preview";

describe("useGuestGenerationPreview", () => {
  beforeEach(() => {
    mocks.isDraftValid.mockReset();
    mocks.isDraftValid.mockReturnValue(true);
    mocks.prepare.mockReset();
    mocks.prepare.mockResolvedValue({ promotionTicket: "promotion-ticket" });
    mocks.toastError.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("exposes guest submission only for an enabled valid idle draft", () => {
    const draft = createDraft();
    const { result, rerender } = renderHook(
      ({ enabled }) => useGuestGenerationPreview({ draft, enabled }),
      { initialProps: { enabled: true } },
    );

    expect(result.current.canSubmit).toBe(true);

    rerender({ enabled: false });
    expect(result.current.canSubmit).toBe(false);

    mocks.isDraftValid.mockReturnValue(false);
    rerender({ enabled: true });
    expect(result.current.canSubmit).toBe(false);
  });

  it("locks duplicate submissions and opens auth after three seconds", async () => {
    vi.useFakeTimers();
    const draft = createDraft();
    const onSubmitted = vi.fn();
    const { result } = renderHook(() =>
      useGuestGenerationPreview({ draft, enabled: true, onSubmitted }),
    );

    await act(async () => {
      void result.current.submit();
      void result.current.submit();
      await Promise.resolve();
    });

    expect(mocks.prepare).toHaveBeenCalledOnce();
    expect(onSubmitted).toHaveBeenCalledOnce();
    expect(onSubmitted).toHaveBeenCalledWith(draft);
    expect(result.current.isInteractionLocked).toBe(true);
    expect(result.current.previewDraft).toBe(draft);
    expect(result.current.isAuthDialogOpen).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_999);
    });
    expect(result.current.isAuthDialogOpen).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.isAuthDialogOpen).toBe(true);

    act(() => result.current.reset());
    expect(result.current.isAuthDialogOpen).toBe(false);
    expect(result.current.isInteractionLocked).toBe(false);
    expect(result.current.previewDraft).toBeNull();
  });

  it("reports preparation failures and returns to an editable idle state", async () => {
    const error = new GuestGenerationPreviewError(
      "Unable to save your generation in this browser. Try again.",
    );
    mocks.prepare.mockRejectedValueOnce(error);
    const onSubmitted = vi.fn();
    const { result } = renderHook(() =>
      useGuestGenerationPreview({
        draft: createDraft(),
        enabled: true,
        onSubmitted,
      }),
    );

    await act(async () => {
      await result.current.submit();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(error.message);
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(result.current.canSubmit).toBe(true);
    expect(result.current.isInteractionLocked).toBe(false);
    expect(result.current.previewDraft).toBeNull();
  });

  it("cancels a pending auth transition when unmounted", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() =>
      useGuestGenerationPreview({ draft: createDraft(), enabled: true }),
    );

    await act(async () => {
      await result.current.submit();
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(vi.getTimerCount()).toBe(0);
  });
});

function createDraft(): GuestGenerationDraftInput {
  return {
    attachmentMedia: {
      audios: [],
      images: [],
      videos: [],
    },
    model: {
      displayName: "Seedance",
      id: "seedance",
      type: "video",
    } as unknown as PublishedGenerationModelSummary,
    prompt: "A moonlit glass studio",
    settings: {
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      modelType: "video",
      requestedGenerations: 1,
      resolution: "720p",
    },
  };
}

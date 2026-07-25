/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { HotkeysProvider } from "../providers/hotkeys-provider.tsx";
import { useGenerationResultsPanelController } from "./use-generation-results-panel-controller.ts";

describe("useGenerationResultsPanelController", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggles one active panel at a time and closes it with Escape", () => {
    const { result } = renderHook(
      () => useGenerationResultsPanelController({ scopeKey: "thread_1" }),
      { wrapper: HotkeysWrapper },
    );

    act(() => {
      result.current.togglePanel({
        kind: "attachmentMedia",
        submissionId: "submission_1",
      });
    });
    expect(result.current.activePanel).toEqual({
      kind: "attachmentMedia",
      submissionId: "submission_1",
    });

    act(() => {
      result.current.togglePanel({
        kind: "generationOutput",
        submissionId: "submission_1",
      });
    });
    expect(result.current.activePanel).toEqual({
      kind: "generationOutput",
      submissionId: "submission_1",
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(result.current.activePanel).toBeNull();
  });

  it("closes the same panel when toggled and resets when scope changes", () => {
    const { rerender, result } = renderHook(
      ({ scopeKey }: { scopeKey: string | null }) =>
        useGenerationResultsPanelController({ scopeKey }),
      {
        initialProps: { scopeKey: "thread_1" },
        wrapper: HotkeysWrapper,
      },
    );
    const attachmentPanel = {
      kind: "attachmentMedia",
      submissionId: "submission_1",
    } as const;

    act(() => {
      result.current.togglePanel(attachmentPanel);
    });
    act(() => {
      result.current.togglePanel(attachmentPanel);
    });
    expect(result.current.activePanel).toBeNull();

    act(() => {
      result.current.togglePanel(attachmentPanel);
    });
    rerender({ scopeKey: "thread_2" });
    expect(result.current.activePanel).toBeNull();
  });
});

function HotkeysWrapper({ children }: { children: ReactNode }) {
  return <HotkeysProvider>{children}</HotkeysProvider>;
}

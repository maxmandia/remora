/** @vitest-environment jsdom */

import { HotkeysProvider } from "@remora/app/hotkeys";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NavigationHistoryButtons } from "./navigation-history-buttons.tsx";
import { useNavigationHistoryHotkeys } from "../../hooks/use-navigation-history-hotkeys.ts";

describe("navigation history controls", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders accessible buttons and invokes available actions", () => {
    const onBack = vi.fn();
    const onForward = vi.fn();

    render(
      <NavigationHistoryButtons
        canNavigateBack={true}
        canNavigateForward={false}
        onBack={onBack}
        onForward={onForward}
      />,
    );

    const backButton = screen.getByRole("button", { name: "Back" });
    const forwardButton = screen.getByRole("button", { name: "Forward" });

    expect(backButton.getAttribute("aria-keyshortcuts")).toBe("Meta+ArrowLeft");
    expect(forwardButton.getAttribute("aria-keyshortcuts")).toBe(
      "Meta+ArrowRight",
    );
    expect(backButton.getAttribute("aria-disabled")).toBe("false");
    expect(forwardButton.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(backButton);
    fireEvent.click(forwardButton);

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onForward).not.toHaveBeenCalled();
  });

  it("registers history hotkeys while preserving editable-field behavior", () => {
    const onBack = vi.fn();
    const onForward = vi.fn();

    render(
      <HotkeysProvider>
        <HistoryHotkeysProbe
          enabled={true}
          onBack={onBack}
          onForward={onForward}
        />
        <textarea aria-label="Prompt" />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "ArrowLeft", metaKey: true });
    fireEvent.keyDown(document, { key: "ArrowRight", metaKey: true });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Prompt" }), {
      key: "ArrowLeft",
      metaKey: true,
    });

    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onForward).toHaveBeenCalledTimes(1);
  });

  it("does not invoke disabled history hotkeys", () => {
    const onBack = vi.fn();

    render(
      <HotkeysProvider>
        <HistoryHotkeysProbe
          enabled={false}
          onBack={onBack}
          onForward={() => undefined}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "ArrowLeft", metaKey: true });

    expect(onBack).not.toHaveBeenCalled();
  });
});

function HistoryHotkeysProbe({
  enabled,
  onBack,
  onForward,
}: {
  enabled: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  useNavigationHistoryHotkeys({
    enabled,
    onBack,
    onForward,
  });

  return null;
}

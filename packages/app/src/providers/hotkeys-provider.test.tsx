/** @vitest-environment jsdom */

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HotkeyCommandId } from "../lib/hotkey-registry.ts";
import { HotkeysProvider, useHotkey } from "./hotkeys-provider.tsx";

describe("HotkeysProvider", () => {
  afterEach(() => {
    cleanup();
  });

  it("lets the most recently mounted enabled shared combo handle first", () => {
    const closeStackPanel = vi.fn();
    const closeMediaViewer = vi.fn();

    render(
      <HotkeysProvider>
        <HotkeyProbe
          commandId="generation.closeStackPanel"
          onKeyDown={closeStackPanel}
        />
        <HotkeyProbe
          commandId="generation.closeMediaViewer"
          onKeyDown={closeMediaViewer}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closeMediaViewer).toHaveBeenCalledTimes(1);
    expect(closeStackPanel).not.toHaveBeenCalled();
  });

  it("falls back to the earlier shared combo registration when the later one is unavailable", () => {
    const closeStackPanel = vi.fn();
    const closeMediaViewer = vi.fn();
    const { rerender } = render(
      <HotkeysProvider>
        <HotkeyProbe
          commandId="generation.closeStackPanel"
          onKeyDown={closeStackPanel}
        />
        <HotkeyProbe
          commandId="generation.closeMediaViewer"
          enabled={false}
          onKeyDown={closeMediaViewer}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closeStackPanel).toHaveBeenCalledTimes(1);
    expect(closeMediaViewer).not.toHaveBeenCalled();

    rerender(
      <HotkeysProvider>
        <HotkeyProbe
          commandId="generation.closeStackPanel"
          onKeyDown={closeStackPanel}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closeStackPanel).toHaveBeenCalledTimes(2);
    expect(closeMediaViewer).not.toHaveBeenCalled();
  });

  it("handles browser-safe workspace shortcuts outside editable fields", () => {
    const newGeneration = vi.fn();
    const createProject = vi.fn();
    const toggleSidebar = vi.fn();

    render(
      <HotkeysProvider>
        <HotkeyProbe commandId="app.newGeneration" onKeyDown={newGeneration} />
        <HotkeyProbe commandId="app.createProject" onKeyDown={createProject} />
        <HotkeyProbe commandId="app.toggleSidebar" onKeyDown={toggleSidebar} />
      </HotkeysProvider>,
    );

    const newGenerationEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "n",
    });
    document.dispatchEvent(newGenerationEvent);
    fireEvent.keyDown(document, { key: "P", shiftKey: true });
    fireEvent.keyDown(document, { key: "B", shiftKey: true });

    expect(newGeneration).toHaveBeenCalledTimes(1);
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(toggleSidebar).toHaveBeenCalledTimes(1);
    expect(newGenerationEvent.defaultPrevented).toBe(true);
  });

  it("ignores workspace shortcuts in editable fields", () => {
    const newGeneration = vi.fn();
    const createProject = vi.fn();
    const toggleSidebar = vi.fn();
    render(
      <HotkeysProvider>
        <HotkeyProbe commandId="app.newGeneration" onKeyDown={newGeneration} />
        <HotkeyProbe commandId="app.createProject" onKeyDown={createProject} />
        <HotkeyProbe commandId="app.toggleSidebar" onKeyDown={toggleSidebar} />
      </HotkeysProvider>,
    );
    const prompt = document.createElement("textarea");
    document.body.append(prompt);

    const newGenerationEvent = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      key: "n",
    });
    prompt.dispatchEvent(newGenerationEvent);
    fireEvent.keyDown(prompt, { key: "P", shiftKey: true });
    fireEvent.keyDown(prompt, { key: "B", shiftKey: true });

    expect(newGeneration).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(toggleSidebar).not.toHaveBeenCalled();
    expect(newGenerationEvent.defaultPrevented).toBe(false);
    prompt.remove();
  });

  it("requires exact modifiers for workspace shortcuts", () => {
    const newGeneration = vi.fn();
    const createProject = vi.fn();
    const toggleSidebar = vi.fn();
    render(
      <HotkeysProvider>
        <HotkeyProbe commandId="app.newGeneration" onKeyDown={newGeneration} />
        <HotkeyProbe commandId="app.createProject" onKeyDown={createProject} />
        <HotkeyProbe commandId="app.toggleSidebar" onKeyDown={toggleSidebar} />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "n", metaKey: true });
    fireEvent.keyDown(document, { key: "p" });
    fireEvent.keyDown(document, { key: "b" });

    expect(newGeneration).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
    expect(toggleSidebar).not.toHaveBeenCalled();
  });
});

function HotkeyProbe({
  allowInEditable,
  commandId,
  enabled = true,
  onKeyDown,
}: {
  allowInEditable?: boolean;
  commandId: HotkeyCommandId;
  enabled?: boolean;
  onKeyDown: () => void;
}) {
  useHotkey(commandId, {
    allowInEditable,
    enabled,
    onKeyDown,
  });

  return null;
}

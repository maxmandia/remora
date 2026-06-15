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
    const closeVideoPlayback = vi.fn();

    render(
      <HotkeysProvider>
        <HotkeyProbe
          commandId="generation.closeStackPanel"
          onKeyDown={closeStackPanel}
        />
        <HotkeyProbe
          commandId="generation.closeVideoPlayback"
          onKeyDown={closeVideoPlayback}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closeVideoPlayback).toHaveBeenCalledTimes(1);
    expect(closeStackPanel).not.toHaveBeenCalled();
  });

  it("falls back to the earlier shared combo registration when the later one is unavailable", () => {
    const closeStackPanel = vi.fn();
    const closeVideoPlayback = vi.fn();
    const { rerender } = render(
      <HotkeysProvider>
        <HotkeyProbe
          commandId="generation.closeStackPanel"
          onKeyDown={closeStackPanel}
        />
        <HotkeyProbe
          commandId="generation.closeVideoPlayback"
          enabled={false}
          onKeyDown={closeVideoPlayback}
        />
      </HotkeysProvider>,
    );

    fireEvent.keyDown(document, { key: "Escape" });

    expect(closeStackPanel).toHaveBeenCalledTimes(1);
    expect(closeVideoPlayback).not.toHaveBeenCalled();

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
    expect(closeVideoPlayback).not.toHaveBeenCalled();
  });
});

function HotkeyProbe({
  commandId,
  enabled = true,
  onKeyDown,
}: {
  commandId: HotkeyCommandId;
  enabled?: boolean;
  onKeyDown: () => void;
}) {
  useHotkey(commandId, {
    allowInEditable: true,
    enabled,
    onKeyDown,
  });

  return null;
}

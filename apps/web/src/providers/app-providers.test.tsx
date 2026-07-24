/** @vitest-environment jsdom */

import { useHotkey } from "@remora/app/hotkeys";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "./app-providers";

describe("AppProviders", () => {
  afterEach(() => {
    cleanup();
  });

  it("provides product hotkeys to app route descendants", () => {
    const onKeyDown = vi.fn();

    render(
      <AppProviders>
        <HotkeyProbe onKeyDown={onKeyDown} />
      </AppProviders>,
    );

    fireEvent.keyDown(document, {
      key: "b",
      metaKey: true,
    });

    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });
});

function HotkeyProbe({ onKeyDown }: { onKeyDown: () => void }) {
  useHotkey("app.toggleSidebar", {
    onKeyDown,
  });

  return null;
}

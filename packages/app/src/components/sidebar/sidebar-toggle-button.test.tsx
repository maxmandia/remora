/** @vitest-environment jsdom */

import { HotkeysProvider } from "@remora/app/hotkeys";
import { SidebarProvider } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarToggleButton } from "./sidebar-toggle-button.tsx";

describe("SidebarToggleButton", () => {
  afterEach(() => {
    cleanup();
  });

  it("toggles the sidebar with the button and registered shortcut", () => {
    const onOpenChange = vi.fn();
    const rendered = renderToggle({ onOpenChange, open: true });
    const hideButton = screen.getByRole("button", { name: "Hide sidebar" });

    expect(hideButton.getAttribute("aria-keyshortcuts")).toBe("Shift+B");

    fireEvent.click(hideButton);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    rendered.rerender(createToggle({ onOpenChange, open: false }));

    fireEvent.keyDown(document, { key: "B", shiftKey: true });

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });

  it("does not toggle the sidebar while typing", () => {
    const onOpenChange = vi.fn();
    renderToggle({ onOpenChange, open: true });
    const prompt = document.createElement("textarea");
    document.body.append(prompt);

    fireEvent.keyDown(prompt, { key: "B", shiftKey: true });

    expect(onOpenChange).not.toHaveBeenCalled();
    prompt.remove();
  });

  it("forwards host styling and tooltip placement inputs", () => {
    renderToggle({
      buttonClassName: "host-control",
      open: true,
      style: { color: "rgb(1, 2, 3)" },
      tooltipSide: "bottom",
    });

    const button = screen.getByRole("button", { name: "Hide sidebar" });

    expect(button.className).toContain("host-control");
    expect(button.style.color).toBe("rgb(1, 2, 3)");
  });
});

function renderToggle({
  buttonClassName,
  onOpenChange = () => undefined,
  open,
  style,
  tooltipSide,
}: {
  buttonClassName?: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  style?: React.CSSProperties;
  tooltipSide?: "bottom";
}) {
  return render(
    createToggle({
      buttonClassName,
      onOpenChange,
      open,
      style,
      tooltipSide,
    }),
  );
}

function createToggle({
  buttonClassName,
  onOpenChange,
  open,
  style,
  tooltipSide,
}: {
  buttonClassName?: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  style?: React.CSSProperties;
  tooltipSide?: "bottom";
}) {
  return (
    <HotkeysProvider>
      <SidebarProvider open={open} onOpenChange={onOpenChange}>
        <SidebarToggleButton
          className={buttonClassName}
          style={style}
          tooltipSide={tooltipSide}
        />
      </SidebarProvider>
    </HotkeysProvider>
  );
}

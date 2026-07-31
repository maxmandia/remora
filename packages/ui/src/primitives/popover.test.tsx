/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { Popover, PopoverContent } from "./popover.tsx";

describe("Popover", () => {
  afterEach(() => {
    cleanup();
  });

  it("portals content positioned against an external anchor", async () => {
    const { container } = render(<ExternallyAnchoredPopover />);
    const content = await screen.findByText("Attachment references");

    expect(container.contains(content)).toBe(false);
    expect(content.dataset.slot).toBe("popover-content");
    expect(content.dataset.surface).toBe("popup");
    expect(content.parentElement?.dataset.align).toBe("start");
  });
});

function ExternallyAnchoredPopover() {
  const anchorRef = useRef<HTMLButtonElement | null>(null);

  return (
    <>
      <button ref={anchorRef} type="button">
        Anchor
      </button>
      <Popover open>
        <PopoverContent
          align="start"
          anchor={anchorRef}
          collisionAvoidance={{ align: "shift", side: "flip" }}
          collisionPadding={8}
          initialFocus={false}
          role="presentation"
        >
          Attachment references
        </PopoverContent>
      </Popover>
    </>
  );
}

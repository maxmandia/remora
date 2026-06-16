/** @vitest-environment jsdom */

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
} from "@remora/ui";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

describe("Dialog surface styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults portaled content to the popup surface with ghost actions", async () => {
    render(<TestDialog />);

    const content = await findDialogContent();
    const closeButton = screen.getByRole("button", { name: "Close" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    expect(content.dataset.surface).toBe("popup");
    expect(content.className).toContain("data-[surface=popup]:bg-popover");
    expect(closeButton.className).toContain(
      "hover:bg-[var(--surface-interactive-hover)]",
    );
    expect(cancelButton.className).toContain(
      "hover:bg-[var(--surface-interactive-hover)]",
    );
  });

  it("applies the card surface to portaled content", async () => {
    render(<TestDialog surface="card" />);

    const content = await findDialogContent();

    expect(content.dataset.surface).toBe("card");
    expect(content.className).toContain("data-[surface=card]:bg-card");
  });

  it("applies the strong surface to portaled content", async () => {
    render(<TestDialog surface="strong" />);

    const content = await findDialogContent();

    expect(content.dataset.surface).toBe("strong");
    expect(content.className).toContain("data-[surface=strong]:bg-popover");
  });
});

function TestDialog({ surface }: { surface?: "popup" | "strong" | "card" }) {
  return (
    <Dialog {...(surface ? { "data-surface": surface } : {})} open>
      <DialogContent aria-label="Test dialog">
        <DialogTitle>Test dialog</DialogTitle>
        <DialogFooter>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
          <Button type="button">Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function findDialogContent() {
  await waitFor(() => {
    expect(document.querySelector('[data-slot="dialog-content"]')).not.toBe(
      null,
    );
  });

  const content = document.querySelector<HTMLElement>(
    '[data-slot="dialog-content"]',
  );

  if (!content) {
    throw new Error("Dialog content was not rendered.");
  }

  return content;
}

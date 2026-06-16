/** @vitest-environment jsdom */

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@remora/ui";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

type TestComboboxItem = {
  id: string;
  label: string;
};

const items: TestComboboxItem[] = [{ id: "alpha", label: "Alpha" }];

describe("Combobox surface styling", () => {
  afterEach(() => {
    cleanup();
  });

  it("defaults portaled content to the primary surface", async () => {
    render(<TestCombobox />);

    const content = await findComboboxContent();
    const option = screen.getByRole("option", { name: "Alpha" });

    expect(content.dataset.surface).toBe("primary");
    expect(content.className).toContain("data-[surface=primary]:bg-popover");
    expect(option.className).toContain(
      "data-highlighted:bg-[var(--surface-interactive-hover)]",
    );
  });

  it("mirrors the nearest card surface onto portaled content", async () => {
    render(
      <div data-surface="card">
        <TestCombobox />
      </div>,
    );

    const content = await findComboboxContent();

    await waitFor(() => {
      expect(content.dataset.surface).toBe("card");
    });

    expect(content.className).toContain("data-[surface=card]:bg-card");
  });
});

function TestCombobox() {
  return (
    <Combobox<TestComboboxItem>
      open
      items={items}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.id}
    >
      <ComboboxInput placeholder="Select an item" />
      <ComboboxContent>
        <ComboboxList>
          {(item: TestComboboxItem) => (
            <ComboboxItem key={item.id} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

async function findComboboxContent() {
  await waitFor(() => {
    expect(document.querySelector('[data-slot="combobox-content"]')).not.toBe(
      null,
    );
  });

  const content = document.querySelector<HTMLElement>(
    '[data-slot="combobox-content"]',
  );

  if (!content) {
    throw new Error("Combobox content was not rendered.");
  }

  return content;
}

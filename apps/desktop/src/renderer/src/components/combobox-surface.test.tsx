/** @vitest-environment jsdom */

import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@remora/ui";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
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

  it("defaults portaled content to the popup surface", async () => {
    render(<TestCombobox />);

    const content = await findComboboxContent();
    const option = screen.getByRole("option", { name: "Alpha" });

    expect(content.dataset.surface).toBe("popup");
    expect(content.className).toContain("data-[surface=popup]:bg-popover");
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

  it("mirrors the nearest strong surface onto portaled content", async () => {
    render(
      <div data-surface="strong">
        <TestCombobox />
      </div>,
    );

    const content = await findComboboxContent();

    await waitFor(() => {
      expect(content.dataset.surface).toBe("strong");
    });

    expect(content.className).toContain("data-[surface=strong]:bg-popover");
  });

  it("opens the popup from the leading icon trigger", async () => {
    render(
      <TestCombobox forceOpen={false} icon={<span aria-hidden="true" />} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open item selector" }));

    await findComboboxContent();

    expect(screen.getByRole("option", { name: "Alpha" })).not.toBe(null);
  });

  it("renders decorative item icons without changing the item label", async () => {
    render(<TestCombobox itemIcon={<span data-testid="item-icon" />} />);

    await findComboboxContent();

    const option = screen.getByRole("option", { name: "Alpha" });

    expect(option.querySelector('[data-slot="combobox-item-icon"]')).not.toBe(
      null,
    );
    expect(screen.getByTestId("item-icon")).not.toBe(null);
  });
});

function TestCombobox({
  forceOpen = true,
  icon,
  itemIcon,
}: {
  forceOpen?: boolean;
  icon?: ReactNode;
  itemIcon?: ReactNode;
}) {
  return (
    <Combobox<TestComboboxItem>
      {...(forceOpen ? { open: true } : {})}
      items={items}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.id}
    >
      <ComboboxInput
        icon={icon}
        iconAriaLabel="Open item selector"
        placeholder="Select an item"
      />
      <ComboboxContent>
        <ComboboxList>
          {(item: TestComboboxItem) => (
            <ComboboxItem key={item.id} icon={itemIcon} value={item}>
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

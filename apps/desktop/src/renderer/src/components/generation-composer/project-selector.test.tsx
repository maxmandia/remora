/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectSelector } from "./project-selector.tsx";

import type { ProjectSummary } from "@remora/domain/project/dto";

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  type MockComboboxItem = { id: string };
  type MockComboboxContextValue = {
    items: MockComboboxItem[];
    value: MockComboboxItem | null;
    itemToStringLabel: (item: MockComboboxItem) => string;
  };

  const ComboboxContext = React.createContext<MockComboboxContextValue>({
    items: [],
    value: null,
    itemToStringLabel: () => "",
  });

  return {
    Combobox: ({
      children,
      items,
      itemToStringLabel,
      value,
    }: {
      children: React.ReactNode;
      items: MockComboboxItem[];
      itemToStringLabel: (item: MockComboboxItem) => string;
      value: MockComboboxItem | null;
    }) =>
      React.createElement(
        ComboboxContext.Provider,
        { value: { items, value, itemToStringLabel } },
        children,
      ),
    ComboboxInput: ({ placeholder }: { placeholder?: string }) => {
      const { itemToStringLabel, value } = React.useContext(ComboboxContext);

      return React.createElement("input", {
        placeholder,
        readOnly: true,
        value: value ? itemToStringLabel(value) : "",
      });
    },
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: ({
      children,
    }: {
      children: (item: MockComboboxItem) => React.ReactNode;
    }) => {
      const { items } = React.useContext(ComboboxContext);

      return React.createElement(
        "div",
        { role: "listbox" },
        items.map((item) => children(item)),
      );
    },
    ComboboxItem: ({
      children,
      icon,
    }: {
      children: React.ReactNode;
      icon?: React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { role: "option" },
        icon
          ? React.createElement(
              "span",
              { "data-slot": "combobox-item-icon" },
              icon,
            )
          : null,
        children,
      ),
    ComboboxSeparator: () =>
      React.createElement("hr", { "data-slot": "combobox-separator" }),
  };
});

describe("ProjectSelector", () => {
  afterEach(() => {
    cleanup();
  });

  it("separates the no-project option from project options", () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });
    const { container } = render(
      <ProjectSelector
        projects={[project]}
        selectedProject={project}
        selectedProjectId={project.id}
        onClearProject={vi.fn()}
        onSelectProject={vi.fn()}
      />,
    );

    const listbox = screen.getByRole("listbox");
    const options = within(listbox).getAllByRole("option");
    const separator = container.querySelector<HTMLElement>(
      '[data-slot="combobox-separator"]',
    );

    expect(options.map((option) => option.textContent)).toEqual([
      "Launch concepts",
      "Don't work in a project",
    ]);
    expect(options[0]?.querySelector('[data-slot="combobox-item-icon"]')).toBe(
      null,
    );
    expect(
      options[1]?.querySelector('[data-slot="combobox-item-icon"]'),
    ).not.toBe(null);
    expect(separator?.previousElementSibling?.textContent).toBe(
      "Launch concepts",
    );
    expect(separator?.nextElementSibling?.textContent).toBe(
      "Don't work in a project",
    );
  });

  it("does not render a leading separator without project options", () => {
    const { container } = render(
      <ProjectSelector
        projects={[]}
        selectedProject={null}
        selectedProjectId={null}
        onClearProject={vi.fn()}
        onSelectProject={vi.fn()}
      />,
    );

    expect(
      container.querySelector('[data-slot="combobox-separator"]'),
    ).toBeNull();
    expect(screen.getByRole("option").textContent).toBe(
      "Don't work in a project",
    );
  });

  it("shows the project prompt as the trigger value for the no-project option", () => {
    render(
      <ProjectSelector
        projects={[]}
        selectedProject={null}
        selectedProjectId={null}
        onClearProject={vi.fn()}
        onSelectProject={vi.fn()}
      />,
    );

    const input = screen.getByRole("textbox") as HTMLInputElement;

    expect(input.value).toBe("Select a project to work in");
    expect(screen.getByRole("option").textContent).toBe(
      "Don't work in a project",
    );
  });
});

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Launch concepts",
    archivedAt: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

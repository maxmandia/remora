/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import type { ProjectSummary } from "@remora/domain/project/dto";
import type { RenameProjectInput } from "@remora/domain/project/validator";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RenameProjectDialog } from "./rename-project-dialog.tsx";

const project = createProjectSummary();

const mocks = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
  options: undefined as
    | {
        onError?: (context: {
          error: Error;
          input: RenameProjectInput;
        }) => void;
        onSuccess?: () => void;
      }
    | undefined,
  reset: vi.fn(),
}));

vi.mock("../../hooks/use-rename-project-mutation.ts", () => ({
  useRenameProjectMutation: (
    options?: (typeof mocks)["options"],
  ): {
    isPending: boolean;
    mutate: typeof mocks.mutate;
    reset: typeof mocks.reset;
  } => {
    mocks.options = options;

    return {
      isPending: mocks.isPending,
      mutate: mocks.mutate,
      reset: mocks.reset,
    };
  },
}));

describe("RenameProjectDialog", () => {
  beforeEach(() => {
    mocks.isPending = false;
    mocks.mutate.mockReset();
    mocks.options = undefined;
    mocks.reset.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("prefills the current name and disables unchanged names", async () => {
    render(<RenameProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Rename project" });
    const input = within(dialog).getByRole("textbox", {
      name: "Project name",
    }) as HTMLInputElement;
    const renameButton = within(dialog).getByRole("button", {
      name: "Rename",
    }) as HTMLButtonElement;

    expect(input.value).toBe(project.name);
    expect(renameButton.disabled).toBe(true);

    fireEvent.change(input, { target: { value: `  ${project.name}  ` } });

    await waitFor(() => expect(renameButton.disabled).toBe(true));
  });

  it("trims, submits, and closes after a successful rename", async () => {
    render(<RenameProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Rename project" });
    const input = within(dialog).getByRole("textbox", {
      name: "Project name",
    });
    const renameButton = within(dialog).getByRole("button", {
      name: "Rename",
    }) as HTMLButtonElement;

    fireEvent.change(input, { target: { value: "  Launch campaign  " } });
    await waitFor(() => expect(renameButton.disabled).toBe(false));
    fireEvent.click(renameButton);

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        projectId: project.id,
        name: "Launch campaign",
      });
    });
    expect(screen.getByRole("dialog", { name: "Rename project" })).toBeTruthy();

    act(() => mocks.options?.onSuccess?.());

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename project" }),
      ).toBeNull();
    });
  });

  it("keeps the dialog open and shows server errors", async () => {
    render(<RenameProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Rename project" });
    const input = within(dialog).getByRole("textbox", {
      name: "Project name",
    });

    fireEvent.change(input, { target: { value: "Launch campaign" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Rename" }));

    const error = new Error(
      'A project named "Launch campaign" already exists.',
    );
    act(() => {
      mocks.options?.onError?.({
        error,
        input: { projectId: project.id, name: "Launch campaign" },
      });
    });

    expect(screen.getByRole("dialog", { name: "Rename project" })).toBeTruthy();
    expect(screen.getByText(error.message)).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("Launch campaign");

    fireEvent.change(input, { target: { value: "Launch campaign 2" } });
    expect(screen.queryByText(error.message)).toBeNull();
    expect(mocks.reset).toHaveBeenCalled();
  });

  it("disables submission while pending and resets when cancelled", async () => {
    mocks.isPending = true;
    render(<RenameProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Rename project" });
    const renameButton = within(dialog).getByRole("button", {
      name: "Rename",
    }) as HTMLButtonElement;

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Project name" }),
      { target: { value: "Launch campaign" } },
    );

    await waitFor(() => expect(renameButton.disabled).toBe(true));
    expect(renameButton.querySelector(".animate-spin")).not.toBeNull();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.reset).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Rename project" })).toBeNull();
  });
});

function RenameProjectDialogHarness() {
  const [open, setOpen] = useState(true);

  return (
    <RenameProjectDialog open={open} project={project} onOpenChange={setOpen} />
  );
}

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Launch concepts",
    threads: [],
    archivedAt: null,
    createdAt: "2026-06-15T12:00:00.000Z",
    updatedAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

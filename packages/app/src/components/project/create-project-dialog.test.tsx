/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import type { CreateProjectInput } from "@remora/domain/project/validator";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateProjectDialog } from "./create-project-dialog.tsx";

const mocks = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
  options: undefined as
    | {
        onError?: (context: {
          error: Error;
          input: CreateProjectInput;
        }) => void;
      }
    | undefined,
  reset: vi.fn(),
}));

vi.mock("../../hooks/use-create-project-mutation.ts", () => ({
  useCreateProjectMutation: (
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

describe("CreateProjectDialog", () => {
  beforeEach(() => {
    mocks.isPending = false;
    mocks.mutate.mockReset();
    mocks.options = undefined;
    mocks.reset.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("validates, trims, submits, closes, and resets the project name", async () => {
    render(<CreateProjectDialogHarness />);

    let dialog = screen.getByRole("dialog", { name: "Create project" });
    let projectNameInput = within(dialog).getByRole("textbox", {
      name: "Project name",
    }) as HTMLInputElement;
    let createProjectButton = within(dialog).getByRole("button", {
      name: "Create project",
    }) as HTMLButtonElement;

    expect(createProjectButton.disabled).toBe(true);

    fireEvent.change(projectNameInput, {
      target: { value: "   " },
    });
    expect(createProjectButton.disabled).toBe(true);

    fireEvent.change(projectNameInput, {
      target: { value: "  Launch concepts  " },
    });

    await waitFor(() => {
      expect(createProjectButton.disabled).toBe(false);
    });

    fireEvent.click(createProjectButton);

    await waitFor(() => {
      expect(mocks.mutate).toHaveBeenCalledWith({
        name: "Launch concepts",
      });
      expect(
        screen.queryByRole("dialog", { name: "Create project" }),
      ).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    dialog = screen.getByRole("dialog", { name: "Create project" });
    projectNameInput = within(dialog).getByRole("textbox", {
      name: "Project name",
    }) as HTMLInputElement;
    createProjectButton = within(dialog).getByRole("button", {
      name: "Create project",
    }) as HTMLButtonElement;

    expect(projectNameInput.value).toBe("");
    expect(createProjectButton.disabled).toBe(true);
  });

  it("resets form and mutation state when dismissed", async () => {
    render(<CreateProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Create project" });

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Project name" }),
      {
        target: { value: "Launch concepts" },
      },
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(mocks.reset).toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Create project" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open dialog" }));

    expect(
      (
        screen.getByRole("textbox", {
          name: "Project name",
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });

  it("disables submission while the mutation is pending", async () => {
    mocks.isPending = true;

    render(<CreateProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Create project" });
    const createProjectButton = within(dialog).getByRole("button", {
      name: "Create project",
    }) as HTMLButtonElement;

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Project name" }),
      {
        target: { value: "Launch concepts" },
      },
    );

    await waitFor(() => {
      expect(createProjectButton.disabled).toBe(true);
    });
    expect(createProjectButton.querySelector(".animate-spin")).not.toBeNull();
  });

  it("reopens with the submitted name and inline error after failure", async () => {
    render(<CreateProjectDialogHarness />);

    const dialog = screen.getByRole("dialog", { name: "Create project" });

    fireEvent.change(
      within(dialog).getByRole("textbox", { name: "Project name" }),
      {
        target: { value: "Launch concepts" },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create project" }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create project" }),
      ).toBeNull();
    });

    const error = new Error(
      'A project named "Launch concepts" already exists.',
    );

    mocks.options?.onError?.({
      error,
      input: { name: "Launch concepts" },
    });

    const reopenedDialog = await screen.findByRole("dialog", {
      name: "Create project",
    });

    expect(
      (
        within(reopenedDialog).getByRole("textbox", {
          name: "Project name",
        }) as HTMLInputElement
      ).value,
    ).toBe("Launch concepts");
    expect(within(reopenedDialog).getByText(error.message)).toBeTruthy();

    fireEvent.change(
      within(reopenedDialog).getByRole("textbox", {
        name: "Project name",
      }),
      {
        target: { value: "Launch concepts 2" },
      },
    );

    expect(within(reopenedDialog).queryByText(error.message)).toBeNull();
    expect(mocks.reset).toHaveBeenCalled();
  });
});

function CreateProjectDialogHarness() {
  const [open, setOpen] = useState(true);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <CreateProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

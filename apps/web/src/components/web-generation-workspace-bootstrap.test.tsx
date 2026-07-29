/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  balanceQueryFilter: vi.fn(),
  invalidateQueries: vi.fn(),
  navigate: vi.fn(),
  restore: {
    current: {
      complete: vi.fn(),
      discard: vi.fn(),
      draft: null as unknown,
      error: null as {
        kind: "promotion" | "storage";
        message: string;
      } | null,
      phase: "ready" as "loading" | "verification-required" | "error" | "ready",
      retry: vi.fn(),
    },
  },
  retryModels: vi.fn(),
  selection: {
    current: {
      error: null as unknown,
      isPending: false,
      models: [] as unknown[],
      retry: vi.fn(),
      selectedModel: null,
      setSelectedModel: vi.fn(),
    },
  },
  toastError: vi.fn(),
  useGuestGenerationRestore: vi.fn(),
  workspace: vi.fn(),
}));

vi.mock("@remora/app/generation", () => ({
  useGenerationModelSelection: () => mocks.selection.current,
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    credits: {
      getBalance: {
        queryFilter: mocks.balanceQueryFilter,
      },
    },
  }),
}));

vi.mock("@remora/ui", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("@tanstack/react-router", async () => {
  const React = await import("react");

  return {
    Navigate: (props: unknown) => {
      mocks.navigate(props);
      return React.createElement("span", { "data-testid": "navigate" });
    },
  };
});

vi.mock("../hooks/use-guest-generation-restore", () => ({
  useGuestGenerationRestore: (input: unknown) => {
    mocks.useGuestGenerationRestore(input);
    return mocks.restore.current;
  },
}));

vi.mock("./web-generation-workspace", async () => {
  const React = await import("react");

  return {
    WebGenerationWorkspace: (props: unknown) => {
      mocks.workspace(props);
      return React.createElement("div", null, "Resolved workspace");
    },
  };
});

import { WebGenerationWorkspaceBootstrap } from "./web-generation-workspace-bootstrap";

describe("web generation workspace bootstrap", () => {
  beforeEach(() => {
    mocks.balanceQueryFilter.mockReset();
    mocks.balanceQueryFilter.mockReturnValue({
      queryKey: [["credits", "getBalance"]],
    });
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.navigate.mockReset();
    mocks.restore.current = {
      complete: vi.fn().mockResolvedValue(true),
      discard: vi.fn().mockResolvedValue(true),
      draft: null,
      error: null,
      phase: "ready",
      retry: vi.fn().mockResolvedValue(undefined),
    };
    mocks.selection.current = {
      error: null,
      isPending: false,
      models: [],
      retry: vi.fn().mockResolvedValue(undefined),
      selectedModel: null,
      setSelectedModel: vi.fn(),
    };
    mocks.toastError.mockReset();
    mocks.useGuestGenerationRestore.mockReset();
    mocks.workspace.mockReset();
  });

  afterEach(cleanup);

  it("keeps the workspace behind model and restoration loading gates", () => {
    mocks.selection.current.isPending = true;
    const rendered = renderWorkspace();

    expect(screen.getByText("Preparing workspace...")).toBeTruthy();
    expect(mocks.workspace).not.toHaveBeenCalled();

    mocks.selection.current.isPending = false;
    mocks.restore.current.phase = "loading";
    rendered.rerender(createWorkspaceBootstrap());

    expect(screen.getByText("Restoring your generation...")).toBeTruthy();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("handles verification with a declarative redirect", () => {
    mocks.restore.current.phase = "verification-required";

    renderWorkspace();

    expect(screen.getByText("Returning to email verification...")).toBeTruthy();
    expect(mocks.navigate).toHaveBeenCalledWith({
      replace: true,
      search: {},
      to: "/check-email",
    });
    expect(mocks.workspace).not.toHaveBeenCalled();
  });

  it("offers retry only for promotion failures", () => {
    mocks.restore.current.error = {
      kind: "promotion",
      message: "Unable to apply your promotional credit.",
    };
    mocks.restore.current.phase = "error";

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mocks.restore.current.retry).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", {
        name: "Continue without saved generation",
      }),
    ).toBeNull();
  });

  it("allows storage failures to be durably discarded", async () => {
    mocks.restore.current.error = {
      kind: "storage",
      message: "Unable to restore your saved generation.",
    };
    mocks.restore.current.phase = "error";

    renderWorkspace();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Continue without saved generation",
      }),
    );

    await waitFor(() => {
      expect(mocks.restore.current.discard).toHaveBeenCalledOnce();
    });
  });

  it("selects restored models and emits discarded notices through hook callbacks", async () => {
    renderWorkspace();
    const input = mocks.useGuestGenerationRestore.mock.lastCall?.[0] as {
      onDraftDiscarded: (reason: "expired") => void;
      onDraftRestored: (draft: { model: unknown }) => void;
      onPromotionalCreditReady: () => Promise<void>;
    };
    const restoredModel = { id: "model_1" };

    input.onDraftRestored({ model: restoredModel });
    input.onDraftDiscarded("expired");
    await input.onPromotionalCreditReady();

    expect(mocks.selection.current.setSelectedModel).toHaveBeenCalledWith(
      restoredModel,
    );
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Your saved generation expired. Start a new one.",
    );
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: [["credits", "getBalance"]],
    });
  });

  it("passes grouped restoration operations to the resolved workspace", () => {
    const draft = { prompt: "Restored prompt" };
    mocks.restore.current.draft = draft;

    renderWorkspace();

    expect(mocks.workspace).toHaveBeenCalledWith(
      expect.objectContaining({
        guestGenerationRestore: {
          complete: mocks.restore.current.complete,
          discard: mocks.restore.current.discard,
          draft,
        },
        isSignedIn: true,
        projectId: "project_1",
        threadId: "thread_1",
        userId: "user_1",
      }),
    );
  });

  it("shows model failures and retries model loading", () => {
    mocks.selection.current.error = new Error("Network unavailable");

    renderWorkspace();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByText("Unable to prepare the workspace.")).toBeTruthy();
    expect(mocks.selection.current.retry).toHaveBeenCalledOnce();
    expect(mocks.workspace).not.toHaveBeenCalled();
  });
});

function renderWorkspace() {
  return render(createWorkspaceBootstrap());
}

function createWorkspaceBootstrap() {
  return (
    <WebGenerationWorkspaceBootstrap
      isSignedIn
      projectId="project_1"
      requestAuth={vi.fn().mockResolvedValue(undefined)}
      threadId="thread_1"
      userId="user_1"
    />
  );
}

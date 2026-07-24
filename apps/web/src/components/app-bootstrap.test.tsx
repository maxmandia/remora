/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authState: {
    current: {
      error: null as string | null,
      requestAuth: vi.fn(),
      signOut: vi.fn(),
      status: "loading" as "loading" | "signed-in" | "signed-out",
      user: null as {
        id: string;
        name: string;
        email: string;
        image: string | null;
      } | null,
    },
  },
  generationModelSelector: vi.fn(),
  selection: {
    current: {
      error: null as unknown,
      isPending: false,
      models: [] as PublishedGenerationModelSummary[],
      retry: vi.fn(),
      selectedModel: null as PublishedGenerationModelSummary | null,
      setSelectedModel: vi.fn(),
    },
  },
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("@remora/app/generation", async () => {
  const React = await import("react");

  return {
    GenerationModelSelector: (props: {
      models: PublishedGenerationModelSummary[];
      selectedModel: PublishedGenerationModelSummary | null;
      onSelectedModelChange: (
        model: PublishedGenerationModelSummary | null,
      ) => void;
    }) => {
      mocks.generationModelSelector(props);

      return React.createElement(
        "select",
        {
          "aria-label": "Model",
          value: props.selectedModel?.id ?? "",
          onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
            props.onSelectedModelChange(
              props.models.find((model) => model.id === event.target.value) ??
                null,
            );
          },
        },
        React.createElement("option", { value: "" }, "Select a model"),
        props.models.map((model) =>
          React.createElement(
            "option",
            { key: model.id, value: model.id },
            model.displayName,
          ),
        ),
      );
    },
    useGenerationModelSelection: () => mocks.selection.current,
  };
});

import { AppBootstrap } from "./app-bootstrap";

const seedanceModel = {
  id: "seedance-2.0-video",
  displayName: "Seedance 2.0",
} as PublishedGenerationModelSummary;

describe("app bootstrap", () => {
  beforeEach(() => {
    mocks.authState.current.error = null;
    mocks.authState.current.requestAuth.mockReset();
    mocks.authState.current.requestAuth.mockResolvedValue(undefined);
    mocks.authState.current.signOut.mockReset();
    mocks.authState.current.signOut.mockResolvedValue(undefined);
    mocks.authState.current.status = "loading";
    mocks.authState.current.user = null;
    mocks.generationModelSelector.mockReset();
    mocks.selection.current = {
      error: null,
      isPending: false,
      models: [],
      retry: vi.fn().mockResolvedValue(undefined),
      selectedModel: null,
      setSelectedModel: vi.fn(),
    };
  });

  afterEach(() => {
    cleanup();
  });

  it("shows session loading without rendering the workspace", () => {
    render(<AppBootstrap />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(mocks.generationModelSelector).not.toHaveBeenCalled();
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
  });

  it("redirects signed-out users to sign in", async () => {
    mocks.authState.current.status = "signed-out";

    render(<AppBootstrap />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(mocks.generationModelSelector).not.toHaveBeenCalled();
  });

  it("shows model loading before rendering the workspace", () => {
    setSignedIn();
    mocks.selection.current.isPending = true;

    render(<AppBootstrap />);

    expect(screen.getByText("Preparing workspace...")).toBeTruthy();
    expect(mocks.generationModelSelector).not.toHaveBeenCalled();
  });

  it("renders the shared model selector for signed-in users", () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);

    expect(
      screen.getByRole("main", { name: "Generation workspace" }),
    ).toBeTruthy();
    expect(screen.getByText("Create a generation")).toBeTruthy();
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "seedance-2.0-video",
    );
    expect(mocks.generationModelSelector).toHaveBeenCalledWith(
      expect.objectContaining({
        models: [seedanceModel],
        selectedModel: seedanceModel,
        onSelectedModelChange: mocks.selection.current.setSelectedModel,
      }),
    );
  });

  it("forwards model selection through the shared state", () => {
    const klingModel = {
      id: "kling-v3-text-to-video",
      displayName: "Kling 3.0 Text to Video",
    } as PublishedGenerationModelSummary;
    setSignedIn();
    mocks.selection.current.models = [seedanceModel, klingModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "kling-v3-text-to-video" },
    });

    expect(mocks.selection.current.setSelectedModel).toHaveBeenCalledWith(
      klingModel,
    );
  });

  it("redirects when model loading is unauthorized", async () => {
    setSignedIn();
    mocks.selection.current.error = {
      data: {
        code: "UNAUTHORIZED",
      },
    };

    render(<AppBootstrap />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(mocks.generationModelSelector).not.toHaveBeenCalled();
  });

  it("shows other failures and retries model loading", () => {
    setSignedIn();
    mocks.selection.current.error = new Error("Network unavailable");

    render(<AppBootstrap />);

    expect(screen.getByText("Unable to prepare the workspace.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(mocks.selection.current.retry).toHaveBeenCalledTimes(1);
  });
});

function setSignedIn() {
  mocks.authState.current.status = "signed-in";
  mocks.authState.current.user = {
    id: "user_1",
    name: "Remora User",
    email: "user@example.com",
    image: null,
  };
}

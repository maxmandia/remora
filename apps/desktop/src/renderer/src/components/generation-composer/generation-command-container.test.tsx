/** @vitest-environment jsdom */

import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationSettingsValue } from "../../lib/generation";
import { GenerationCommandContainer } from "./generation-command-container.tsx";

const mocks = vi.hoisted(() => ({
  estimateGenerationCost: vi.fn(),
  estimateGenerationCostQueryOptions: vi.fn(),
  getBalance: vi.fn(),
  getBalanceQueryOptions: vi.fn(),
}));

vi.mock("./generation-cost-estimate.tsx", () => ({
  GenerationCostEstimate: () => null,
}));

vi.mock("../../lib/trpc.ts", () => ({
  useTRPC: () => ({
    credits: {
      getBalance: {
        queryOptions: mocks.getBalanceQueryOptions,
      },
    },
    modelRates: {
      estimateGenerationCost: {
        queryOptions: mocks.estimateGenerationCostQueryOptions,
      },
    },
  }),
}));

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    Button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
    Tooltip: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    TooltipContent: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", { role: "tooltip", ...props }, children),
    TooltipTrigger: ({
      children,
      render,
      ...props
    }: React.ComponentPropsWithoutRef<"button"> & {
      render?: React.ReactElement<Record<string, unknown>>;
    }) =>
      render
        ? React.cloneElement(render, props)
        : React.createElement("button", props, children),
    Select: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectTrigger: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", { type: "button", ...props }, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    FilePickerButton: ({
      accept: _accept,
      children,
      multiple: _multiple,
      onFilesSelect: _onFilesSelect,
      ...props
    }: React.ComponentProps<"button"> & {
      accept?: string;
      multiple?: boolean;
      onFilesSelect: (files: File[]) => void;
    }) => React.createElement("button", props, children),
    Combobox: ({
      children,
      items,
      itemToStringLabel,
      itemToStringValue,
      onInputValueChange,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      items: Array<Record<string, unknown>>;
      itemToStringLabel: (item: Record<string, unknown>) => string;
      itemToStringValue: (item: Record<string, unknown>) => string;
      onInputValueChange?: (value: string) => void;
      onValueChange: (value: Record<string, unknown> | null) => void;
      value: Record<string, unknown> | null;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "select",
          {
            "aria-label": isProjectComboboxItem(items[0])
              ? "Project"
              : "Model",
            value: value ? itemToStringValue(value) : "",
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              const nextValue =
                items.find(
                  (item) => itemToStringValue(item) === event.target.value,
                ) ?? null;

              onValueChange(nextValue);
              onInputValueChange?.(
                nextValue ? itemToStringLabel(nextValue) : "",
              );
            },
          },
          React.createElement(
            "option",
            { value: "" },
            isProjectComboboxItem(items[0])
              ? "Select a project"
              : "Select a model",
          ),
          items.map((item) =>
            React.createElement(
              "option",
              {
                key: itemToStringValue(item),
                value: itemToStringValue(item),
              },
              itemToStringLabel(item),
            ),
          ),
        ),
        children,
      ),
    ComboboxInput: (props: Record<string, unknown>) =>
      React.createElement("input", {
        "aria-hidden": true,
        "data-testid": "model-combobox-input",
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxSeparator: () => null,
  };
});

describe("GenerationCommandContainer", () => {
  beforeEach(() => {
    mocks.estimateGenerationCost.mockReset();
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    });
    mocks.estimateGenerationCostQueryOptions.mockReset();
    mocks.estimateGenerationCostQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["modelRates", "estimateGenerationCost", input],
        queryFn: async () => mocks.estimateGenerationCost(input),
      }),
    );
    mocks.getBalance.mockReset();
    mocks.getBalance.mockResolvedValue({
      availableCreditAmountUsdMicros: 25_000_000,
      reservedCreditAmountUsdMicros: 0,
    });
    mocks.getBalanceQueryOptions.mockReset();
    mocks.getBalanceQueryOptions.mockImplementation(() => ({
      queryKey: ["credits", "getBalance"],
      queryFn: mocks.getBalance,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("emits prompt changes and submits only when enabled", async () => {
    const onPromptChange = vi.fn();
    const onSelectedModelChange = vi.fn();
    const onSubmit = vi.fn();
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    const props = {
      models: [model],
      prompt: "",
      selectedModel: null,
      projects: [],
      selectedProject: null,
      selectedProjectId: null,
      projectSelectorDisabled: false,
      showProjectSelector: false,
      generationAttachmentMedia: createAttachmentMediaValue(),
      generationSettings: null,
      onClearProject: vi.fn(),
      onGenerationAttachmentMediaChange: vi.fn(),
      onGenerationSettingsChange: vi.fn(),
      onPromptChange,
      onSelectProject: vi.fn(),
      onSelectedModelChange,
      onSubmit,
    };
    const rendered = render(
      <GenerationCommandContainer {...props} canSubmit={false} />,
    );
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    expect(
      rendered.container.querySelector('[data-surface="strong"]'),
    ).not.toBeNull();
    expect(
      rendered.container.querySelector('[data-surface="strong"]')?.className,
    ).toContain("bg-surface-strong");
    expect(submitButton.getAttribute("variant")).toBe("ghost");

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    expect(onPromptChange).toHaveBeenCalledWith(
      "A glass studio above the ocean",
    );
    expect(submitButton.disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    rendered.rerender(
      <GenerationCommandContainer
        {...props}
        canSubmit
        generationSettings={createGenerationSettings()}
        prompt="A glass studio above the ocean"
        selectedModel={model}
      />,
    );

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("renders a disabled submit reason in a tooltip", async () => {
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 25_000_001,
      currencyCode: "USD",
    });
    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        canSubmit
        generationSettings={createGenerationSettings()}
        selectedModel={createModel("seedance-2.0-video", "Seedance 2.0")}
      />,
    );

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Submit generation",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(true);
      expect(screen.getByRole("tooltip").textContent).toBe(
        "Not enough credits.",
      );
    });
  });

  it("renders the project selector when enabled", () => {
    const project = createProject("project-1", "Campaign");

    const rendered = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        projects={[project]}
        selectedProject={project}
        selectedProjectId={project.id}
        showProjectSelector
      />,
    );

    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(
      rendered.container.querySelector(
        '[data-slot="generation-project-selector"]',
      ),
    ).not.toBeNull();
  });

  it("does not render the project selector when hidden", () => {
    const rendered = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        showProjectSelector={false}
      />,
    );

    expect(screen.queryByLabelText("Project")).toBeNull();
    expect(
      rendered.container.querySelector(
        '[data-slot="generation-project-selector"]',
      ),
    ).toBeNull();
  });

  it("emits project selection changes", () => {
    const onClearProject = vi.fn();
    const onSelectProject = vi.fn();
    const project = createProject("project-1", "Campaign");

    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        projects={[project]}
        selectedProject={project}
        selectedProjectId={project.id}
        showProjectSelector
        onClearProject={onClearProject}
        onSelectProject={onSelectProject}
      />,
    );

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "__remora-no-project__" },
    });

    expect(onClearProject).toHaveBeenCalledOnce();
    expect(onSelectProject).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: project.id },
    });

    expect(onSelectProject).toHaveBeenCalledWith(project.id);
  });

  it("does not emit project selection changes when the project selector is disabled", () => {
    const onClearProject = vi.fn();
    const onSelectProject = vi.fn();
    const project = createProject("project-1", "Campaign");

    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        projects={[project]}
        selectedProject={project}
        selectedProjectId={project.id}
        projectSelectorDisabled
        showProjectSelector
        onClearProject={onClearProject}
        onSelectProject={onSelectProject}
      />,
    );

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: "__remora-no-project__" },
    });

    fireEvent.change(screen.getByLabelText("Project"), {
      target: { value: project.id },
    });

    expect(onClearProject).not.toHaveBeenCalled();
    expect(onSelectProject).not.toHaveBeenCalled();
  });
});

function isProjectComboboxItem(item: Record<string, unknown> | undefined) {
  return item ? "type" in item : false;
}

function render(ui: ReactElement) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return renderReact(ui, { wrapper: Wrapper });
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function createGenerationCommandContainerProps() {
  return {
    canSubmit: false,
    models: [],
    prompt: "",
    selectedModel: null,
    projects: [],
    selectedProject: null,
    selectedProjectId: null,
    projectSelectorDisabled: false,
    showProjectSelector: false,
    generationAttachmentMedia: createAttachmentMediaValue(),
    generationSettings: null,
    onClearProject: vi.fn(),
    onGenerationAttachmentMediaChange: vi.fn(),
    onGenerationSettingsChange: vi.fn(),
    onPromptChange: vi.fn(),
    onSelectProject: vi.fn(),
    onSelectedModelChange: vi.fn(),
    onSubmit: vi.fn(),
  };
}

function createAttachmentMediaValue() {
  return {
    images: [],
    videos: [],
    audios: [],
  };
}

function createGenerationSettings(): GenerationSettingsValue {
  return {
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 1,
  };
}

function createProject(id: string, name: string): ProjectSummary {
  return {
    id,
    name,
    threads: [],
    archivedAt: null,
    createdAt: "2026-06-26T00:00:00.000Z",
    updatedAt: "2026-06-26T00:00:00.000Z",
  };
}

function createModel(
  id: string,
  displayName: string,
): PublishedGenerationModelSummary {
  const promptField = createPromptField();

  return {
    id,
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName,
    type: "video",
    latestSpecId: `${id}-v1`,
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id,
      provider: "byteplus",
      providerModelId: null,
      displayName,
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/test",
      },
      modelParameter: {
        path: ["model"],
        source: "runtime",
      },
      fields: [promptField],
      groups: [
        {
          id: "input",
          label: "Input",
          fieldIds: [promptField.id],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createPromptField(): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: true,
    advanced: false,
    defaultValue: "",
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
  };
}

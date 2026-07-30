/** @vitest-environment jsdom */

import type {
  PublishedGenerationModelSummary,
  GenerationFieldSpec,
} from "@remora/domain/generation-model/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as renderReact,
  screen,
  waitFor,
} from "@testing-library/react";
import { act, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import type { GenerationSettingsValue } from "../../lib/generation/generation-settings.ts";
import { GenerationCommandContainer } from "./generation-command-container.tsx";
import { generationChromeTransitionDurationMs } from "../../lib/generation/generation-command-transition.ts";

const mocks = vi.hoisted(() => ({
  authStatus: {
    current: "signed-in" as "loading" | "signed-in" | "signed-out",
  },
  buildPrompt: vi.fn(),
  buildPromptMutationOptions: vi.fn(),
  estimateGenerationCost: vi.fn(),
  estimateGenerationCostQueryOptions: vi.fn(),
  getBalance: vi.fn(),
  getBalanceQueryOptions: vi.fn(),
  prefersReducedMotion: {
    current: false,
  },
  useGenerationVideoDurations: vi.fn(),
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => ({
    error: null,
    requestAuth: vi.fn(),
    signOut: vi.fn(),
    status: mocks.authStatus.current,
    user:
      mocks.authStatus.current === "signed-in"
        ? {
            id: "user_1",
            name: "Remora User",
            email: "user@example.com",
            image: null,
          }
        : null,
  }),
}));

vi.mock("./generation-cost-estimate.tsx", () => ({
  GenerationCostEstimate: () => <div data-testid="generation-cost-estimate" />,
}));

vi.mock("@remora/app/trpc", () => ({
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
    promptBuilder: {
      build: {
        mutationOptions: mocks.buildPromptMutationOptions,
      },
    },
  }),
}));

vi.mock("../../hooks/use-generation-video-durations.ts", () => ({
  useGenerationVideoDurations: mocks.useGenerationVideoDurations,
}));

vi.mock("../../hooks/use-prefers-reduced-motion.ts", () => ({
  usePrefersReducedMotion: () => mocks.prefersReducedMotion.current,
}));

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    Button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
    cn: (...classes: Array<string | undefined>) =>
      classes.filter(Boolean).join(" "),
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
            "aria-label": isProjectComboboxItem(items[0]) ? "Project" : "Model",
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
    mocks.authStatus.current = "signed-in";
    mocks.buildPrompt.mockReset();
    mocks.buildPrompt.mockImplementation(async (input) => input);
    mocks.buildPromptMutationOptions.mockReset();
    mocks.buildPromptMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.buildPrompt,
    }));
    mocks.prefersReducedMotion.current = false;
    mocks.useGenerationVideoDurations.mockReset();
    mocks.useGenerationVideoDurations.mockReturnValue({
      durationSecByFile: new Map(),
      isPending: false,
    });
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
    mocks.getBalanceQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["credits", "getBalance"],
      queryFn: mocks.getBalance,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("emits prompt changes and submits only when enabled", async () => {
    const onPromptChange = vi.fn();
    const onSelectedModelChange = vi.fn();
    const onSubmit = vi.fn();
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    const props = {
      requiresAffordability: true,
      models: [model],
      prompt: "",
      selectedModel: null,
      projects: [],
      selectedProject: null,
      selectedProjectId: null,
      projectSelectorDisabled: false,
      generationAttachmentMedia: createAttachmentMediaValue(),
      generationSettings: null,
      onClearProject: vi.fn(),
      onGenerationAttachmentMediaChange: vi.fn(),
      onGenerationSettingsChange: vi.fn(),
      onPromptChange,
      onBuyCredits: vi.fn(),
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

  it("loads cost data while submission is unavailable", async () => {
    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        canSubmit={false}
        generationSettings={createGenerationSettings()}
        selectedModel={createModel("seedance-2.0-video", "Seedance 2.0")}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await waitFor(() => {
      expect(mocks.getBalance).toHaveBeenCalledOnce();
      expect(mocks.estimateGenerationCost).toHaveBeenCalledOnce();
    });
  });

  it("does not load account data or enable submission while signed out", async () => {
    mocks.authStatus.current = "signed-out";

    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        canSubmit
        generationSettings={createGenerationSettings()}
        selectedModel={createModel("seedance-2.0-video", "Seedance 2.0")}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await waitFor(() => {
      expect(mocks.getBalance).not.toHaveBeenCalled();
      expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
    });
    expect(mocks.getBalanceQueryOptions).toHaveBeenCalledWith(undefined, {
      enabled: false,
    });
  });

  it("enables a guest preview without loading or rendering affordability data", async () => {
    mocks.authStatus.current = "signed-out";
    const onSubmit = vi.fn();

    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        canSubmit
        requiresAffordability={false}
        generationSettings={createGenerationSettings()}
        onSubmit={onSubmit}
        selectedModel={createModel("seedance-2.0-video", "Seedance 2.0")}
      />,
    );

    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    expect(submitButton.disabled).toBe(false);
    fireEvent.click(submitButton);

    expect(onSubmit).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(mocks.getBalance).not.toHaveBeenCalled();
      expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
    });
    expect(screen.queryByTestId("generation-cost-estimate")).toBeNull();
  });

  it("disables submit when the estimate exceeds the available credit balance", async () => {
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
    });
  });

  it("suspends cost estimation while video duration metadata is pending", async () => {
    mocks.useGenerationVideoDurations.mockReturnValue({
      durationSecByFile: new Map(),
      isPending: true,
    });

    render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        canSubmit
        generationSettings={createGenerationSettings()}
        selectedModel={createModel("seedance-2.0-video", "Seedance 2.0")}
      />,
    );

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await waitFor(() => {
      expect(mocks.estimateGenerationCost).not.toHaveBeenCalled();
    });
  });

  it("always renders the project selector", () => {
    const project = createProject("project-1", "Campaign");

    const rendered = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        projects={[project]}
        selectedProject={project}
        selectedProjectId={project.id}
      />,
    );

    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(
      rendered.container.querySelector(
        '[data-slot="generation-project-selector"]',
      ),
    ).not.toBeNull();
    expect(screen.getByTestId("generation-cost-estimate")).toBeTruthy();
  });

  it("keeps primary controls pinned beside horizontally scrollable settings", () => {
    const model = createModel("seedance-2.0-video", "Seedance 2.0");
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        generationSettings={createGenerationSettings()}
        models={[model]}
        selectedModel={model}
      />,
    );
    const controls = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-controls"]',
    );
    const settingsViewport = container.querySelector<HTMLElement>(
      '[data-slot="generation-settings-scroll-viewport"]',
    );
    const settingsContent = container.querySelector<HTMLElement>(
      '[data-slot="generation-settings-scroll-content"]',
    );
    const primaryControls = container.querySelector<HTMLElement>(
      '[data-slot="generation-primary-controls"]',
    );

    expect(controls?.className).toContain("min-w-0");
    expect(settingsViewport?.className).toContain("min-w-0");
    expect(settingsViewport?.className).toContain("flex-1");
    expect(settingsViewport?.className).toContain("overflow-x-auto");
    expect(settingsViewport?.className).toContain("overflow-y-hidden");
    expect(settingsViewport?.className).toContain("[scrollbar-width:none]");
    expect(settingsContent?.className).toContain("w-max");
    expect(primaryControls?.className).toContain("shrink-0");
    expect(primaryControls?.querySelector("select")).not.toBeNull();
    expect(
      primaryControls?.contains(
        screen.getByRole("button", { name: "Submit generation" }),
      ),
    ).toBe(true);
  });

  it("owns attachment controls and previews inside the shared container", () => {
    const model = createModel("seedance-2.0-video", "Seedance 2.0", true);
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        generationAttachmentMedia={createAttachmentMediaValue({
          audios: [{ file: audioFile, role: "reference" }],
        })}
        generationSettings={createGenerationSettings()}
        models={[model]}
        selectedModel={model}
      />,
    );
    const commandContainer = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-container"]',
    );
    const attachmentPreview = container.querySelector<HTMLElement>(
      '[data-slot="attachment-media-preview"]',
    );

    expect(screen.getByRole("button", { name: "Add attachment" })).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Attachment audio: soundtrack.mp3",
      }),
    ).toBeTruthy();
    expect(commandContainer?.contains(attachmentPreview)).toBe(true);
  });

  it("places the wizard behind the command surface at its tuned peek height", () => {
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
      />,
    );
    const wizard = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-wizard"]',
    );
    const commandSurface = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-surface"]',
    );

    expect(wizard).not.toBeNull();
    expect(wizard?.className).toContain("top-0");
    expect(wizard?.className).toContain("right-4");
    expect(wizard?.className).toContain("size-12");
    expect(wizard?.className).toContain("-translate-y-3/5");
    expect(wizard?.className).toContain("z-[5]");
    expect(wizard?.querySelector('[data-slot="wizard-head"]')).not.toBeNull();
    expect(commandSurface?.className).toContain("z-10");
  });

  it("adds a reduced-motion-safe white glow in prompt builder mode", () => {
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
      />,
    );
    const commandContainer = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-container"]',
    )!;
    const commandSurface = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-surface"]',
    )!;

    expect(commandContainer.className).toContain("group/generation-command");
    expect(commandSurface.className).toContain("transition-[box-shadow]");
    expect(commandSurface.className).toContain("duration-[260ms]");
    expect(commandSurface.className).toContain(
      "ease-[cubic-bezier(0.22,1,0.36,1)]",
    );
    expect(commandSurface.className).toContain(
      "group-data-[mode=prompt-builder]/generation-command:shadow-[0_0_0_1px,0_0_14px]",
    );
    expect(commandSurface.className).toContain(
      "group-data-[mode=prompt-builder]/generation-command:shadow-white/8",
    );
    expect(commandSurface.className).toContain("motion-reduce:transition-none");

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );

    expect(commandContainer.dataset.mode).toBe("prompt-builder");
    expect(
      container.querySelector('[data-slot="generation-command-surface"]'),
    ).toBe(commandSurface);
  });

  it("renders an autosizing prompt input in prompt builder mode", () => {
    mocks.prefersReducedMotion.current = true;
    const onPromptChange = vi.fn();
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        prompt="Initial prompt"
        requiresAffordability={false}
        onPromptChange={onPromptChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );

    const promptInput = container.querySelector<HTMLTextAreaElement>(
      '[data-slot="prompt-builder"] [data-slot="prompt-textarea"]',
    );

    expect(promptInput).not.toBeNull();
    expect(promptInput?.value).toBe("Initial prompt");
    expect(promptInput?.rows).toBe(1);
    expect(promptInput?.className).toContain("field-sizing-content");
    expect(promptInput?.className).toContain("max-h-[25dvh]");
    expect(promptInput?.className).toContain("resize-none");

    fireEvent.change(promptInput!, {
      target: { value: "Expanded prompt\nwith more detail" },
    });

    expect(onPromptChange).toHaveBeenCalledWith(
      "Expanded prompt\nwith more detail",
    );
  });

  it("uses the wizard as an accessible timed toggle between composer modes", () => {
    vi.useFakeTimers();
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        requiresAffordability={false}
      />,
    );
    const commandContainer = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-container"]',
    )!;
    const commandSurface = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-surface"]',
    )!;
    const wizard = screen.getByRole("button", {
      name: "Open prompt builder",
    });

    expect(wizard.getAttribute("type")).toBe("button");
    expect(wizard.getAttribute("aria-pressed")).toBe("false");
    expect(wizard.getAttribute("aria-disabled")).toBeNull();
    expect(commandContainer.dataset.mode).toBe("generation");
    expect(commandContainer.dataset.transitionState).toBe("generation");
    const stableProjectTray = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector"]',
    );

    expect(stableProjectTray?.className).toContain("-mt-3");
    expect(stableProjectTray?.className).toContain("h-16");

    fireEvent.click(wizard);

    expect(commandContainer.dataset.mode).toBe("prompt-builder");
    expect(commandContainer.dataset.transitionState).toBe(
      "entering-prompt-builder",
    );
    expect(wizard.getAttribute("aria-pressed")).toBe("true");
    expect(wizard.getAttribute("aria-disabled")).toBeNull();
    expect(
      container.querySelector('[data-slot="generation-command-form"]'),
    ).toBeNull();
    const enteringPromptBuilder = container.querySelector<HTMLElement>(
      '[data-slot="prompt-builder"]',
    );

    expect(enteringPromptBuilder).not.toBeNull();
    expect(enteringPromptBuilder?.parentElement).toBe(commandSurface);
    expect(enteringPromptBuilder?.getAttribute("aria-hidden")).toBe("true");
    expect(enteringPromptBuilder?.hasAttribute("inert")).toBe(true);
    expect(
      enteringPromptBuilder?.querySelector('[data-slot="prompt-textarea"]'),
    ).not.toBeNull();
    const exitingProjectTray = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector"]',
    );
    const exitingProjectTrayContent = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector-content"]',
    );

    expect(exitingProjectTray?.dataset.motionState).toBe("exiting");
    expect(exitingProjectTray?.getAttribute("aria-hidden")).toBe("true");
    expect(exitingProjectTray?.hasAttribute("inert")).toBe(true);
    expect(exitingProjectTrayContent?.dataset.motionState).toBe("exiting");
    expect(exitingProjectTrayContent?.parentElement).toBe(exitingProjectTray);
    expect(exitingProjectTray).toBe(stableProjectTray);
    expect(
      container.querySelector('[data-slot="prompt-builder-dot-transition"]'),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs - 1);
    });
    expect(commandContainer.dataset.transitionState).toBe(
      "entering-prompt-builder",
    );
    expect(wizard.getAttribute("aria-disabled")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(commandContainer.dataset.transitionState).toBe("prompt-builder");
    const settledPromptBuilder = container.querySelector<HTMLElement>(
      '[data-slot="prompt-builder"]',
    );

    expect(settledPromptBuilder).toBe(enteringPromptBuilder);
    expect(settledPromptBuilder?.hasAttribute("aria-hidden")).toBe(false);
    expect(settledPromptBuilder?.hasAttribute("inert")).toBe(false);
    expect(
      settledPromptBuilder?.querySelector('[data-slot="prompt-textarea"]'),
    ).not.toBeNull();
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="generation-project-selector"]',
      )?.dataset.motionState,
    ).toBe("hidden");
    expect(stableProjectTray?.style.pointerEvents).toBe("none");
    expect(
      container.querySelector(
        '[data-slot="generation-project-selector-content"]',
      ),
    ).toBeNull();
    expect(
      container.querySelector('[data-slot="generation-project-selector"]'),
    ).toBe(stableProjectTray);
    expect(
      screen.getByRole("button", {
        name: "Return to generation composer",
      }),
    ).toBe(wizard);
    expect(wizard.getAttribute("aria-disabled")).toBeNull();

    fireEvent.click(wizard);

    expect(commandContainer.dataset.mode).toBe("generation");
    expect(commandContainer.dataset.transitionState).toBe(
      "returning-generation",
    );
    expect(wizard.getAttribute("aria-pressed")).toBe("false");
    expect(wizard.getAttribute("aria-disabled")).toBeNull();
    const enteringProjectTray = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector"]',
    );
    const enteringProjectTrayContent = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector-content"]',
    );

    expect(enteringProjectTray).toBe(stableProjectTray);
    expect(enteringProjectTray?.dataset.motionState).toBe("entering");
    expect(enteringProjectTray?.getAttribute("aria-hidden")).toBe("true");
    expect(enteringProjectTray?.hasAttribute("inert")).toBe(true);
    expect(enteringProjectTrayContent?.dataset.motionState).toBe("entering");
    expect(enteringProjectTrayContent?.parentElement).toBe(enteringProjectTray);
    expect(
      container.querySelector('[data-slot="prompt-builder-dot-transition"]'),
    ).toBeNull();

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs - 1);
    });
    expect(commandContainer.dataset.transitionState).toBe(
      "returning-generation",
    );
    expect(wizard.getAttribute("aria-disabled")).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(commandContainer.dataset.transitionState).toBe("generation");
    expect(wizard.getAttribute("aria-disabled")).toBeNull();
    expect(
      container
        .querySelector<HTMLElement>('[data-slot="generation-command-form"]')
        ?.hasAttribute("inert"),
    ).toBe(false);
    const visibleProjectTray = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector"]',
    );
    const visibleProjectTrayContent = container.querySelector<HTMLElement>(
      '[data-slot="generation-project-selector-content"]',
    );

    expect(visibleProjectTray?.dataset.motionState).toBe("visible");
    expect(visibleProjectTray?.hasAttribute("aria-hidden")).toBe(false);
    expect(visibleProjectTray?.hasAttribute("inert")).toBe(false);
    expect(visibleProjectTray?.style.pointerEvents).toBe("");
    expect(visibleProjectTrayContent?.dataset.motionState).toBe("visible");
    expect(visibleProjectTray).toBe(stableProjectTray);
  });

  it("immediately reverses in-progress wizard transitions", () => {
    vi.useFakeTimers();
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        requiresAffordability={false}
      />,
    );
    const commandContainer = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-container"]',
    )!;
    const wizard = screen.getByRole("button", {
      name: "Open prompt builder",
    });

    fireEvent.click(wizard);
    expect(commandContainer.dataset.transitionState).toBe(
      "entering-prompt-builder",
    );
    expect(
      container.querySelector('[data-slot="prompt-builder"]'),
    ).not.toBeNull();

    fireEvent.click(wizard);
    expect(commandContainer.dataset.transitionState).toBe("generation");
    expect(wizard.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByPlaceholderText("A castle in the sky with..."),
    ).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs);
    });
    expect(commandContainer.dataset.transitionState).toBe("generation");

    fireEvent.click(wizard);
    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs);
    });
    expect(commandContainer.dataset.transitionState).toBe("prompt-builder");

    fireEvent.click(wizard);
    expect(commandContainer.dataset.transitionState).toBe(
      "returning-generation",
    );
    expect(
      screen.getByPlaceholderText("A castle in the sky with..."),
    ).toBeTruthy();

    fireEvent.click(wizard);
    expect(commandContainer.dataset.transitionState).toBe("prompt-builder");
    expect(wizard.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelector('[data-slot="prompt-builder"]'),
    ).not.toBeNull();

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs);
    });
    expect(commandContainer.dataset.transitionState).toBe("prompt-builder");
  });

  it("preserves the controlled generation draft while prompt builder is open", () => {
    vi.useFakeTimers();
    const project = createProject("project-1", "Campaign");
    const model = createModel("seedance-2.0-video", "Seedance 2.0", true);
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });
    const props = {
      ...createGenerationCommandContainerProps(),
      requiresAffordability: false,
      models: [model],
      prompt: "A rough glass-studio idea",
      selectedModel: model,
      projects: [project],
      selectedProject: project,
      selectedProjectId: project.id,
      generationAttachmentMedia: createAttachmentMediaValue({
        audios: [{ file: audioFile, role: "reference" as const }],
      }),
      generationSettings: createGenerationSettings(),
    };
    const { container } = render(<GenerationCommandContainer {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="attachment-media-preview"]',
      )?.dataset.motionState,
    ).toBe("exiting");

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs);
    });

    expect(
      screen.queryByRole("img", {
        name: "Attachment audio: soundtrack.mp3",
      }),
    ).toBeNull();
    expect(screen.queryByLabelText("Project")).toBeNull();
    expect(
      container.querySelector<HTMLTextAreaElement>(
        '[data-slot="prompt-builder"] [data-slot="prompt-textarea"]',
      )?.value,
    ).toBe(props.prompt);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Return to generation composer",
      }),
    );
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="attachment-media-preview"]',
      )?.dataset.motionState,
    ).toBe("entering");

    act(() => {
      vi.advanceTimersByTime(generationChromeTransitionDurationMs);
    });

    expect(
      (
        screen.getByPlaceholderText(
          "A castle in the sky with...",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("A rough glass-studio idea");
    expect((screen.getByLabelText("Project") as HTMLSelectElement).value).toBe(
      project.id,
    );
    expect(
      screen.getByRole("img", {
        name: "Attachment audio: soundtrack.mp3",
      }),
    ).toBeTruthy();
    expect(props.onPromptChange).not.toHaveBeenCalled();
    expect(props.onGenerationSettingsChange).not.toHaveBeenCalled();
    expect(props.onGenerationAttachmentMediaChange).not.toHaveBeenCalled();
    expect(props.onSelectProject).not.toHaveBeenCalled();
    expect(props.onClearProject).not.toHaveBeenCalled();
    expect(props.onSubmit).not.toHaveBeenCalled();
  });

  it("submits prompt builder input without leaving prompt builder mode", async () => {
    mocks.prefersReducedMotion.current = true;
    const props = {
      ...createGenerationCommandContainerProps(),
      requiresAffordability: false,
      prompt: "A rough glass-studio idea",
    };
    const { container } = render(<GenerationCommandContainer {...props} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Submit prompt builder" }),
    );

    await waitFor(() => {
      expect(mocks.buildPrompt.mock.calls[0]?.[0]).toEqual({
        modelType: "image",
        prompt: "A rough glass-studio idea",
      });
    });
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="generation-command-container"]',
      )?.dataset.transitionState,
    ).toBe("prompt-builder");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Prompt details",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("A rough glass-studio idea");
  });

  it("keeps prompt builder input retryable after a backend failure", async () => {
    mocks.prefersReducedMotion.current = true;
    mocks.buildPrompt.mockRejectedValueOnce(new Error("Backend unavailable"));
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        requiresAffordability={false}
        prompt="A rough glass-studio idea"
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit prompt builder",
    }) as HTMLButtonElement;

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.buildPrompt).toHaveBeenCalledTimes(1);
      expect(submitButton.disabled).toBe(false);
    });
    expect(
      container.querySelector<HTMLElement>(
        '[data-slot="generation-command-container"]',
      )?.dataset.transitionState,
    ).toBe("prompt-builder");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Prompt details",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("A rough glass-studio idea");
  });

  it("switches modes immediately when reduced motion is preferred", () => {
    mocks.prefersReducedMotion.current = true;
    const { container } = render(
      <GenerationCommandContainer
        {...createGenerationCommandContainerProps()}
        requiresAffordability={false}
      />,
    );
    const commandContainer = container.querySelector<HTMLElement>(
      '[data-slot="generation-command-container"]',
    )!;

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );

    expect(commandContainer.dataset.transitionState).toBe("prompt-builder");
    expect(
      container.querySelector('[data-slot="prompt-builder-dot-transition"]'),
    ).toBeNull();
    const promptBuilder = container.querySelector<HTMLElement>(
      '[data-slot="prompt-builder"]',
    );

    expect(promptBuilder).not.toBeNull();
    expect(promptBuilder?.hasAttribute("aria-hidden")).toBe(false);
    expect(promptBuilder?.hasAttribute("inert")).toBe(false);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Return to generation composer",
      }),
    );

    expect(commandContainer.dataset.transitionState).toBe("generation");
    expect(
      screen.getByPlaceholderText("A castle in the sky with..."),
    ).toBeTruthy();
    expect(screen.getByLabelText("Project")).toBeTruthy();
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
    requiresAffordability: true,
    models: [],
    prompt: "",
    selectedModel: null,
    projects: [],
    selectedProject: null,
    selectedProjectId: null,
    projectSelectorDisabled: false,
    generationAttachmentMedia: createAttachmentMediaValue(),
    generationSettings: null,
    onClearProject: vi.fn(),
    onGenerationAttachmentMediaChange: vi.fn(),
    onGenerationSettingsChange: vi.fn(),
    onPromptChange: vi.fn(),
    onBuyCredits: vi.fn(),
    onSelectProject: vi.fn(),
    onSelectedModelChange: vi.fn(),
    onSubmit: vi.fn(),
  };
}

function createAttachmentMediaValue(
  overrides: Partial<GenerationAttachmentMediaValue> = {},
): GenerationAttachmentMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
    ...overrides,
  };
}

function createGenerationSettings(): GenerationSettingsValue {
  return {
    modelType: "video",
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
  includesAttachmentMedia = false,
): PublishedGenerationModelSummary {
  const promptField = createPromptField();
  const attachmentMediaField = createAudioAttachmentMediaField();

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
      fields: [
        promptField,
        ...(includesAttachmentMedia ? [attachmentMediaField] : []),
      ],
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

function createAudioAttachmentMediaField(): GenerationFieldSpec {
  return {
    id: "audios",
    label: "Reference audio",
    componentKind: "mediaList",
    valueKind: "array",
    required: false,
    advanced: false,
    defaultValue: [],
    omitWhenEmpty: true,
    omitWhenDefault: false,
    arrayMax: 1,
    mediaRoleCapabilities: ["reference"],
    mediaConstraints: {
      mimeTypes: ["audio/mpeg"],
      extensions: [".mp3"],
    },
    notes: [],
  };
}

function createPromptField(): GenerationFieldSpec {
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

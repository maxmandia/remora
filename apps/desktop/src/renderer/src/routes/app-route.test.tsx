/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { HotkeysProvider } from "@remora/app/hotkeys";
import {
  generationVideoPreviewFallbackImageUrl,
  multiGenerationPanelClosedTransform,
  multiGenerationPanelOpenTransform,
} from "@remora/app/generation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPublicAssetUrl } from "../lib/public-asset.ts";
import { AppRoute } from "./app-route.tsx";

import {
  desktopPreferencesStorageKey,
  useDesktopPreferencesStore,
} from "../stores/preferences-store.ts";

import type {
  GenerationThreadSubmission,
  VideoGenerationThreadSubmission,
} from "@remora/domain/generation-submission/dto";
import type {
  PublishedGenerationModelSummary,
  GenerationFieldSpec,
} from "@remora/domain/generation-model/dto";
import type { GenerationThreadSummary } from "@remora/domain/generation-thread/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";

type MockProjectComboboxNoProjectItem = {
  type: "no-project";
  id: string;
  label: string;
};

type MockProjectComboboxProjectItem = {
  type: "project";
  id: string;
  project: ProjectSummary;
};

type MockComboboxItem =
  | PublishedGenerationModelSummary
  | ProjectSummary
  | MockProjectComboboxProjectItem
  | MockProjectComboboxNoProjectItem;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {
    current: {} as { threadId?: string },
  },
  routeSearch: {
    current: {} as { projectId?: string },
  },
  estimateGenerationCost: vi.fn(),
  estimateGenerationCostQueryOptions: vi.fn(),
  modelQueryOptions: vi.fn(),
  creditBalanceQueryOptions: vi.fn(),
  projectListQueryFilter: vi.fn(),
  projectListQueryOptions: vi.fn(),
  projectMutationOptions: vi.fn(),
  renameProjectMutationOptions: vi.fn(),
  attachmentMediaQueryOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  imageMutationOptions: vi.fn(),
  videoMutationOptions: vi.fn(),
  retryMutationOptions: vi.fn(),
  buildPromptMutationOptions: vi.fn(),
  createProject: vi.fn(),
  renameProject: vi.fn(),
  createImage: vi.fn(),
  createVideo: vi.fn(),
  retry: vi.fn(),
  buildPrompt: vi.fn(),
  attachmentMediaUpload: vi.fn(),
  canGoBack: false,
  historyIndex: 0,
  historyLength: 1,
  routerBack: vi.fn(),
  routerForward: vi.fn(),
  toastError: vi.fn(),
  authState: {
    current: {
      status: "signed-in" as const,
      user: { id: "user_1" },
      error: null,
      requestAuth: async () => undefined,
      signOut: async () => undefined,
    },
  },
}));

vi.hoisted(() => {
  const items = new Map<string, string>();
  const localStorageMock = {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorageMock,
  });

  if (globalThis.window) {
    Object.defineProperty(globalThis.window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
  }
});

vi.mock("@tanstack/react-router", () => ({
  useCanGoBack: () => mocks.canGoBack,
  useLocation: ({
    select,
  }: {
    select?: (location: { state: { __TSR_index: number } }) => unknown;
  } = {}) => {
    const location = { state: { __TSR_index: mocks.historyIndex } };

    return select ? select(location) : location;
  },
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
  useRouter: () => ({
    history: {
      back: mocks.routerBack,
      forward: mocks.routerForward,
      length: mocks.historyLength,
    },
  }),
  useSearch: () => mocks.routeSearch.current,
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    credits: {
      getBalance: {
        queryOptions: mocks.creditBalanceQueryOptions,
      },
    },
    generation: {
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
      },
      listAttachmentMediaFromSubmission: {
        queryOptions: mocks.attachmentMediaQueryOptions,
      },
      createVideo: {
        mutationOptions: mocks.videoMutationOptions,
      },
      createImage: {
        mutationOptions: mocks.imageMutationOptions,
      },
      retry: {
        mutationOptions: mocks.retryMutationOptions,
      },
    },
    generationThread: {
      listWithoutProject: {
        queryOptions: mocks.threadQueryOptions,
      },
    },
    model: {
      listPublished: {
        queryOptions: mocks.modelQueryOptions,
      },
    },
    modelRates: {
      estimateGenerationCost: {
        queryOptions: mocks.estimateGenerationCostQueryOptions,
      },
    },
    project: {
      listProjects: {
        queryFilter: mocks.projectListQueryFilter,
        queryOptions: mocks.projectListQueryOptions,
      },
      createProject: {
        mutationOptions: mocks.projectMutationOptions,
      },
      renameProject: {
        mutationOptions: mocks.renameProjectMutationOptions,
      },
    },
    promptBuilder: {
      build: {
        mutationOptions: mocks.buildPromptMutationOptions,
      },
    },
  }),
}));

vi.mock("@remora/ui", async () => {
  const React = await import("react");
  type SidebarContextValue = {
    state: "expanded" | "collapsed";
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleSidebar: () => void;
  };
  const SidebarContext = React.createContext<SidebarContextValue | null>(null);
  function useSidebar() {
    const context = React.useContext(SidebarContext);

    if (!context) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
    }

    return context;
  }

  return {
    Badge: ({ children, ...props }: React.ComponentProps<"span">) =>
      React.createElement("span", props, children),
    Button: ({ children, ...props }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
    CurrencyInput: ({
      inputClassName,
      onValueChange,
      ...props
    }: React.ComponentProps<"input"> & {
      inputClassName?: string;
      onValueChange: (value: string) => void;
    }) =>
      React.createElement("input", {
        ...props,
        className: inputClassName,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange(event.target.value),
      }),
    FilePickerButton: ({
      accept,
      children,
      multiple,
      onFilesSelect,
      ...props
    }: React.ComponentProps<"button"> & {
      accept?: string;
      multiple?: boolean;
      onFilesSelect: (files: File[]) => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement("button", props, children),
        React.createElement("input", {
          accept,
          "aria-hidden": true,
          "data-slot": "file-picker-input",
          disabled: props.disabled,
          multiple,
          tabIndex: -1,
          type: "file",
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            const files = Array.from(event.currentTarget.files ?? []);

            event.currentTarget.value = "";

            if (files.length > 0) {
              onFilesSelect(files);
            }
          },
        }),
      ),
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
    Dialog: ({
      children,
      open,
    }: {
      children: React.ReactNode;
      open?: boolean;
    }) => (open ? React.createElement(React.Fragment, null, children) : null),
    DialogContent: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", { role: "dialog", ...props }, children),
    DialogDescription: ({ children, ...props }: React.ComponentProps<"p">) =>
      React.createElement("p", props, children),
    DialogFooter: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    DialogHeader: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    DialogTitle: ({ children, ...props }: React.ComponentProps<"h2">) =>
      React.createElement("h2", props, children),
    DropdownMenu: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    DropdownMenuContent: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", { role: "menu", ...props }, children),
    DropdownMenuGroup: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", { role: "group", ...props }, children),
    DropdownMenuItem: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"button">) =>
      React.createElement(
        "button",
        { role: "menuitem", type: "button", ...props },
        children,
      ),
    DropdownMenuLabel: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", props, children),
    DropdownMenuSeparator: (props: React.ComponentPropsWithoutRef<"div">) =>
      React.createElement("div", { role: "separator", ...props }),
    DropdownMenuTrigger: ({
      children,
      render,
      ...props
    }: React.ComponentPropsWithoutRef<"button"> & {
      render?: React.ReactElement<Record<string, unknown>>;
    }) =>
      render
        ? React.cloneElement(render, props)
        : React.createElement("button", props, children),
    Field: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    FieldDescription: ({ children, ...props }: React.ComponentProps<"p">) =>
      React.createElement("p", props, children),
    FieldError: ({
      children,
      errors,
      ...props
    }: React.ComponentProps<"div"> & {
      errors?: Array<{ message?: string } | undefined>;
    }) => {
      const content =
        children ??
        errors
          ?.map((error) => error?.message)
          .filter(Boolean)
          .join(", ");

      return content
        ? React.createElement("div", { role: "alert", ...props }, content)
        : null;
    },
    FieldGroup: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    FieldLabel: ({ children, ...props }: React.ComponentProps<"label">) =>
      React.createElement("label", props, children),
    Input: (props: React.ComponentProps<"input">) =>
      React.createElement("input", props),
    Skeleton: (props: React.ComponentProps<"div">) =>
      React.createElement("div", props),
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
    toast: {
      error: mocks.toastError,
    },
    Sidebar: ({ children, ...props }: React.ComponentProps<"aside">) =>
      React.createElement("aside", props, children),
    SidebarContent: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarFooter: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarGroup: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarGroupContent: ({
      children,
      ...props
    }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarGroupLabel: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarHeader: ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement("div", props, children),
    SidebarInset: ({ children, ...props }: React.ComponentProps<"main">) =>
      React.createElement("main", props, children),
    SidebarMenu: ({ children, ...props }: React.ComponentProps<"ul">) =>
      React.createElement("ul", props, children),
    SidebarMenuAction: ({
      children,
      ...props
    }: React.ComponentProps<"button">) =>
      React.createElement("button", props, children),
    SidebarMenuButton: ({
      children,
      isActive: _isActive,
      ...props
    }: React.ComponentProps<"button"> & { isActive?: boolean }) =>
      React.createElement("button", props, children),
    SidebarMenuItem: ({ children, ...props }: React.ComponentProps<"li">) =>
      React.createElement("li", props, children),
    SidebarMenuLink: ({
      children,
      isActive: _isActive,
      ...props
    }: React.ComponentProps<"a"> & { isActive?: boolean }) =>
      React.createElement("a", props, children),
    SidebarMenuSub: ({ children, ...props }: React.ComponentProps<"ul">) =>
      React.createElement("ul", props, children),
    SidebarMenuSubButton: ({
      children,
      isActive: _isActive,
      ...props
    }: React.ComponentProps<"a"> & { isActive?: boolean }) =>
      React.createElement("a", props, children),
    SidebarMenuSubItem: ({ children, ...props }: React.ComponentProps<"li">) =>
      React.createElement("li", props, children),
    SidebarProvider: ({
      children,
      defaultOpen = true,
      open: controlledOpen,
      onOpenChange,
      ...props
    }: React.ComponentProps<"div"> & {
      defaultOpen?: boolean;
      open?: boolean;
      onOpenChange?: (open: boolean) => void;
    }) => {
      const [uncontrolledOpen, setUncontrolledOpen] =
        React.useState(defaultOpen);
      const open = controlledOpen ?? uncontrolledOpen;
      const setOpen = React.useCallback(
        (nextOpen: boolean) => {
          onOpenChange?.(nextOpen);

          if (controlledOpen === undefined) {
            setUncontrolledOpen(nextOpen);
          }
        },
        [controlledOpen, onOpenChange],
      );
      const toggleSidebar = React.useCallback(() => {
        setOpen(!open);
      }, [open, setOpen]);
      const contextValue = React.useMemo(
        () => ({
          state: open ? ("expanded" as const) : ("collapsed" as const),
          open,
          setOpen,
          toggleSidebar,
        }),
        [open, setOpen, toggleSidebar],
      );

      return React.createElement(
        SidebarContext.Provider,
        { value: contextValue },
        React.createElement(
          "div",
          { ...props, "data-state": contextValue.state },
          children,
        ),
      );
    },
    WorkspaceSidebar: ({
      children,
      footer,
      header,
      ...props
    }: React.ComponentProps<"aside"> & {
      footer?: React.ReactNode;
      header: React.ReactNode;
    }) => React.createElement("aside", props, header, children, footer),
    useSidebar,
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
      items: Array<
        MockComboboxItem | { value: string; items: MockComboboxItem[] }
      >;
      itemToStringLabel?: (item: MockComboboxItem) => string;
      itemToStringValue?: (item: MockComboboxItem) => string;
      onInputValueChange?: (value: string) => void;
      onValueChange: (value: MockComboboxItem | null) => void;
      value: MockComboboxItem | null;
    }) => {
      const comboboxInput = React.Children.toArray(children).find(
        (
          child,
        ): child is React.ReactElement<{
          disabled?: boolean;
          placeholder?: string;
        }> =>
          React.isValidElement<{
            disabled?: boolean;
            placeholder?: string;
          }>(child) && typeof child.props.placeholder === "string",
      );
      const placeholder = comboboxInput?.props.placeholder;
      const disabled = Boolean(comboboxInput?.props.disabled);
      const getItemLabel =
        itemToStringLabel ??
        ((item: MockComboboxItem) =>
          "displayName" in item
            ? item.displayName
            : "name" in item
              ? item.name
              : "project" in item
                ? item.project.name
                : item.label);
      const getItemValue =
        itemToStringValue ?? ((item: MockComboboxItem) => item.id);
      const isProjectCombobox = placeholder === "Select a project to work in";
      const comboboxItems = items.flatMap((item) =>
        "items" in item ? item.items : [item],
      );
      const getOptionLabel = (item: MockComboboxItem) =>
        isProjectCombobox && "type" in item && item.type === "no-project"
          ? item.label
          : isProjectCombobox
            ? ""
            : getItemLabel(item);

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "select",
          {
            "aria-label": isProjectCombobox ? "Project" : "Model",
            disabled,
            hidden: isProjectCombobox,
            value: value ? getItemValue(value) : "",
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              const nextModel =
                comboboxItems.find(
                  (item) => getItemValue(item) === event.target.value,
                ) ?? null;

              onValueChange(nextModel);
              onInputValueChange?.(nextModel ? getItemLabel(nextModel) : "");
            },
          },
          React.createElement(
            "option",
            { value: "" },
            isProjectCombobox ? "" : (placeholder ?? "Select an item"),
          ),
          comboboxItems.map((item) =>
            React.createElement(
              "option",
              { key: item.id, value: getItemValue(item) },
              getOptionLabel(item),
            ),
          ),
        ),
        children,
      );
    },
    ComboboxInput: (props: Record<string, unknown>) =>
      React.createElement("input", {
        "aria-hidden": true,
        disabled: Boolean(props.disabled),
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxSeparator: () => React.createElement("hr", null),
    Select: ({
      children,
      items,
      onValueChange,
      value,
    }: {
      children: React.ReactNode;
      items?: Array<{ label: string; value: string }>;
      onValueChange?: (value: string) => void;
      value?: string;
    }) =>
      items?.every((item) => item.value === "image" || item.value === "video")
        ? React.createElement(
            "select",
            {
              "aria-label": "Generation type",
              value,
              onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
                onValueChange?.(event.target.value),
            },
            items.map((item) =>
              React.createElement(
                "option",
                { key: item.value, value: item.value },
                item.label,
              ),
            ),
          )
        : React.createElement(React.Fragment, null, children),
    SelectTrigger: ({ children }: { children: React.ReactNode }) =>
      React.createElement("button", { type: "button" }, children),
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    SelectItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

describe("AppRoute composer submission", () => {
  beforeEach(() => {
    resetDesktopPreferencesStore();
    mocks.navigate.mockReset();
    mocks.creditBalanceQueryOptions.mockReset();
    mocks.estimateGenerationCost.mockReset();
    mocks.estimateGenerationCostQueryOptions.mockReset();
    mocks.modelQueryOptions.mockReset();
    mocks.projectListQueryFilter.mockReset();
    mocks.projectListQueryOptions.mockReset();
    mocks.projectMutationOptions.mockReset();
    mocks.renameProjectMutationOptions.mockReset();
    mocks.attachmentMediaQueryOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.imageMutationOptions.mockReset();
    mocks.videoMutationOptions.mockReset();
    mocks.retryMutationOptions.mockReset();
    mocks.buildPromptMutationOptions.mockReset();
    mocks.createProject.mockReset();
    mocks.renameProject.mockReset();
    mocks.createImage.mockReset();
    mocks.createVideo.mockReset();
    mocks.retry.mockReset();
    mocks.buildPrompt.mockReset();
    mocks.attachmentMediaUpload.mockReset();
    mocks.canGoBack = false;
    mocks.historyIndex = 0;
    mocks.historyLength = 1;
    mocks.routerBack.mockReset();
    mocks.routerForward.mockReset();
    mocks.toastError.mockReset();
    mocks.routeParams.current = {};
    mocks.routeSearch.current = {};
    mocks.createProject.mockResolvedValue({
      id: "project_1",
      name: "Launch concepts",
      threads: [],
      archivedAt: null,
      createdAt: "2026-06-05T00:00:00.000Z",
      updatedAt: "2026-06-05T00:00:00.000Z",
    });
    mocks.createImage.mockResolvedValue({
      submissionId: "submission_1",
      threadId: "thread_created",
      jobs: [
        {
          jobId: "job_1",
          workflowId: "generation-job:job_1",
          status: "queued",
        },
      ],
    });
    mocks.createVideo.mockResolvedValue({
      submissionId: "submission_1",
      threadId: "thread_created",
      jobs: [
        {
          jobId: "job_1",
          workflowId: "generation-job:job_1",
          status: "queued",
        },
      ],
    });
    mocks.buildPrompt.mockImplementation(async (input) =>
      input.modelId === "flux-3-video"
        ? {
            modelId: input.modelId,
            modelType: "video",
            prompt: "A cinematic glass studio",
            duration: 10,
          }
        : {
            modelId: input.modelId,
            modelType: "image",
            prompt: "A cinematic glass studio",
          },
    );
    mocks.buildPromptMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.buildPrompt,
    }));
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 0,
      currencyCode: "USD",
    });
    mocks.estimateGenerationCostQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["modelRates", "estimateGenerationCost", input],
        queryFn: async () => mocks.estimateGenerationCost(input),
      }),
    );
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel()],
    }));
    mocks.creditBalanceQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["credits", "getBalance"],
      queryFn: async () => ({
        availableCreditAmountUsdMicros: 25_000_000,
        reservedCreditAmountUsdMicros: 0,
      }),
    }));
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [],
      }),
    );
    mocks.attachmentMediaQueryOptions.mockImplementation((input, options) => ({
      ...options,
      queryKey: ["generation", "listAttachmentMediaFromSubmission", input],
      queryFn: async () => [],
    }));
    mocks.projectListQueryFilter.mockReturnValue({
      queryKey: ["project", "listProjects"],
    });
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [],
    }));
    mocks.projectMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createProject,
    }));
    mocks.renameProjectMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.renameProject,
    }));
    mocks.imageMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createImage,
    }));
    mocks.videoMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createVideo,
    }));
    mocks.retryMutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.retry,
    }));
    mocks.attachmentMediaUpload.mockImplementation(async (request) => ({
      id: "attachment_media_1",
      kind: request.kind,
      originalFileName: request.fileName,
      contentType: request.contentType,
      contentLength: request.data.byteLength,
      metadata: {
        widthPx: null,
        heightPx: null,
        durationSec: null,
        fps: null,
      },
    }));
    Object.defineProperty(window, "remoraAttachmentMedia", {
      configurable: true,
      value: {
        upload: mocks.attachmentMediaUpload,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("fetches threads for signed-in users", () => {
    renderAppRoute();

    expect(mocks.threadQueryOptions).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ enabled: true }),
    );
  });

  it("shows and dismisses the wizard instruction after the entrance completes", async () => {
    useDesktopPreferencesStore.setState({ hasSeenWizardEntrance: false });
    const { container } = renderAppRoute();

    expect(screen.queryByRole("status")).toBeNull();

    fireEvent.load(getRemoraLogo(container));

    expect((await screen.findByRole("status")).textContent).toBe(
      "Click the wizard to help build prompts",
    );
    expect(useDesktopPreferencesStore.getState().hasSeenWizardEntrance).toBe(
      true,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );

    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("selects FLUX 3 by default when models load", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [
        createSeedanceFastModel(),
        createSeedanceModel(),
        createFluxModel(),
      ],
    }));

    renderAppRoute();

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "flux-3-video",
      );
    });
  });

  it("does not fetch thread submissions and keeps the dock occlusion on the fresh route", () => {
    const { container } = renderAppRoute();

    expect(mocks.threadSubmissionsQueryOptions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("generation-thread-job")).toBeNull();
    expect(queryComposerDockOcclusion(container)).toBeTruthy();
  });

  it("previews selected attachment media inside the measured composer layout", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModelWithAttachmentMedia()],
    }));
    const { container } = renderAppRoute();
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "motion.mp4", {
      type: "video/mp4",
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await screen.findByRole("button", { name: "Add attachment" });

    fireEvent.change(getAttachmentFileInput(container), {
      target: { files: [imageFile, videoFile] },
    });

    const imagePreview = await screen.findByRole("img", {
      name: "Attachment image: reference.png",
    });
    const videoPreview = screen.getByLabelText("Attachment video: motion.mp4");
    const preview = imagePreview.closest(
      '[data-slot="attachment-media-preview"]',
    );
    const composerLayout = getComposerLayout(container);

    expect(preview).not.toBeNull();
    expect(composerLayout.contains(preview)).toBe(true);
    expect(composerLayout.contains(videoPreview)).toBe(true);

    fireEvent.click(
      screen.getByRole("button", {
        name: "View attachment image: reference.png",
      }),
    );

    const dialog = screen.getByRole("dialog", {
      name: "Attachment image viewer",
    });

    expect(dialog.style.top).toBe("var(--remora-titlebar-height)");
    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(false);

    fireEvent.click(
      within(dialog).getAllByRole("button", {
        name: "Close attachment image",
      })[1]!,
    );

    expect(
      screen.queryByRole("dialog", { name: "Attachment image viewer" }),
    ).toBeNull();
    expect(useDesktopPreferencesStore.getState().sidebarOpen).toBe(true);
  });

  it("keeps invalid attachment media visible while blocking submit", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModelWithAttachmentMedia()],
    }));
    const { container } = renderAppRoute();
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;
    const imageFile = new File(["12345678901"], "too-large.png", {
      type: "image/png",
    });

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });

    fireEvent.change(getAttachmentFileInput(container), {
      target: { files: [imageFile] },
    });

    await screen.findByRole("img", {
      name: "Attachment image: too-large.png",
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
    });

    fireEvent.click(submitButton);

    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it("blocks audio-only attachment submissions with a visible warning", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModelWithAttachmentMedia()],
    }));
    const { container } = renderAppRoute();
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });

    fireEvent.change(getAttachmentFileInput(container), {
      target: { files: [audioFile] },
    });

    expect(
      screen.getByRole("img", {
        name: "Attachment audio: soundtrack.mp3",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Audio attachments need an image or video attachment.",
      }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
    });

    fireEvent.click(submitButton);

    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it("fetches and renders generation outputs for selected threads", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [createThreadSubmission()],
      }),
    );

    renderAppRoute({ threadId: "thread_1" });

    expect(mocks.threadSubmissionsQueryOptions).toHaveBeenCalledWith(
      {
        threadId: "thread_1",
      },
      {
        meta: {
          suppressErrorToast: true,
        },
      },
    );
    const preview = await screen.findByRole("img", {
      name: "Video preview unavailable",
    });

    expect(preview.getAttribute("src")).toBe(
      generationVideoPreviewFallbackImageUrl,
    );
  });

  it("opens an empty stack panel inside the thread results for multi-generation stack clicks", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [
          createThreadSubmission({
            requestedGenerations: 2,
            jobs: [
              createThreadSubmissionJob({
                id: "job_1",
                submissionIndex: 0,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/first.jpg",
                }),
              }),
              createThreadSubmissionJob({
                id: "job_2",
                submissionIndex: 1,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/second.jpg",
                }),
              }),
            ],
          }),
        ],
      }),
    );

    const { container } = renderAppRoute({ threadId: "thread_1" });

    const stackTrigger = await screen.findByRole("button", {
      name: "Open generation stack",
    });
    const stage = screen.getByTestId("generation-composer-stage");
    const composer = screen.getByTestId("generation-composer");
    const composerLayout = getComposerLayout(container);
    const composerDockOcclusion = getComposerDockOcclusion(container);
    const results = getGenerationResults(container);
    const resultsLayout = getGenerationResultsLayout(container);
    const resultsList = getGenerationResultsList(container);
    const stackPanel = getStackPanel(container);

    expect(stage.style.containerType).toBe("inline-size");
    expect(
      stage.style.getPropertyValue("--remora-generation-content-width"),
    ).toBe("var(--remora-generation-content-base-width)");
    mockElementRect(composerLayout, {
      height: 188,
      left: 120,
      top: 640,
      width: 960,
    });
    fireEvent.resize(window);
    await waitFor(() => {
      expect(
        stage.style.getPropertyValue(
          "--remora-generation-composer-measured-height",
        ),
      ).toBe("188px");
    });
    expect(screen.queryByAltText("Remora")).toBeNull();
    expect(composer.contains(composerLayout)).toBe(true);
    expect(composerLayout.contains(composerDockOcclusion)).toBe(true);
    expect(results.contains(stackPanel)).toBe(true);
    expect(composer.contains(stackPanel)).toBe(false);
    expect(composer.className).toContain("z-[3]");
    expect(composer.className).toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(results.className).toContain("absolute");
    expect(results.className).toContain("inset-x-0");
    expect(results.className).toContain("top-0");
    expect(results.className).toContain(
      "bottom-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(results.className).toContain("z-[2]");
    expect(results.className).toContain("min-h-0");
    expect(results.className).toContain("overflow-hidden");
    expect(results.className).not.toContain("overflow-y-auto");
    expect(results.className).not.toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(results.className).not.toContain(
      "pb-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(resultsLayout.className).toContain("mx-auto");
    expect(resultsLayout.className).toContain("flex-1");
    expect(resultsLayout.className).toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(
      resultsList.querySelector(
        '[data-slot="generation-results-bottom-spacer"]',
      ),
    ).toBeNull();
    expect(resultsList.contains(stackPanel)).toBe(false);
    expect(resultsList.className).toContain("min-h-0");
    expect(resultsList.className).toContain("flex-1");
    expect(resultsList.className).toContain("overflow-x-hidden");
    expect(resultsList.className).toContain("overflow-y-auto");
    expect(resultsList.className).toContain("overscroll-contain");
    expect(composerDockOcclusion.className).toContain("pointer-events-none");
    expect(composerDockOcclusion.className).toContain("absolute");
    expect(composerDockOcclusion.className).toContain("z-0");
    expect(composerDockOcclusion.className).toContain(
      "h-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(composerDockOcclusion.className).toContain(
      "bg-[var(--remora-stage-background,var(--background))]",
    );
    expect(composerLayout.getAttribute("data-stack-panel-state")).toBe(
      "closed",
    );
    expect(composerLayout.style.transform).toBe(
      multiGenerationPanelClosedTransform,
    );
    expect(composerLayout.className).toContain("duration-[400ms]");
    expect(composerLayout.className).toContain(
      "ease-[cubic-bezier(0.22,1,0.36,1)]",
    );
    expect(composerLayout.className).toContain("motion-reduce:transition-none");
    expectComposerDocked();
    expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe("closed");
    expect(resultsLayout.style.transform).toBe(
      multiGenerationPanelClosedTransform,
    );
    expect(stackPanel.getAttribute("data-state")).toBe("closed");
    expect(stackPanel.getAttribute("aria-hidden")).toBe("true");
    expect(stackPanel.className).toContain("top-0");
    expect(stackPanel.className).not.toContain("h-full");
    expect(stackPanel.className).toContain(
      "bottom-[var(--remora-generation-composer-bottom-inset)]",
    );
    expect(stackPanel.className).toContain(
      "left-[calc(100%+var(--remora-generation-stack-panel-gap))]",
    );
    expect(stackPanel.className).toContain(
      "w-[var(--remora-generation-stack-panel-width)]",
    );
    expect(stackPanel.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-[var(--remora-generation-stack-panel-expanded-width)]",
    );
    expect(stackPanel.className).toContain("duration-[400ms]");
    expect(stackPanel.className).toContain(
      "ease-[cubic-bezier(0.22,1,0.36,1)]",
    );
    expect(stackTrigger.getAttribute("aria-controls")).toBe(stackPanel.id);
    expect(stackTrigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(stackTrigger);

    await waitFor(() => {
      expect(composerLayout.getAttribute("data-stack-panel-state")).toBe(
        "open",
      );
      expect(composerLayout.style.transform).toBe(
        multiGenerationPanelOpenTransform,
      );
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe("open");
      expect(resultsLayout.style.transform).toBe(
        composerLayout.style.transform,
      );
      expect(stackPanel.getAttribute("data-state")).toBe("open");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("false");
      expect(stackPanel.getAttribute("data-active-submission-id")).toBe(
        "submission_1",
      );
      expect(
        screen
          .getByRole("button", { name: "Close generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
    });

    const closePanelButton = screen.getByRole("button", {
      name: "Close generation panel",
    });

    expect(closePanelButton.getAttribute("aria-keyshortcuts")).toBe("Escape");
    expect(getTooltipText("Close panel")).toContain("Close panel");
    expect(getTooltipText("Close panel")).toContain("Escape");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(composerLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
      expect(composerLayout.style.transform).toBe(
        multiGenerationPanelClosedTransform,
      );
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
      expect(resultsLayout.style.transform).toBe(
        multiGenerationPanelClosedTransform,
      );
      expect(stackPanel.getAttribute("data-state")).toBe("closed");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("true");
      expect(
        screen
          .getByRole("button", { name: "Open generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("false");
    });
  });

  it("lets Escape close playback before the open stack panel", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [
          createThreadSubmission({
            requestedGenerations: 2,
            jobs: [
              createThreadSubmissionJob({
                id: "job_1",
                submissionIndex: 0,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/first.jpg",
                }),
              }),
              createThreadSubmissionJob({
                id: "job_2",
                submissionIndex: 1,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/second.jpg",
                }),
              }),
            ],
          }),
        ],
      }),
    );

    const { container } = renderAppRoute({ threadId: "thread_1" });

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Open generation stack",
      }),
    );

    const composerLayout = getComposerLayout(container);
    const resultsLayout = getGenerationResultsLayout(container);
    const stackPanel = getStackPanel(container);

    await waitFor(() => {
      expect(stackPanel.getAttribute("data-state")).toBe("open");
    });

    fireEvent.click(
      within(stackPanel).getAllByRole("button", {
        name: "Play generated video",
      })[0]!,
    );

    expect(
      screen.getByRole("dialog", { name: "Generated video playback" }),
    ).toBeTruthy();

    const playbackSurface = getPlaybackSurface();

    await waitFor(() => {
      expect(playbackSurface.style.transform).toBe(
        "translate3d(0, 0, 0) scale(1)",
      );
    });

    fireEvent.transitionEnd(playbackSurface, { propertyName: "transform" });
    await screen.findByTestId("generation-video-playback-video");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(getPlaybackBackdrop().style.opacity).toBe("0");
      expect(stackPanel.getAttribute("data-state")).toBe("open");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("false");
      expect(
        screen
          .getByRole("button", { name: "Close generation stack" })
          .getAttribute("aria-expanded"),
      ).toBe("true");
    });

    fireEvent.transitionEnd(playbackSurface, { propertyName: "transform" });

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Generated video playback" }),
      ).toBeNull();
    });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(composerLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
      expect(resultsLayout.getAttribute("data-stack-panel-state")).toBe(
        "closed",
      );
      expect(stackPanel.getAttribute("data-state")).toBe("closed");
      expect(stackPanel.getAttribute("aria-hidden")).toBe("true");
    });
  });

  it("uses the expanded stack panel width override when the sidebar starts collapsed", async () => {
    await hydrateDesktopPreferencesStore({ sidebarOpen: false });
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation(
      (input, options) => ({
        ...options,
        queryKey: ["generation", "listSubmissionsFromThread", input],
        queryFn: async () => [
          createThreadSubmission({
            requestedGenerations: 2,
            jobs: [
              createThreadSubmissionJob({
                id: "job_1",
                submissionIndex: 0,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/first.jpg",
                }),
              }),
              createThreadSubmissionJob({
                id: "job_2",
                submissionIndex: 1,
                result: createThreadSubmissionResult({
                  previewImageUrl: "https://assets.example/second.jpg",
                }),
              }),
            ],
          }),
        ],
      }),
    );

    const { container } = renderAppRoute({ threadId: "thread_1" });

    await screen.findByRole("button", { name: "Open generation stack" });
    expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
    expect(
      container
        .querySelector<HTMLElement>(".remora-app-workspace")
        ?.getAttribute("data-state"),
    ).toBe("collapsed");

    const stackPanel = getStackPanel(container);

    expect(stackPanel.className).toContain(
      "w-[var(--remora-generation-stack-panel-width)]",
    );
    expect(stackPanel.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-[var(--remora-generation-stack-panel-expanded-width)]",
    );
  });

  it("starts fresh generations bottom-docked with centered welcome content", () => {
    renderAppRoute();

    expectComposerDocked();
    expect(
      screen
        .getByTestId("generation-composer-stage")
        .style.getPropertyValue("--remora-generation-welcome-top-offset"),
    ).toBe("calc(var(--remora-titlebar-height) * -1)");
    expect(screen.getByAltText("Remora")).toBeTruthy();
    expect(
      screen.getByRole("group", { name: "Creative categories" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Film" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ads" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Art" })).toBeTruthy();
  });

  it("keeps thread routes bottom-docked without welcome content", () => {
    renderAppRoute({ threadId: "thread_1" });

    expectComposerDocked();
    expect(screen.queryByAltText("Remora")).toBeNull();
    expect(
      screen.queryByRole("group", { name: "Creative categories" }),
    ).toBeNull();
  });

  it("navigates to thread routes from the sidebar", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute();

    const threadLink = await screen.findByRole("link", {
      name: /Soft studio treatment/,
    });

    fireEvent.click(threadLink);

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/threads/$threadId",
      params: { threadId: "thread_1" },
    });
  });

  it("marks the route thread active in the sidebar", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute({ threadId: "thread_1" });

    const threadLink = await screen.findByRole("link", {
      name: /Soft studio treatment/,
    });

    expect(threadLink.getAttribute("aria-current")).toBe("page");
  });

  it("shows the project selector for selected project threads", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
      threads: [
        createProjectThreadSummary({
          id: "thread_project_1",
          name: "Hero frames",
        }),
      ],
    });

    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [],
    }));
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ threadId: "thread_project_1" });

    const projectSelect = (await screen.findByLabelText(
      "Project",
    )) as HTMLSelectElement;

    await waitFor(() => {
      expect(projectSelect.value).toBe("project_1");
    });
    expect(projectSelect.disabled).toBe(true);
  });

  it("shows the no-project selector state for selected threads outside projects", () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [
        createThreadSummary({
          id: "thread_unprojected",
          name: "Loose exploration",
        }),
      ],
    }));

    renderAppRoute({ threadId: "thread_unprojected" });

    const projectSelect = screen.getByLabelText("Project") as HTMLSelectElement;

    expect(projectSelect.value).toBe("__remora-no-project__");
    expect(projectSelect.disabled).toBe(true);
  });

  it("updates the project selector when switching between project threads", async () => {
    const firstProject = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
      threads: [
        createProjectThreadSummary({
          id: "thread_project_1",
          name: "Hero frames",
        }),
      ],
    });
    const secondProject = createProjectSummary({
      id: "project_2",
      name: "Storyboard pass",
      threads: [
        createProjectThreadSummary({
          id: "thread_project_2",
          name: "Opening shot",
        }),
      ],
    });

    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [],
    }));
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [firstProject, secondProject],
    }));

    const rendered = renderAppRoute({ threadId: "thread_project_1" });

    const projectSelect = (await screen.findByLabelText(
      "Project",
    )) as HTMLSelectElement;

    await waitFor(() => {
      expect(projectSelect.value).toBe("project_1");
    });
    expect(projectSelect.disabled).toBe(true);

    mocks.routeParams.current = { threadId: "thread_project_2" };
    rendered.rerender(
      <AppRouteTestHarness queryClient={rendered.queryClient} />,
    );

    await waitFor(() => {
      expect(projectSelect.value).toBe("project_2");
    });
    expect(projectSelect.disabled).toBe(true);
  });

  it("defaults the app sidebar to expanded without a stored preference", () => {
    const { container } = renderAppRoute();
    const workspace = getAppWorkspace(container);

    expect(
      window.localStorage.getItem(desktopPreferencesStorageKey),
    ).toBeNull();
    expect(
      workspace.style.getPropertyValue("--workspace-sidebar-header-offset"),
    ).toBe("var(--remora-titlebar-height)");
    expect(
      screen.getByRole("button", {
        name: "Hide sidebar",
      }),
    ).toBeTruthy();
  });

  it("renders and uses the shared navigation history controls", () => {
    mocks.canGoBack = true;
    mocks.historyIndex = 1;
    mocks.historyLength = 3;

    renderAppRoute();

    const backButton = screen.getByRole("button", { name: "Back" });
    const forwardButton = screen.getByRole("button", { name: "Forward" });

    expect(backButton.getAttribute("aria-keyshortcuts")).toBe("Meta+ArrowLeft");
    expect(forwardButton.getAttribute("aria-keyshortcuts")).toBe(
      "Meta+ArrowRight",
    );

    fireEvent.click(backButton);
    fireEvent.click(forwardButton);
    fireEvent.keyDown(document, { key: "ArrowLeft", metaKey: true });
    fireEvent.keyDown(document, { key: "ArrowRight", metaKey: true });

    expect(mocks.routerBack).toHaveBeenCalledTimes(2);
    expect(mocks.routerForward).toHaveBeenCalledTimes(2);
  });

  it("hydrates the app sidebar from a stored collapsed preference", async () => {
    await hydrateDesktopPreferencesStore({ sidebarOpen: false });

    renderAppRoute();

    expect(
      screen.getByRole("button", {
        name: "Show sidebar",
      }),
    ).toBeTruthy();
  });

  it("toggles the app sidebar collapse control", () => {
    const { container } = renderAppRoute();

    const collapseButton = screen.getByRole("button", {
      name: "Hide sidebar",
    });
    const workspace = getAppWorkspace(container);
    const titlebarControls = getAppTitlebarControls(container);

    expect(collapseButton.getAttribute("aria-keyshortcuts")).toBe("Meta+B");
    expect(getTooltipText("Hide sidebar")).toContain("Hide sidebar");
    expect(getTooltipText("Hide sidebar")).toContain("CmdB");
    expect(workspace.getAttribute("data-state")).toBe("expanded");
    expect(titlebarControls.className).toContain(
      "w-[calc(var(--sidebar-width)-5rem)]",
    );
    expect(titlebarControls.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:w-[10rem]",
    );
    expect(titlebarControls.className).toContain("transition-[width]");
    expect(titlebarControls.className).toContain("duration-300");
    expect(titlebarControls.className).toContain(
      "motion-reduce:transition-none",
    );

    const titlebarControlsSpacer = container.querySelector<HTMLElement>(
      '[data-slot="app-titlebar-controls-spacer"]',
    );

    expect(titlebarControlsSpacer).not.toBeNull();
    expect(titlebarControlsSpacer?.className).toContain("min-w-[2px]");
    expect(titlebarControlsSpacer?.className).toContain(
      "transition-[flex-grow]",
    );
    expect(titlebarControlsSpacer?.className).toContain("duration-300");
    expect(titlebarControlsSpacer?.className).toContain(
      "ease-[cubic-bezier(0.22,1,0.36,1)]",
    );
    expect(titlebarControlsSpacer?.className).toContain(
      "group-data-[state=collapsed]/sidebar-wrapper:grow-0",
    );
    expect(titlebarControlsSpacer?.className).toContain(
      "motion-reduce:transition-none",
    );

    fireEvent.click(collapseButton);

    expect(getStoredDesktopPreferences()?.state.sidebarOpen).toBe(false);
    expect(workspace.getAttribute("data-state")).toBe("collapsed");

    const expandButton = screen.getByRole("button", {
      name: "Show sidebar",
    });

    expect(getTooltipText("Show sidebar")).toContain("Show sidebar");
    expect(expandButton).toBeTruthy();

    fireEvent.click(expandButton);

    expect(getStoredDesktopPreferences()?.state.sidebarOpen).toBe(true);
    expect(
      screen.getByRole("button", {
        name: "Hide sidebar",
      }),
    ).toBeTruthy();
  });

  it("toggles the app sidebar with Command+B", () => {
    renderAppRoute();

    fireEvent.keyDown(document, { key: "b", metaKey: true });

    expect(getStoredDesktopPreferences()?.state.sidebarOpen).toBe(false);
    expect(
      screen.getByRole("button", {
        name: "Show sidebar",
      }),
    ).toBeTruthy();

    fireEvent.keyDown(document, { key: "b", metaKey: true });

    expect(getStoredDesktopPreferences()?.state.sidebarOpen).toBe(true);
    expect(
      screen.getByRole("button", {
        name: "Hide sidebar",
      }),
    ).toBeTruthy();
  });

  it("toggles the app sidebar with Command+B from the prompt input", () => {
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );

    fireEvent.keyDown(promptInput, { key: "b", metaKey: true });

    expect(
      screen.getByRole("button", {
        name: "Show sidebar",
      }),
    ).toBeTruthy();
  });

  it("submits into the selected thread", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute({ threadId: "thread_1" });

    await screen.findByRole("link", {
      name: /Soft studio treatment/,
    });
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          threadId: "thread_1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("submits into the selected project thread without project targeting", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
      threads: [
        createProjectThreadSummary({
          id: "thread_project_1",
          name: "Hero frames",
        }),
      ],
    });

    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [],
    }));
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ threadId: "thread_project_1" });

    const { submitButton } = await fillValidGenerationForm();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          threadId: "thread_project_1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("starts a new generation with Command+N from the prompt input", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute({ threadId: "thread_1" });

    await screen.findByRole("link", {
      name: /Soft studio treatment/,
    });
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );

    fireEvent.keyDown(promptInput, { key: "n", metaKey: true });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app", search: {} });
    });
  });

  it("starts a new generation from the sidebar", async () => {
    renderAppRoute({ threadId: "thread_1" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app", search: {} });
  });

  it("opens credits settings from the sidebar", async () => {
    renderAppRoute();

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("starts a new generation inside a project from the sidebar", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ threadId: "thread_1" });

    await screen.findByText("Launch concepts");

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation in Launch concepts",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app",
      search: { projectId: "project_1" },
    });
  });

  it("keeps project-targeted new generations bottom-docked with welcome content", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ search: { projectId: "project_1" } });

    await screen.findByText("Launch concepts");

    expectComposerDocked();
    expect(screen.getByAltText("Remora")).toBeTruthy();
  });

  it("submits fresh generations into the selected project", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ search: { projectId: "project_1" } });

    await screen.findByText("Launch concepts");
    const { submitButton } = await fillValidGenerationForm();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          projectId: "project_1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("reveals the created thread in the selected project sidebar section", async () => {
    let projectListProjects = [
      createProjectSummary({
        id: "project_1",
        name: "Launch concepts",
      }),
    ];

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [...projectListProjects],
    }));
    mocks.createVideo.mockImplementationOnce(async () => {
      projectListProjects = [
        createProjectSummary({
          id: "project_1",
          name: "Launch concepts",
          threads: [
            createProjectThreadSummary({
              id: "thread_created",
              name: "Fresh ocean pass",
            }),
          ],
        }),
      ];

      return {
        submissionId: "submission_1",
        threadId: "thread_created",
        jobs: [
          {
            jobId: "job_1",
            workflowId: "generation-job:job_1",
            status: "queued",
          },
        ],
      };
    });

    renderAppRoute({ search: { projectId: "project_1" } });

    await screen.findByText("Launch concepts");
    const { submitButton } = await fillValidGenerationForm();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: "Fresh ocean pass" }),
      ).toBeTruthy();
    });
  });

  it("clears project targeting from the project combobox no-project item", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute({ search: { projectId: "project_1" } });

    await screen.findByText("Launch concepts");

    const projectSelect = screen.getByLabelText("Project") as HTMLSelectElement;
    const noProjectOption = Array.from(projectSelect.options).at(-1);

    if (!noProjectOption) {
      throw new Error("Expected the project combobox to include options.");
    }

    expect(noProjectOption.textContent).toBe("Don't work in a project");

    fireEvent.change(projectSelect, {
      target: { value: noProjectOption.value },
    });

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app", search: {} });
  });

  it("clears project targeting when starting a global new generation", () => {
    renderAppRoute({ search: { projectId: "project_1" } });

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app", search: {} });
  });

  it("opens the create project dialog from the projects add button", () => {
    renderAppRoute();

    const createProjectTrigger = screen.getByRole("button", {
      name: "Create project",
    });

    expect(createProjectTrigger.getAttribute("aria-keyshortcuts")).toBe(
      "Meta+P",
    );
    expect(getTooltipText("Create project")).toContain("Create project");
    expect(getTooltipText("Create project")).toContain("CmdP");
    expect(screen.queryByRole("dialog", { name: "Create project" })).toBeNull();

    fireEvent.click(createProjectTrigger);

    expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy();
  });

  it("opens the rename project dialog for a sidebar project", async () => {
    const project = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });
    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [project],
    }));

    renderAppRoute();

    await screen.findByText(project.name);
    fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));

    const dialog = screen.getByRole("dialog", { name: "Rename project" });

    expect(
      (
        within(dialog).getByRole("textbox", {
          name: "Project name",
        }) as HTMLInputElement
      ).value,
    ).toBe(project.name);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Rename project" })).toBeNull();
  });

  it("opens the create project dialog with Command+P", () => {
    renderAppRoute();

    expect(screen.queryByRole("dialog", { name: "Create project" })).toBeNull();

    fireEvent.keyDown(document, { key: "p", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy();
  });

  it("opens the create project dialog with Command+P from the prompt input", () => {
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );

    expect(screen.queryByRole("dialog", { name: "Create project" })).toBeNull();

    fireEvent.keyDown(promptInput, { key: "p", metaKey: true });

    expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy();
  });

  it("restores welcome content without moving the composer when starting a new generation", () => {
    const rendered = renderAppRoute({ threadId: "thread_1" });

    expectComposerDocked();

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app", search: {} });

    mocks.routeParams.current = {};
    rendered.rerender(
      <AppRouteTestHarness queryClient={rendered.queryClient} />,
    );

    expectComposerDocked();
    expect(screen.getByAltText("Remora")).toBeTruthy();
  });

  it("hides welcome content without moving the composer when submitting a fresh generation", async () => {
    mocks.createVideo.mockReturnValue(new Promise(() => undefined));

    renderAppRoute();

    const { submitButton } = await fillValidGenerationForm();

    expectComposerDocked();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByAltText("Remora")).toBeNull();
    });
    expectComposerDocked();
    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the project selector in the measured composer layout while a fresh submit is docked", async () => {
    mocks.createVideo.mockReturnValue(new Promise(() => undefined));

    const { container } = renderAppRoute();
    const composerLayout = getComposerLayout(container);

    const { submitButton } = await fillValidGenerationForm();
    const projectSelect = screen.getByLabelText("Project") as HTMLSelectElement;

    expect(projectSelect.disabled).toBe(false);
    expect(composerLayout.contains(getProjectSelectorSurface(container))).toBe(
      true,
    );

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByAltText("Remora")).toBeNull();
    });
    expectComposerDocked();
    expect(screen.getByLabelText("Project")).toBeTruthy();
    expect(projectSelect.disabled).toBe(true);
    expect(composerLayout.contains(getProjectSelectorSurface(container))).toBe(
      true,
    );
  });

  it("renders a local pending overlay for fresh-thread submits without a fake thread query or early navigation", async () => {
    const createVideo = createDeferred<{
      submissionId: string;
      threadId: string;
      jobs: Array<{ jobId: string; workflowId: string; status: "queued" }>;
    }>();
    const prompt = "A glass studio above the ocean";

    mocks.createVideo.mockReturnValueOnce(createVideo.promise);
    renderAppRoute();

    const { submitButton } = await fillValidGenerationForm(prompt);

    fireEvent.click(submitButton);

    await expectSubmittedPromptRendered(prompt);
    expect(screen.getByRole("status", { name: "Generating" })).toBeTruthy();
    expect(mocks.threadSubmissionsQueryOptions).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalledWith({
      to: "/app/threads/$threadId",
      params: { threadId: expect.any(String) },
    });
  });

  it("keeps the composer docked while fresh-thread navigation is pending", async () => {
    const createVideo = createDeferred<{
      submissionId: string;
      threadId: string;
      jobs: Array<{ jobId: string; workflowId: string; status: "queued" }>;
    }>();
    const navigation = createDeferred<void>();

    mocks.createVideo.mockReturnValueOnce(createVideo.promise);
    mocks.navigate.mockReturnValueOnce(navigation.promise);
    renderAppRoute();

    const { submitButton } = await fillValidGenerationForm();

    fireEvent.click(submitButton);

    await expectSubmittedPromptRendered("A glass studio above the ocean");

    await act(async () => {
      createVideo.resolve({
        submissionId: "submission_created",
        threadId: "thread_created",
        jobs: [
          {
            jobId: "job_created",
            workflowId: "generation-job:job_created",
            status: "queued",
          },
        ],
      });
      await createVideo.promise;
    });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/threads/$threadId",
        params: { threadId: "thread_created" },
      });
    });
    expectComposerDocked();
    expect(screen.queryByAltText("Remora")).toBeNull();

    await act(async () => {
      navigation.resolve();
      await navigation.promise;
    });
  });

  it("navigates to the returned thread after creating a generation", async () => {
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/threads/$threadId",
        params: { threadId: "thread_created" },
      });
    });
  });

  it("requires a prompt and model, submits settings, and keeps the prompt", async () => {
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    expect((submitButton as HTMLButtonElement).disabled).toBe(true);

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-video",
          modelSpecId: "seedance-2.0-video-v1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
    await waitFor(() => {
      expect((promptInput as HTMLInputElement).value).toBe(
        "A glass studio above the ocean",
      );
    });
  });

  it("keeps reference images after a successful submission", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModelWithAttachmentMedia()],
    }));
    const { container } = renderAppRoute();
    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const referenceImage = new File(["image"], "reference.png", {
      type: "image/png",
    });

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    const attachmentFileInput = await waitFor(() =>
      getAttachmentFileInput(container),
    );

    fireEvent.change(attachmentFileInput, {
      target: { files: [referenceImage] },
    });

    await screen.findByRole("img", {
      name: "Attachment image: reference.png",
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledOnce();
    });
    expect(
      screen.getByRole("img", {
        name: "Attachment image: reference.png",
      }),
    ).not.toBeNull();
  });

  it("disables submit when the estimate exceeds the available credit balance", async () => {
    mocks.estimateGenerationCost.mockResolvedValue({
      estimatedCostUsdMicros: 25_000_001,
      currencyCode: "USD",
    });
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(true);
    });

    fireEvent.click(submitButton);

    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it.each([
    ["equal to", 25_000_000],
    ["below", 24_990_000],
  ])(
    "allows submit when the estimate is %s the available credit balance",
    async (_label, estimatedCostUsdMicros) => {
      mocks.estimateGenerationCost.mockResolvedValue({
        estimatedCostUsdMicros,
        currencyCode: "USD",
      });
      renderAppRoute();

      const { submitButton } = await fillValidGenerationForm();

      expect(submitButton.disabled).toBe(false);

      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mocks.createVideo).toHaveBeenCalledWith(
          expect.objectContaining({
            modelId: "seedance-2.0-video",
            prompt: "A glass studio above the ocean",
          }),
          expect.objectContaining({ client: expect.any(QueryClient) }),
        );
      });
    },
  );

  it("disables submit while the cost estimate is pending", async () => {
    const estimate = createDeferred<{
      currencyCode: string;
      estimatedCostUsdMicros: number;
    }>();

    mocks.estimateGenerationCost.mockReturnValue(estimate.promise);
    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    fireEvent.change(promptInput, {
      target: { value: "A glass studio above the ocean" },
    });

    await waitFor(() => {
      expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
        "seedance-2.0-video",
      );
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-video" },
    });

    await waitFor(() => {
      expect(mocks.estimateGenerationCost).toHaveBeenCalled();
      expect(submitButton.disabled).toBe(true);
    });

    fireEvent.click(submitButton);

    expect(mocks.createVideo).not.toHaveBeenCalled();

    estimate.resolve({
      estimatedCostUsdMicros: 831_600,
      currencyCode: "USD",
    });

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });
  });

  it("submits Seedance 2.0 Fast when selected from the catalog", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel(), createSeedanceFastModel()],
    }));

    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    fireEvent.change(promptInput, {
      target: { value: "A fast glass studio above the ocean" },
    });

    await screen.findByText("Seedance 2.0 Fast");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "seedance-2.0-fast-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "seedance-2.0-fast-video",
          modelSpecId: "seedance-2.0-fast-video-v1",
          prompt: "A fast glass studio above the ocean",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("initializes and submits image settings through the image mutation", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel(), createNanoBananaModel()],
    }));

    renderAppRoute();

    fireEvent.change(
      screen.getByPlaceholderText("A castle in the sky with..."),
      {
        target: { value: "A glass studio above the ocean" },
      },
    );

    await screen.findByText("Nano Banana 2");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "nano-banana-2" },
    });

    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    }) as HTMLButtonElement;

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
      expect(mocks.estimateGenerationCost).toHaveBeenCalledWith({
        modelType: "image",
        modelId: "nano-banana-2",
        modelSpecId: "nano-banana-2-v1",
        aspectRatio: "1:1",
        resolution: "1K",
        requestedGenerations: 1,
        attachmentMedia: {},
      });
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createImage).toHaveBeenCalledWith(
        {
          modelId: "nano-banana-2",
          modelSpecId: "nano-banana-2-v1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "1:1",
          resolution: "1K",
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
    expect(mocks.createVideo).not.toHaveBeenCalled();
  });

  it("applies a built video prompt to FLUX 3", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [
        createSeedanceModel(),
        createFluxModel(),
        createNanoBananaModel(),
      ],
    }));

    renderAppRoute();

    await screen.findByText("Nano Banana 2");
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "nano-banana-2" },
    });
    fireEvent.change(
      screen.getByPlaceholderText("A castle in the sky with..."),
      {
        target: { value: "A glass studio above the ocean" },
      },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open prompt builder" }),
    );

    const generationType = await screen.findByRole(
      "combobox",
      { name: "Generation type" },
      { timeout: 1_000 },
    );
    fireEvent.change(generationType, { target: { value: "video" } });
    fireEvent.click(
      screen.getByRole("button", { name: "Submit prompt builder" }),
    );

    await waitFor(
      () => {
        expect(
          (screen.getByLabelText("Model") as HTMLSelectElement).value,
        ).toBe("flux-3-video");
      },
      { timeout: 1_000 },
    );
    const submitButton = (await screen.findByRole(
      "button",
      { name: "Submit generation" },
      { timeout: 1_000 },
    )) as HTMLButtonElement;

    await waitFor(() => {
      expect(submitButton.disabled).toBe(false);
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          modelId: "flux-3-video",
          prompt: "A cinematic glass studio",
          duration: 10,
        }),
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("restores welcome content and preserves the prompt when a fresh submit fails", async () => {
    const prompt = "A glass studio above the ocean";
    const createVideo = createDeferred<{
      submissionId: string;
      threadId: string;
      jobs: Array<{ jobId: string; workflowId: string; status: "queued" }>;
    }>();
    mocks.createVideo.mockReturnValue(createVideo.promise);

    renderAppRoute();

    const { promptInput, submitButton } = await fillValidGenerationForm(prompt);

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.queryByAltText("Remora")).toBeNull();
    });
    expectComposerDocked();
    expect(screen.getAllByText(prompt).length).toBeGreaterThan(0);

    await act(async () => {
      createVideo.reject(new Error("generation unavailable"));

      try {
        await createVideo.promise;
      } catch {
        // The route owns rollback; the test only needs to flush the rejected create.
      }
    });

    await waitFor(() => {
      expect(screen.getByAltText("Remora")).toBeTruthy();
    });
    expectComposerDocked();
    expectSubmittedPromptNotRendered(prompt);
    expect(promptInput.value).toBe(prompt);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(mocks.toastError).toHaveBeenCalledWith("generation unavailable");
  });

  it("initializes Kling settings from numeric canonical duration values", async () => {
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel(), createKlingModel()],
    }));

    renderAppRoute();

    const promptInput = screen.getByPlaceholderText(
      "A castle in the sky with...",
    );
    const submitButton = screen.getByRole("button", {
      name: "Submit generation",
    });

    fireEvent.change(promptInput, {
      target: { value: "A lantern city at dusk" },
    });

    await screen.findByText("Kling 3.0 Text to Video");

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "kling-v3-text-to-video" },
    });

    await waitFor(() => {
      expect((submitButton as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mocks.createVideo).toHaveBeenCalledWith(
        {
          modelId: "kling-v3-text-to-video",
          modelSpecId: "kling-v3-text-to-video-v1",
          prompt: "A lantern city at dusk",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: false,
          draft: false,
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });
});

type RenderAppRouteLegacyOptions = { threadId?: string };

type RenderAppRouteRouteStateOptions = {
  params?: { threadId?: string };
  search?: { projectId?: string };
};

type RenderAppRouteOptions =
  | RenderAppRouteLegacyOptions
  | RenderAppRouteRouteStateOptions;

function renderAppRoute(options: RenderAppRouteOptions = {}) {
  const hasRouteOptions = isRenderAppRouteRouteStateOptions(options);
  const params = hasRouteOptions
    ? (options.params ?? {})
    : { threadId: options.threadId };
  const search = hasRouteOptions ? (options.search ?? {}) : {};

  mocks.routeParams.current = params;
  mocks.routeSearch.current = search;
  const queryClient = createRouteTestQueryClient();

  return {
    queryClient,
    ...render(<AppRouteTestHarness queryClient={queryClient} />),
  };
}

function isRenderAppRouteRouteStateOptions(
  options: RenderAppRouteOptions,
): options is RenderAppRouteRouteStateOptions {
  return "params" in options || "search" in options;
}

function AppRouteTestHarness({ queryClient }: { queryClient: QueryClient }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <AppRoute />
      </HotkeysProvider>
    </QueryClientProvider>
  );
}

function createRouteTestQueryClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return queryClient;
}

async function fillValidGenerationForm(
  prompt = "A glass studio above the ocean",
) {
  const promptInput = screen.getByPlaceholderText(
    "A castle in the sky with...",
  ) as HTMLInputElement;
  const submitButton = screen.getByRole("button", {
    name: "Submit generation",
  }) as HTMLButtonElement;

  fireEvent.change(promptInput, {
    target: { value: prompt },
  });

  await waitFor(() => {
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "seedance-2.0-video",
    );
  });

  fireEvent.change(screen.getByLabelText("Model"), {
    target: { value: "seedance-2.0-video" },
  });

  await waitFor(() => {
    expect(submitButton.disabled).toBe(false);
  });

  return { promptInput, submitButton };
}

function expectComposerDocked() {
  const stage = screen.getByTestId("generation-composer-stage");
  const composer = screen.getByTestId("generation-composer");

  expect(stage.hasAttribute("data-placement")).toBe(false);
  expect(composer.hasAttribute("data-placement")).toBe(false);
  expect(composer.className).toContain(
    "bottom-[var(--remora-generation-composer-bottom-inset)]",
  );
  expect(composer.className).not.toContain("transition-[top,translate]");
}

async function expectSubmittedPromptRendered(prompt: string) {
  await waitFor(() => {
    expect(screen.getAllByText(prompt).length).toBeGreaterThan(0);
  });
}

function expectSubmittedPromptNotRendered(prompt: string) {
  expect(
    screen
      .queryAllByText(prompt)
      .filter((element) => element.tagName !== "TEXTAREA"),
  ).toHaveLength(0);
}

function getTooltipText(text: string) {
  const tooltip = screen
    .getAllByRole("tooltip")
    .find((candidate) => candidate.textContent?.includes(text));

  if (!tooltip) {
    throw new Error(`Expected tooltip containing "${text}".`);
  }

  return tooltip.textContent ?? "";
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createProjectSummary(
  overrides: Partial<ProjectSummary> = {},
): ProjectSummary {
  return {
    id: "project_1",
    name: "Launch concepts",
    threads: [],
    archivedAt: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:00:00.000Z",
    ...overrides,
  };
}

function createProjectThreadSummary(
  overrides: Partial<ProjectSummary["threads"][number]> = {},
): ProjectSummary["threads"][number] {
  return {
    id: "thread_project_1",
    name: "Hero frames",
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
    ...overrides,
  };
}

function getStackPanel(container: HTMLElement) {
  const stackPanel = container.querySelector<HTMLElement>(
    '[data-slot="generation-stack-panel"]',
  );

  if (!stackPanel) {
    throw new Error("Expected generation stack panel to be rendered.");
  }

  return stackPanel;
}

function getAppWorkspace(container: HTMLElement) {
  const workspace = container.querySelector<HTMLElement>(
    ".remora-app-workspace",
  );

  if (!workspace) {
    throw new Error("Expected app workspace to be rendered.");
  }

  return workspace;
}

function getAppTitlebarControls(container: HTMLElement) {
  const controls = container.querySelector<HTMLElement>(
    '[data-slot="app-titlebar-controls"]',
  );

  if (!controls) {
    throw new Error("Expected app titlebar controls to be rendered.");
  }

  return controls;
}

function getComposerLayout(container: HTMLElement) {
  const composerLayout = container.querySelector<HTMLElement>(
    '[data-slot="generation-composer-layout"]',
  );

  if (!composerLayout) {
    throw new Error("Expected generation composer layout to be rendered.");
  }

  return composerLayout;
}

function getProjectSelectorSurface(container: HTMLElement) {
  const projectSelectorSurface = queryProjectSelectorSurface(container);

  if (!projectSelectorSurface) {
    throw new Error("Expected project selector surface to be rendered.");
  }

  return projectSelectorSurface;
}

function queryProjectSelectorSurface(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[data-slot="generation-project-selector"]',
  );
}

function getComposerDockOcclusion(container: HTMLElement) {
  const occlusion = queryComposerDockOcclusion(container);

  if (!occlusion) {
    throw new Error("Expected composer dock occlusion to be rendered.");
  }

  return occlusion;
}

function queryComposerDockOcclusion(container: HTMLElement) {
  return container.querySelector<HTMLElement>(
    '[data-slot="generation-composer-dock-occlusion"]',
  );
}

function getAttachmentFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    '[data-slot="file-picker-input"]',
  );

  if (!input) {
    throw new Error("Expected attachment file input to be rendered.");
  }

  return input;
}

function getRemoraLogo(container: HTMLElement) {
  const logo = container.querySelector<HTMLImageElement>(
    `img[src="${getPublicAssetUrl("logo.svg")}"]`,
  );

  if (!logo) {
    throw new Error("Expected Remora logo to be rendered.");
  }

  return logo;
}

function getGenerationResults(container: HTMLElement) {
  const results = container.querySelector<HTMLElement>(
    '[data-slot="generation-results"]',
  );

  if (!results) {
    throw new Error("Expected generation results to be rendered.");
  }

  return results;
}

function getGenerationResultsLayout(container: HTMLElement) {
  const resultsLayout = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-layout"]',
  );

  if (!resultsLayout) {
    throw new Error("Expected generation results layout to be rendered.");
  }

  return resultsLayout;
}

function getGenerationResultsList(container: HTMLElement) {
  const resultsList = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-list"]',
  );

  if (!resultsList) {
    throw new Error("Expected generation results list to be rendered.");
  }

  return resultsList;
}

function getPlaybackBackdrop() {
  const backdrop = document.body.querySelector<HTMLElement>(
    '[data-slot="generation-video-playback-backdrop"]',
  );

  if (!backdrop) {
    throw new Error("Expected playback backdrop to be rendered.");
  }

  return backdrop;
}

function mockElementRect(
  element: HTMLElement,
  rect: {
    height: number;
    left: number;
    top: number;
    width: number;
  },
) {
  element.getBoundingClientRect = vi.fn(
    () =>
      ({
        bottom: rect.top + rect.height,
        height: rect.height,
        left: rect.left,
        right: rect.left + rect.width,
        top: rect.top,
        width: rect.width,
        x: rect.left,
        y: rect.top,
        toJSON: () => rect,
      }) as DOMRect,
  );
}

function getPlaybackSurface() {
  const surface = document.body.querySelector<HTMLElement>(
    '[data-slot="generation-video-playback-surface"]',
  );

  if (!surface) {
    throw new Error("Expected playback surface to be rendered.");
  }

  return surface;
}

function resetDesktopPreferencesStore() {
  useDesktopPreferencesStore.setState({
    hasSeenWizardEntrance: true,
    sidebarOpen: true,
  });
  window.localStorage.removeItem(desktopPreferencesStorageKey);
}

async function hydrateDesktopPreferencesStore(state: { sidebarOpen: boolean }) {
  window.localStorage.setItem(
    desktopPreferencesStorageKey,
    JSON.stringify({ state, version: 1 }),
  );

  await useDesktopPreferencesStore.persist.rehydrate();
}

function getStoredDesktopPreferences() {
  const item = window.localStorage.getItem(desktopPreferencesStorageKey);

  if (!item) {
    return null;
  }

  return JSON.parse(item) as {
    state: {
      sidebarOpen?: boolean;
    };
    version?: number;
  };
}

function createThreadSummary(
  overrides: Partial<GenerationThreadSummary> = {},
): GenerationThreadSummary {
  return {
    id: "thread_1",
    name: "Soft studio treatment",
    createdAt: "2026-06-08T12:00:00.000Z",
    updatedAt: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

function createThreadSubmission(
  overrides: Partial<
    Omit<VideoGenerationThreadSubmission, "jobs" | "submittedInput">
  > & {
    jobs?: VideoGenerationThreadSubmission["jobs"];
    submittedInput?: Partial<VideoGenerationThreadSubmission["submittedInput"]>;
  } = {},
): VideoGenerationThreadSubmission {
  const { jobs, submittedInput, requestedGenerations, ...submissionOverrides } =
    overrides;
  const id = submissionOverrides.id ?? "submission_1";
  const createdJobs = jobs ?? [
    createThreadSubmissionJob({
      submissionId: id,
    }),
  ];

  return {
    id,
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName: "Seedance 2.0",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      ...submittedInput,
      draft: submittedInput?.draft ?? false,
    },
    requestedGenerations: requestedGenerations ?? createdJobs.length,
    attachmentMedia: {
      images: [],
      videos: [],
      audios: [],
    },
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: createdJobs,
    ...submissionOverrides,
  };
}

function createThreadSubmissionJob(
  overrides: Partial<GenerationThreadSubmission["jobs"][number]> = {},
): GenerationThreadSubmission["jobs"][number] {
  return {
    id: "job_1",
    submissionId: "submission_1",
    submissionIndex: 0,
    status: "succeeded",
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    terminalError: null,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    result: createThreadSubmissionResult(),
    ...overrides,
  };
}

function createThreadSubmissionResult(
  overrides: Partial<
    NonNullable<GenerationThreadSubmission["jobs"][number]["result"]>
  > = {},
): NonNullable<GenerationThreadSubmission["jobs"][number]["result"]> {
  return {
    providerId: "byteplus",
    providerTaskId: "cgt-123",
    providerModelId: "dreamina-seedance-2-0-260128",
    providerStatus: "succeeded",
    videoUrl: "https://assets.example/video.mp4",
    previewImageUrl: null,
    mediaUrlExpiresAt: null,
    providerError: null,
    receivedAt: "2026-06-05T00:01:00.000Z",
    createdAt: "2026-06-05T00:01:01.000Z",
    updatedAt: "2026-06-05T00:01:02.000Z",
    ...overrides,
  };
}

function createSeedanceModel(): PublishedGenerationModelSummary {
  const fields = [
    createField({
      id: "resolution",
      label: "Resolution",
      valueKind: "string",
      defaultValue: "720p",
      options: [
        { label: "480p", value: "480p" },
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
        { label: "4k", value: "4k" },
      ],
    }),
    createField({
      id: "aspectRatio",
      label: "Aspect ratio",
      valueKind: "string",
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
      ],
    }),
    createField({
      id: "duration",
      label: "Duration",
      valueKind: "integer",
      defaultValue: 5,
      options: [
        { label: "5s", value: 5 },
        { label: "10s", value: 10 },
      ],
    }),
    createField({
      id: "generateAudio",
      label: "Generate audio",
      valueKind: "boolean",
      defaultValue: true,
      options: [
        { label: "On", value: true },
        { label: "Off", value: false },
      ],
    }),
  ] as [GenerationFieldSpec, ...GenerationFieldSpec[]];

  return {
    id: "seedance-2.0-video",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Seedance 2.0",
    type: "video",
    latestSpecId: "seedance-2.0-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "seedance-2.0-video",
      provider: "byteplus",
      providerModelId: "dreamina-seedance-2-0-260128",
      displayName: "Seedance 2.0",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/contents/generations/tasks",
      },
      modelParameter: {
        path: ["model"],
        source: "spec",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["resolution", "aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules: ["seedance20ContentRules"],
    },
  };
}

function createFluxModel(): PublishedGenerationModelSummary {
  const fields = [
    createField({
      id: "resolution",
      label: "Resolution",
      valueKind: "string",
      defaultValue: "hd",
      options: [
        { label: "HD", value: "hd" },
        { label: "Full HD", value: "fhd" },
      ],
    }),
    createField({
      id: "aspectRatio",
      label: "Aspect ratio",
      valueKind: "string",
      defaultValue: "auto",
      options: [
        { label: "Auto", value: "auto" },
        { label: "16:9", value: "16:9" },
      ],
    }),
    createField({
      id: "duration",
      label: "Duration",
      valueKind: "integer",
      defaultValue: 5,
      options: [
        { label: "5s", value: 5 },
        { label: "10s", value: 10 },
        { label: "20s", value: 20 },
      ],
    }),
    createField({
      id: "generateAudio",
      label: "Generate audio",
      valueKind: "boolean",
      defaultValue: true,
      options: [
        { label: "On", value: true },
        { label: "Off", value: false },
      ],
    }),
  ] as [GenerationFieldSpec, ...GenerationFieldSpec[]];

  return {
    id: "flux-3-video",
    providerId: "bfl",
    providerName: "Black Forest Labs",
    displayName: "FLUX 3 Video (Preview)",
    type: "video",
    latestSpecId: "flux-3-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "flux-3-video",
      provider: "bfl",
      providerModelId: "latest",
      displayName: "FLUX 3 Video (Preview)",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/v1/flux-3-video",
      },
      modelParameter: {
        path: ["version"],
        source: "spec",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["resolution", "aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createSeedanceModelWithAttachmentMedia(): PublishedGenerationModelSummary {
  const model = createSeedanceModel();

  return {
    ...model,
    spec: {
      ...model.spec,
      fields: [
        ...model.spec.fields,
        createField({
          id: "images",
          label: "Images",
          componentKind: "mediaList",
          valueKind: "array",
          defaultValue: [],
          arrayMax: 3,
          mediaRoleCapabilities: ["firstFrame", "lastFrame", "reference"],
          mediaConstraints: {
            mimeTypes: ["image/png"],
            extensions: [".png"],
            maxFileSizeBytes: 10,
          },
        }),
        createField({
          id: "videos",
          label: "Videos",
          componentKind: "mediaList",
          valueKind: "array",
          defaultValue: [],
          arrayMax: 3,
          mediaRoleCapabilities: ["reference"],
          mediaConstraints: {
            mimeTypes: ["video/mp4"],
            extensions: [".mp4"],
            maxFileSizeBytes: 10,
          },
        }),
        createField({
          id: "audios",
          label: "Audios",
          componentKind: "mediaList",
          valueKind: "array",
          defaultValue: [],
          arrayMax: 3,
          mediaRoleCapabilities: ["reference"],
          mediaConstraints: {
            mimeTypes: ["audio/mpeg"],
            extensions: [".mp3"],
            maxFileSizeBytes: 10,
          },
        }),
      ],
    },
  };
}

function createNanoBananaModel(): PublishedGenerationModelSummary {
  return {
    id: "nano-banana-2",
    providerId: "google",
    providerName: "Google",
    displayName: "Nano Banana 2",
    type: "image",
    latestSpecId: "nano-banana-2-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "nano-banana-2-v1",
      provider: "google",
      providerModelId: "gemini-3.1-flash-image",
      displayName: "Nano Banana 2",
      type: "image",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/v1/interactions",
      },
      modelParameter: {
        path: ["model"],
        source: "spec",
      },
      fields: [
        createField({
          id: "resolution",
          label: "Resolution",
          valueKind: "string",
          defaultValue: "1K",
          options: [
            { label: "512", value: "512" },
            { label: "1K", value: "1K" },
            { label: "2K", value: "2K" },
            { label: "4K", value: "4K" },
          ],
        }),
        createField({
          id: "aspectRatio",
          label: "Aspect ratio",
          valueKind: "string",
          defaultValue: "1:1",
          options: [
            { label: "1:1", value: "1:1" },
            { label: "16:9", value: "16:9" },
          ],
        }),
      ],
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["resolution", "aspectRatio"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createSeedanceFastModel(): PublishedGenerationModelSummary {
  const model = createSeedanceModel();

  return {
    ...model,
    id: "seedance-2.0-fast-video",
    displayName: "Seedance 2.0 Fast",
    latestSpecId: "seedance-2.0-fast-video-v1",
    spec: {
      ...model.spec,
      id: "seedance-2.0-fast-video",
      providerModelId: "dreamina-seedance-2-0-fast-260128",
      displayName: "Seedance 2.0 Fast",
    },
  };
}

function createKlingModel(): PublishedGenerationModelSummary {
  const fields = [
    createField({
      id: "resolution",
      label: "Resolution",
      valueKind: "string",
      defaultValue: "720p",
      options: [
        { label: "720p", value: "720p" },
        { label: "1080p", value: "1080p" },
      ],
    }),
    createField({
      id: "aspectRatio",
      label: "Aspect ratio",
      valueKind: "string",
      defaultValue: "16:9",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "9:16", value: "9:16" },
        { label: "1:1", value: "1:1" },
      ],
    }),
    createField({
      id: "duration",
      label: "Duration",
      valueKind: "integer",
      defaultValue: 5,
      providerPath: ["duration"],
      providerValueMap: [
        { canonicalValue: 5, providerValue: "5" },
        { canonicalValue: 10, providerValue: "10" },
      ],
      options: [
        { label: "5s", value: 5 },
        { label: "10s", value: 10 },
      ],
    }),
    createField({
      id: "generateAudio",
      label: "Sound",
      valueKind: "boolean",
      defaultValue: false,
      providerPath: ["sound"],
      providerValueMap: [
        { canonicalValue: true, providerValue: "on" },
        { canonicalValue: false, providerValue: "off" },
      ],
      options: [
        { label: "On", value: true },
        { label: "Off", value: false },
      ],
    }),
  ] as [GenerationFieldSpec, ...GenerationFieldSpec[]];

  return {
    id: "kling-v3-text-to-video",
    providerId: "kling",
    providerName: "Kling",
    displayName: "Kling 3.0 Text to Video",
    type: "video",
    latestSpecId: "kling-v3-text-to-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "kling-v3-text-to-video",
      provider: "kling",
      providerModelId: null,
      displayName: "Kling 3.0 Text to Video",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/v1/videos/text2video",
      },
      modelParameter: {
        path: ["model_name"],
        source: "runtime",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["resolution", "aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: ["klingTextToVideoRules"],
    },
  };
}

function createField(
  overrides: Partial<GenerationFieldSpec>,
): GenerationFieldSpec {
  return {
    id: "aspectRatio",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}

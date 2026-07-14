/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

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

import {
  generationVideoPreviewFallbackImageUrl,
  multiGenerationPanelClosedTransform,
  multiGenerationPanelOpenTransform,
} from "../lib/generation/index.ts";
import { getPublicAssetUrl } from "../lib/public-asset.ts";
import { AppRoute } from "./app-route.tsx";

import { HotkeysProvider } from "../providers/hotkeys-provider.tsx";
import {
  desktopPreferencesStorageKey,
  useDesktopPreferencesStore,
} from "../stores/preferences-store.ts";

import type {
  GenerationThreadSubmission,
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
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
  attachmentMediaQueryOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  mutationOptions: vi.fn(),
  createProject: vi.fn(),
  createVideo: vi.fn(),
  attachmentMediaUpload: vi.fn(),
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
  useCanGoBack: () => false,
  useLocation: ({
    select,
  }: {
    select?: (location: { state: { __TSR_index: number } }) => unknown;
  } = {}) => {
    const location = { state: { __TSR_index: 0 } };

    return select ? select(location) : location;
  },
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
  useRouter: () => ({
    history: {
      back: mocks.routerBack,
      forward: mocks.routerForward,
      length: 1,
    },
  }),
  useSearch: () => mocks.routeSearch.current,
}));

vi.mock("../providers/auth-provider.tsx", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("../lib/trpc.ts", () => ({
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
        mutationOptions: mocks.mutationOptions,
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
    DropdownMenuItem: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"button">) =>
      React.createElement(
        "button",
        { role: "menuitem", type: "button", ...props },
        children,
      ),
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
      items: MockComboboxItem[];
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
                items.find(
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
          items.map((item) =>
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
    Select: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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
    mocks.attachmentMediaQueryOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.mutationOptions.mockReset();
    mocks.createProject.mockReset();
    mocks.createVideo.mockReset();
    mocks.attachmentMediaUpload.mockReset();
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
    mocks.mutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createVideo,
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

  it("does not fetch thread submissions on the fresh generation route", () => {
    const { container } = renderAppRoute();

    expect(mocks.threadSubmissionsQueryOptions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("generation-thread-job")).toBeNull();
    expect(queryComposerDockOcclusion(container)).toBeNull();
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

    await screen.findByText("Seedance 2.0");

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

    await screen.findByText("Seedance 2.0");

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

    await screen.findByText("Seedance 2.0");

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

    expect(mocks.threadSubmissionsQueryOptions).toHaveBeenCalledWith({
      threadId: "thread_1",
    });
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
    const logo = getRemoraLogo(container);
    const composer = screen.getByTestId("generation-composer");
    const composerLayout = getComposerLayout(container);
    const composerDockOcclusion = getComposerDockOcclusion(container);
    const results = getGenerationResults(container);
    const resultsLayout = getGenerationResultsLayout(container);
    const resultsList = getGenerationResultsList(container);
    const resultsBottomSpacer = getGenerationResultsBottomSpacer(container);
    const stackPanel = getStackPanel(container);

    expect(stage.className).toContain("remora-generation-composer-stage");
    expect(stage.getAttribute("style")).toBeNull();
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
    expect(logo.className).toContain("z-[1]");
    expect(logo.className).toContain(
      "data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset)_-_var(--remora-generation-composer-block-height)_+_1rem)]",
    );
    expect(composer.contains(composerLayout)).toBe(true);
    expect(composerLayout.contains(composerDockOcclusion)).toBe(true);
    expect(results.contains(stackPanel)).toBe(true);
    expect(composer.contains(stackPanel)).toBe(false);
    expect(composer.className).toContain("z-[3]");
    expect(composer.className).toContain(
      "w-[var(--remora-generation-content-width)]",
    );
    expect(results.className).toContain("absolute");
    expect(results.className).toContain("inset-0");
    expect(results.className).toContain("z-[2]");
    expect(results.className).toContain("min-h-[inherit]");
    expect(results.className).toContain("overflow-x-hidden");
    expect(results.className).toContain("overflow-y-auto");
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
    expect(resultsList.contains(resultsBottomSpacer)).toBe(true);
    expect(resultsList.className).not.toContain("overflow-y-auto");
    expect(resultsBottomSpacer.className).toContain(
      "h-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(composerDockOcclusion.className).toContain("pointer-events-none");
    expect(composerDockOcclusion.className).toContain("absolute");
    expect(composerDockOcclusion.className).toContain("z-0");
    expect(composerDockOcclusion.className).toContain(
      "h-[var(--remora-generation-results-bottom-reserve)]",
    );
    expect(composerDockOcclusion.className).toContain(
      "bg-[var(--remora-stage-background)]",
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
    expect(composer.className).toContain(
      "data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset))]",
    );
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

  it("starts fresh generations centered with the logo visible", () => {
    renderAppRoute();

    expectComposerPlacement("centered");
    expect(screen.getByAltText("Remora")).toBeTruthy();
  });

  it("starts thread routes docked with the logo outside the accessible flow", () => {
    renderAppRoute({ threadId: "thread_1" });

    expectComposerPlacement("docked");
    expect(screen.queryByAltText("Remora")).toBeNull();
  });

  it("navigates to thread routes from the sidebar", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generationThread", "listWithoutProject"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute();

    const threadButton = await screen.findByRole("button", {
      name: /Soft studio treatment/,
    });

    fireEvent.click(threadButton);

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

    const threadButton = await screen.findByRole("button", {
      name: /Soft studio treatment/,
    });

    expect(threadButton.getAttribute("aria-pressed")).toBe("true");
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
    renderAppRoute();

    expect(
      window.localStorage.getItem(desktopPreferencesStorageKey),
    ).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Hide sidebar",
      }),
    ).toBeTruthy();
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

    await screen.findByRole("button", {
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

    await screen.findByText("Seedance 2.0");

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

    await screen.findByRole("button", {
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

  it("keeps project-targeted new generations on the centered composer", async () => {
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

    expectComposerPlacement("centered");
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

  it("opens the create project dialog from the projects add button", async () => {
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

    const dialog = screen.getByRole("dialog", { name: "Create project" });

    const projectNameInput = within(dialog).getByRole("textbox", {
      name: "Project name",
    });
    const createProjectButton = within(dialog).getByRole("button", {
      name: "Create project",
    }) as HTMLButtonElement;

    expect(projectNameInput).toBeTruthy();
    expect(createProjectButton.disabled).toBe(true);

    fireEvent.change(projectNameInput, {
      target: { value: "Launch concepts" },
    });

    await waitFor(() => {
      expect(createProjectButton.disabled).toBe(false);
    });

    fireEvent.change(projectNameInput, {
      target: { value: "   " },
    });

    expect(
      within(dialog).getByRole("button", {
        name: "Create project",
      }) as HTMLButtonElement,
    ).toHaveProperty("disabled", true);
  });

  it("creates a project from the dialog", async () => {
    const createdProject = createProjectSummary({
      id: "project_1",
      name: "Launch concepts",
    });
    const createProject = createDeferred<ProjectSummary>();
    let projectListProjects: ProjectSummary[] = [];

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [...projectListProjects],
    }));
    mocks.createProject.mockReturnValueOnce(createProject.promise);

    const rendered = renderAppRoute();
    const invalidateQueries = vi.spyOn(
      rendered.queryClient,
      "invalidateQueries",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create project",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Create project" });
    const projectNameInput = within(dialog).getByRole("textbox", {
      name: "Project name",
    });

    fireEvent.change(projectNameInput, {
      target: { value: "  Launch concepts  " },
    });

    await waitFor(() => {
      expect(
        (
          within(dialog).getByRole("button", {
            name: "Create project",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });

    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Create project",
      }),
    );

    await waitFor(() => {
      expect(mocks.createProject).toHaveBeenCalledWith(
        { name: "Launch concepts" },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Create project" }),
      ).toBeNull();
      expect(screen.getByText("Launch concepts")).toBeTruthy();
    });

    const optimisticProjects = rendered.queryClient.getQueryData<
      ProjectSummary[]
    >(["project", "listProjects"]);

    expect(optimisticProjects?.[0]?.id).toContain("optimistic-project:");

    projectListProjects = [createdProject];

    await act(async () => {
      createProject.resolve(createdProject);
      await createProject.promise;
    });

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["project", "listProjects"],
      });
      expect(
        rendered.queryClient.getQueryData<ProjectSummary[]>([
          "project",
          "listProjects",
        ]),
      ).toEqual([createdProject]);
    });
  });

  it("rolls back the optimistic project and reopens the dialog when creation fails", async () => {
    const existingProject = createProjectSummary({
      id: "project_existing",
      name: "Existing project",
    });
    const createProject = createDeferred<ProjectSummary>();
    const projectListProjects = [existingProject];

    mocks.projectListQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["project", "listProjects"],
      queryFn: async () => [...projectListProjects],
    }));
    mocks.createProject.mockReturnValueOnce(createProject.promise);

    const rendered = renderAppRoute();

    await screen.findByText("Existing project");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create project",
      }),
    );

    const dialog = screen.getByRole("dialog", { name: "Create project" });

    fireEvent.change(
      within(dialog).getByRole("textbox", {
        name: "Project name",
      }),
      {
        target: { value: "Launch concepts" },
      },
    );
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Create project",
      }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Create project" }),
      ).toBeNull();
      expect(screen.getByText("Launch concepts")).toBeTruthy();
      expect(
        rendered.queryClient.getQueryData<ProjectSummary[]>([
          "project",
          "listProjects",
        ]),
      ).toHaveLength(2);
    });

    await act(async () => {
      createProject.reject(
        new Error('A project named "Launch concepts" already exists.'),
      );

      try {
        await createProject.promise;
      } catch {
        // The mutation handles the failure; the test only needs to flush it.
      }
    });

    const reopenedDialog = await screen.findByRole("dialog", {
      name: "Create project",
    });
    const reopenedProjectNameInput = within(reopenedDialog).getByRole(
      "textbox",
      {
        name: "Project name",
      },
    ) as HTMLInputElement;

    expect(
      await within(reopenedDialog).findByText(
        'A project named "Launch concepts" already exists.',
      ),
    ).toBeTruthy();
    expect(reopenedProjectNameInput.value).toBe("Launch concepts");
    expect(screen.getByText("Existing project")).toBeTruthy();
    expect(screen.queryByText("Launch concepts")).toBeNull();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(
      rendered.queryClient.getQueryData<ProjectSummary[]>([
        "project",
        "listProjects",
      ]),
    ).toEqual([existingProject]);
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

  it("returns to centered placement when starting a new generation", () => {
    const rendered = renderAppRoute({ threadId: "thread_1" });

    expectComposerPlacement("docked");

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

    expectComposerPlacement("centered");
    expect(screen.getByAltText("Remora")).toBeTruthy();
  });

  it("docks the composer immediately when submitting a fresh generation", async () => {
    mocks.createVideo.mockReturnValue(new Promise(() => undefined));

    renderAppRoute();

    const { submitButton } = await fillValidGenerationForm();

    expectComposerPlacement("centered");

    fireEvent.click(submitButton);

    await waitFor(() => {
      expectComposerPlacement("docked");
    });
    expect(screen.queryByAltText("Remora")).toBeNull();
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
      expectComposerPlacement("docked");
    });
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
    expectComposerPlacement("docked");
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

    await screen.findByText("Seedance 2.0");

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

  it("requires a prompt and model, submits settings, and clears the prompt", async () => {
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

    await screen.findByText("Seedance 2.0");

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
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
    await waitFor(() => {
      expect((promptInput as HTMLInputElement).value).toBe("");
    });
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

    await screen.findByText("Seedance 2.0");

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

    await screen.findByText("Seedance 2.0");

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
          requestedGenerations: 1,
          attachmentMedia: {},
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("recenters and preserves the prompt when a fresh submit fails", async () => {
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
      expectComposerPlacement("docked");
    });
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
      expectComposerPlacement("centered");
    });
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

  await screen.findByText("Seedance 2.0");

  fireEvent.change(screen.getByLabelText("Model"), {
    target: { value: "seedance-2.0-video" },
  });

  await waitFor(() => {
    expect(submitButton.disabled).toBe(false);
  });

  return { promptInput, submitButton };
}

function expectComposerPlacement(placement: "centered" | "docked") {
  expect(
    screen
      .getByTestId("generation-composer-stage")
      .getAttribute("data-placement"),
  ).toBe(placement);
  expect(
    screen.getByTestId("generation-composer").getAttribute("data-placement"),
  ).toBe(placement);
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

function getGenerationResultsBottomSpacer(container: HTMLElement) {
  const spacer = container.querySelector<HTMLElement>(
    '[data-slot="generation-results-bottom-spacer"]',
  );

  if (!spacer) {
    throw new Error(
      "Expected generation results bottom spacer to be rendered.",
    );
  }

  return spacer;
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
  useDesktopPreferencesStore.setState({ sidebarOpen: true });
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
    Omit<GenerationThreadSubmission, "jobs" | "submittedInput">
  > & {
    jobs?: GenerationThreadSubmission["jobs"];
    submittedInput?: Partial<GenerationThreadSubmission["submittedInput"]>;
  } = {},
): GenerationThreadSubmission {
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
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      ...submittedInput,
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
  ] as [VideoFieldSpec, ...VideoFieldSpec[]];

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
  ] as [VideoFieldSpec, ...VideoFieldSpec[]];

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

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
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
  } as VideoFieldSpec;
}

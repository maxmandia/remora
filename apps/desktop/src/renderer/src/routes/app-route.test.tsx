/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url":"http://localhost"}
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generationVideoPreviewFallbackImageUrl } from "../lib/generation/index.ts";
import { AppRoute } from "./app-route.tsx";

import { HotkeysProvider } from "../providers/hotkeys-provider.tsx";
import {
  desktopPreferencesStorageKey,
  useDesktopPreferencesStore,
} from "../stores/preferences-store.ts";

import type {
  GenerationThreadSubmission,
  GenerationThreadSummary,
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  routeParams: {
    current: {} as { threadId?: string },
  },
  modelQueryOptions: vi.fn(),
  threadSubmissionsQueryOptions: vi.fn(),
  threadQueryOptions: vi.fn(),
  mutationOptions: vi.fn(),
  createVideo: vi.fn(),
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
  useNavigate: () => mocks.navigate,
  useParams: () => mocks.routeParams.current,
}));

vi.mock("../providers/auth-provider.tsx", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("../lib/trpc.ts", () => ({
  useTRPC: () => ({
    generation: {
      listThreads: {
        queryOptions: mocks.threadQueryOptions,
      },
      listSubmissionsFromThread: {
        queryOptions: mocks.threadSubmissionsQueryOptions,
      },
      createVideo: {
        mutationOptions: mocks.mutationOptions,
      },
    },
    model: {
      listPublished: {
        queryOptions: mocks.modelQueryOptions,
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
    cn: (...inputs: unknown[]) => inputs.filter(Boolean).join(" "),
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
    SidebarMenuButton: ({
      children,
      isActive: _isActive,
      ...props
    }: React.ComponentProps<"button"> & { isActive?: boolean }) =>
      React.createElement("button", props, children),
    SidebarMenuItem: ({ children, ...props }: React.ComponentProps<"li">) =>
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
      items: PublishedGenerationModelSummary[];
      itemToStringLabel: (item: PublishedGenerationModelSummary) => string;
      itemToStringValue: (item: PublishedGenerationModelSummary) => string;
      onInputValueChange: (value: string) => void;
      onValueChange: (value: PublishedGenerationModelSummary | null) => void;
      value: PublishedGenerationModelSummary | null;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "select",
          {
            "aria-label": "Model",
            value: value ? itemToStringValue(value) : "",
            onChange: (event: React.ChangeEvent<HTMLSelectElement>) => {
              const nextModel =
                items.find(
                  (item) => itemToStringValue(item) === event.target.value,
                ) ?? null;

              onValueChange(nextModel);
              onInputValueChange(nextModel ? itemToStringLabel(nextModel) : "");
            },
          },
          React.createElement("option", { value: "" }, "Select a model"),
          items.map((item) =>
            React.createElement(
              "option",
              { key: item.id, value: itemToStringValue(item) },
              itemToStringLabel(item),
            ),
          ),
        ),
        children,
      ),
    ComboboxInput: (props: Record<string, unknown>) =>
      React.createElement("input", {
        "aria-hidden": true,
        style: props.style as React.CSSProperties,
      }),
    ComboboxContent: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    ComboboxList: () => null,
    ComboboxItem: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
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
    mocks.modelQueryOptions.mockReset();
    mocks.threadSubmissionsQueryOptions.mockReset();
    mocks.threadQueryOptions.mockReset();
    mocks.mutationOptions.mockReset();
    mocks.createVideo.mockReset();
    mocks.routeParams.current = {};
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
    mocks.modelQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["model", "listPublished"],
      queryFn: async () => [createSeedanceModel()],
    }));
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generation", "listThreads"],
      queryFn: async () => [],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation((input, options) => ({
      ...options,
      queryKey: ["generation", "listSubmissionsFromThread", input],
      queryFn: async () => [],
    }));
    mocks.mutationOptions.mockImplementation((options) => ({
      ...options,
      mutationFn: mocks.createVideo,
    }));
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
    renderAppRoute();

    expect(mocks.threadSubmissionsQueryOptions).not.toHaveBeenCalled();
    expect(screen.queryByTestId("generation-thread-job")).toBeNull();
  });

  it("fetches and renders generation outputs for selected threads", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generation", "listThreads"],
      queryFn: async () => [createThreadSummary()],
    }));
    mocks.threadSubmissionsQueryOptions.mockImplementation((input, options) => ({
      ...options,
      queryKey: ["generation", "listSubmissionsFromThread", input],
      queryFn: async () => [createThreadSubmission()],
    }));

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
      queryKey: ["generation", "listThreads"],
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
      queryKey: ["generation", "listThreads"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute({ threadId: "thread_1" });

    const threadButton = await screen.findByRole("button", {
      name: /Soft studio treatment/,
    });

    expect(threadButton.getAttribute("aria-pressed")).toBe("true");
  });

  it("replaces unknown thread routes with the new-generation route", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generation", "listThreads"],
      queryFn: async () => [createThreadSummary()],
    }));

    renderAppRoute({ threadId: "thread_missing" });

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app",
        replace: true,
      });
    });
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
    renderAppRoute();

    const collapseButton = screen.getByRole("button", {
      name: "Hide sidebar",
    });

    expect(collapseButton.getAttribute("aria-keyshortcuts")).toBe("Meta+B");
    expect(getTooltipText("Hide sidebar")).toContain("Hide sidebar");
    expect(getTooltipText("Hide sidebar")).toContain("CmdB");

    fireEvent.click(collapseButton);

    expect(getStoredDesktopPreferences()?.state.sidebarOpen).toBe(false);

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
      queryKey: ["generation", "listThreads"],
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
          threadId: "thread_1",
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("starts a new generation with Command+N from the prompt input", async () => {
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: ["generation", "listThreads"],
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
      expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app" });
    });
  });

  it("starts a new generation from the sidebar", async () => {
    renderAppRoute({ threadId: "thread_1" });

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app" });
  });

  it("returns to centered placement when starting a new generation", () => {
    const rendered = renderAppRoute({ threadId: "thread_1" });

    expectComposerPlacement("docked");

    fireEvent.click(
      screen.getByRole("button", {
        name: "New generation",
      }),
    );

    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/app" });

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

  it("invalidates thread and job queries after creating a generation", async () => {
    const rendered = renderAppRoute();
    const invalidateQueries = vi.spyOn(rendered.queryClient, "invalidateQueries");
    const { submitButton } = await fillValidGenerationForm();

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["generation", "listThreads"],
      });
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: [
          "generation",
          "listSubmissionsFromThread",
          { threadId: "thread_created" },
        ],
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
          prompt: "A glass studio above the ocean",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
    await waitFor(() => {
      expect((promptInput as HTMLInputElement).value).toBe("");
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
          prompt: "A fast glass studio above the ocean",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });

  it("recenters and preserves the prompt when a fresh submit fails", async () => {
    const prompt = "A glass studio above the ocean";
    let rejectGeneration: (error: Error) => void = () => undefined;
    mocks.createVideo.mockReturnValue(
      new Promise((_, reject) => {
        rejectGeneration = reject;
      }),
    );

    renderAppRoute();

    const { promptInput, submitButton } =
      await fillValidGenerationForm(prompt);

    fireEvent.click(submitButton);

    await waitFor(() => {
      expectComposerPlacement("docked");
    });

    rejectGeneration(new Error("generation unavailable"));

    await waitFor(() => {
      expectComposerPlacement("centered");
    });
    expect(promptInput.value).toBe(prompt);
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
          prompt: "A lantern city at dusk",
          aspectRatio: "16:9",
          duration: 5,
          generateAudio: false,
          requestedGenerations: 1,
        },
        expect.objectContaining({ client: expect.any(QueryClient) }),
      );
    });
  });
});

function renderAppRoute(params: { threadId?: string } = {}) {
  mocks.routeParams.current = params;
  const queryClient = createRouteTestQueryClient();

  return {
    queryClient,
    ...render(<AppRouteTestHarness queryClient={queryClient} />),
  };
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

function getTooltipText(text: string) {
  const tooltip = screen
    .getAllByRole("tooltip")
    .find((candidate) => candidate.textContent?.includes(text));

  if (!tooltip) {
    throw new Error(`Expected tooltip containing "${text}".`);
  }

  return tooltip.textContent ?? "";
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

function createThreadSummary(): GenerationThreadSummary {
  return {
    id: "thread_1",
    name: "Soft studio treatment",
    createdAt: "2026-06-08T12:00:00.000Z",
    updatedAt: "2026-06-08T12:00:00.000Z",
  };
}

function createThreadSubmission(): GenerationThreadSubmission {
  return {
    id: "submission_1",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "A quiet ocean studio",
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
    },
    requestedGenerations: 1,
    createdAt: "2026-06-05T00:00:00.000Z",
    updatedAt: "2026-06-05T00:01:00.000Z",
    jobs: [
      {
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
        result: {
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
        },
      },
    ],
  };
}

function createSeedanceModel(): PublishedGenerationModelSummary {
  const fields = [
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
          fieldIds: ["aspectRatio", "duration", "generateAudio"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules: ["seedance20ContentRules"],
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
          fieldIds: ["aspectRatio", "duration", "generateAudio"],
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
  };
}

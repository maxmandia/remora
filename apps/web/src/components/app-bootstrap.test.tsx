/** @vitest-environment jsdom */

import type {
  GenerationCommandContainerProps,
  GenerationResultsSurfaceProps,
  GenerationSettingsValue,
  GenerationWorkspaceStageProps,
} from "@remora/app/generation";
import type { AppSidebarProps } from "@remora/app/sidebar";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { GenerationThreadSummary } from "@remora/domain/generation-thread/dto";
import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import {
  act,
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
  appSidebar: vi.fn(),
  createProjectDialog: vi.fn(),
  generationCommandContainer: vi.fn(),
  generationResultsSurface: vi.fn(),
  generationWorkspaceStage: vi.fn(),
  getDefaultGenerationSettings: vi.fn(),
  hasGenerationAttachmentMediaValidationIssues: vi.fn(),
  useGenerationProjectSelection: vi.fn(),
  clearPendingFreshThreadSubmission: vi.fn(),
  navigate: vi.fn(),
  useHotkey: vi.fn(),
  togglePanel: vi.fn(),
  submitGeneration: vi.fn(),
  submitState: {
    current: {
      isPending: false,
      pendingFreshThreadSubmission: null as GenerationThreadSubmission | null,
    },
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
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
  projectSelection: {
    current: {
      isSelectedProjectResolved: true,
      projects: [] as ProjectSummary[],
      selectedProject: null as ProjectSummary | null,
      selectedProjectId: null as string | null,
    },
  },
  threadsWithoutProject: {
    current: [] as GenerationThreadSummary[],
  },
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({
    data: mocks.threadsWithoutProject.current,
  }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("@remora/app/auth", () => ({
  useAuth: () => mocks.authState.current,
}));

vi.mock("@remora/app/hotkeys", () => ({
  useHotkey: mocks.useHotkey,
}));

vi.mock("@remora/app/project", async () => {
  const React = await import("react");

  return {
    CreateProjectDialog: (props: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) => {
      mocks.createProjectDialog(props);

      return props.open
        ? React.createElement(
            "div",
            { "aria-label": "Create project", role: "dialog" },
            React.createElement(
              "button",
              {
                type: "button",
                onClick: () => props.onOpenChange(false),
              },
              "Close create project",
            ),
          )
        : null;
    },
  };
});

vi.mock("@remora/app/sidebar", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("@remora/app/sidebar")>(
    "@remora/app/sidebar",
  );

  return {
    ...actual,
    AppSidebar: (props: AppSidebarProps) => {
      mocks.appSidebar(props);

      return React.createElement(
        "aside",
        { "aria-label": "Remora workspace" },
        React.createElement(
          "button",
          { type: "button", onClick: props.onNewGeneration },
          "New generation",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: props.onCreateProject },
          "Create project",
        ),
        props.footer,
      );
    },
    AppSidebarFooter: ({ onOpenCredits }: { onOpenCredits: () => void }) =>
      React.createElement(
        "button",
        { type: "button", onClick: onOpenCredits },
        "Credits",
      ),
    SidebarToggleButton: () =>
      React.createElement(
        "button",
        { "aria-label": "Hide sidebar", type: "button" },
        "Sidebar",
      ),
  };
});

vi.mock("@remora/app/trpc", () => ({
  useTRPC: () => ({
    generationThread: {
      listWithoutProject: {
        queryOptions: () => ({
          queryKey: [["generationThread", "listWithoutProject"]],
        }),
      },
    },
  }),
}));

vi.mock("@remora/app/generation", async () => {
  const React = await import("react");

  return {
    createEmptyGenerationAttachmentMediaValue: () => ({
      images: [],
      videos: [],
      audios: [],
    }),
    GenerationCommandContainer: (props: GenerationCommandContainerProps) => {
      mocks.generationCommandContainer(props);

      return React.createElement(
        "div",
        null,
        React.createElement("textarea", {
          "aria-label": "Prompt",
          value: props.prompt,
          onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => {
            props.onPromptChange(event.target.value);
          },
        }),
        React.createElement(
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
        ),
        React.createElement(
          "button",
          {
            "aria-label": "Change settings",
            type: "button",
            onClick: () =>
              props.onGenerationSettingsChange({
                modelType: "video",
                aspectRatio: "9:16",
                resolution: "1080p",
                duration: 10,
                generateAudio: false,
                requestedGenerations: 2,
              }),
          },
          "Change settings",
        ),
        React.createElement(
          "button",
          {
            "aria-label": "Add test attachment",
            type: "button",
            onClick: () =>
              props.onGenerationAttachmentMediaChange({
                images: [
                  {
                    file: new File(["image"], "reference.png", {
                      type: "image/png",
                    }),
                    role: "reference",
                  },
                ],
                videos: [],
                audios: [],
              }),
          },
          "Add attachment",
        ),
        React.createElement(
          "button",
          {
            "aria-label": "Submit generation",
            disabled: !props.canSubmit,
            type: "button",
            onClick: props.onSubmit,
          },
          "Submit",
        ),
      );
    },
    GenerationResultsSurface: (props: GenerationResultsSurfaceProps) => {
      mocks.generationResultsSurface(props);

      return React.createElement("div", {
        "data-testid": "shared-generation-results",
      });
    },
    GenerationWorkspaceStage: (props: GenerationWorkspaceStageProps) => {
      mocks.generationWorkspaceStage(props);

      return React.createElement(
        "div",
        { "data-testid": "shared-generation-workspace-stage" },
        props.branding && props.placement === "centered"
          ? React.createElement("img", {
              alt: props.branding.alt,
              src: props.branding.src,
            })
          : null,
        props.results,
        props.composer,
      );
    },
    getDefaultGenerationSettings: mocks.getDefaultGenerationSettings,
    hasGenerationAttachmentMediaValidationIssues:
      mocks.hasGenerationAttachmentMediaValidationIssues,
    useCreateGenerationSubmissionMutation: () => ({
      clearPendingFreshThreadSubmission:
        mocks.clearPendingFreshThreadSubmission,
      isPending: mocks.submitState.current.isPending,
      pendingFreshThreadSubmission:
        mocks.submitState.current.pendingFreshThreadSubmission,
      submitGeneration: mocks.submitGeneration,
    }),
    useGenerationModelSelection: () => mocks.selection.current,
    useGenerationProjectSelection: (input: {
      requestedProjectId: string | null;
      threadId: string | null;
    }) => {
      mocks.useGenerationProjectSelection(input);

      return mocks.projectSelection.current;
    },
    useGenerationResultsPanelController: () => ({
      activePanel: null,
      attachmentMediaPanelId: "attachment-media-panel",
      closePanel: vi.fn(),
      isPanelOpen: false,
      stackPanelId: "generation-stack-panel",
      togglePanel: mocks.togglePanel,
    }),
  };
});

vi.mock("@remora/ui", async () => {
  const React = await import("react");

  return {
    cn: (...values: Array<string | false | null | undefined>) =>
      values.filter(Boolean).join(" "),
    SidebarInset: ({
      children,
      ...props
    }: React.ComponentPropsWithoutRef<"main">) =>
      React.createElement("main", props, children),
    SidebarProvider: ({
      children,
      open,
      ...props
    }: React.ComponentPropsWithoutRef<"div"> & { open: boolean }) =>
      React.createElement(
        "div",
        { ...props, "data-state": open ? "expanded" : "collapsed" },
        children,
      ),
    toast: {
      error: mocks.toastError,
      success: mocks.toastSuccess,
    },
  };
});

import { AppBootstrap } from "./app-bootstrap";
import { GenerationAttachmentMediaUploadError } from "../lib/generation-attachment-media-file-uploader";

const seedanceModel = {
  id: "seedance-2.0-video",
  displayName: "Seedance 2.0",
  type: "video",
} as PublishedGenerationModelSummary;
const defaultSettings = {
  modelType: "video",
  aspectRatio: "16:9",
  resolution: "720p",
  duration: 5,
  generateAudio: true,
  requestedGenerations: 1,
} satisfies GenerationSettingsValue;

describe("app bootstrap", () => {
  beforeEach(() => {
    mocks.authState.current.error = null;
    mocks.authState.current.requestAuth.mockReset();
    mocks.authState.current.requestAuth.mockResolvedValue(undefined);
    mocks.authState.current.signOut.mockReset();
    mocks.authState.current.signOut.mockResolvedValue(undefined);
    mocks.authState.current.status = "loading";
    mocks.authState.current.user = null;
    mocks.appSidebar.mockReset();
    mocks.createProjectDialog.mockReset();
    mocks.generationCommandContainer.mockReset();
    mocks.generationResultsSurface.mockReset();
    mocks.generationWorkspaceStage.mockReset();
    mocks.getDefaultGenerationSettings.mockReset();
    mocks.getDefaultGenerationSettings.mockReturnValue(defaultSettings);
    mocks.hasGenerationAttachmentMediaValidationIssues.mockReset();
    mocks.hasGenerationAttachmentMediaValidationIssues.mockReturnValue(false);
    mocks.useGenerationProjectSelection.mockReset();
    mocks.clearPendingFreshThreadSubmission.mockReset();
    mocks.navigate.mockReset();
    mocks.navigate.mockResolvedValue(undefined);
    mocks.useHotkey.mockReset();
    mocks.submitGeneration.mockReset();
    mocks.submitGeneration.mockResolvedValue({
      submissionId: "submission_1",
      threadId: "thread_1",
      jobs: [],
    });
    mocks.submitState.current.isPending = false;
    mocks.submitState.current.pendingFreshThreadSubmission = null;
    mocks.toastError.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.togglePanel.mockReset();
    mocks.selection.current = {
      error: null,
      isPending: false,
      models: [],
      retry: vi.fn().mockResolvedValue(undefined),
      selectedModel: null,
      setSelectedModel: vi.fn(),
    };
    mocks.projectSelection.current = {
      isSelectedProjectResolved: true,
      projects: [],
      selectedProject: null,
      selectedProjectId: null,
    };
    mocks.threadsWithoutProject.current = [];
  });

  afterEach(() => {
    cleanup();
  });

  it("shows session loading without rendering the workspace", () => {
    render(<AppBootstrap />);

    expect(screen.getByText("Resolving session...")).toBeTruthy();
    expect(
      screen.queryByRole("complementary", { name: "Remora workspace" }),
    ).toBeNull();
    expect(mocks.generationCommandContainer).not.toHaveBeenCalled();
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
  });

  it("redirects signed-out users to sign in", async () => {
    mocks.authState.current.status = "signed-out";

    render(<AppBootstrap />);

    expect(screen.getByText("Redirecting to sign in...")).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.queryByRole("complementary", { name: "Remora workspace" }),
    ).toBeNull();
    expect(mocks.generationCommandContainer).not.toHaveBeenCalled();
  });

  it("shows model loading before rendering the workspace", () => {
    setSignedIn();
    mocks.selection.current.isPending = true;

    render(<AppBootstrap />);

    expect(screen.getByText("Preparing workspace...")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Remora workspace" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("main", { name: "Generation workspace" }),
    ).toBeTruthy();
    expect(mocks.generationCommandContainer).not.toHaveBeenCalled();
  });

  it("renders projects and unprojected threads with the active thread", () => {
    const project = createProject("project_1", "Launch concepts", [
      {
        id: "thread_project",
        name: "Project thread",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    const unprojectedThread = {
      id: "thread_unprojected",
      name: "Loose thread",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    } satisfies GenerationThreadSummary;
    setSignedIn();
    mocks.projectSelection.current.projects = [project];
    mocks.threadsWithoutProject.current = [unprojectedThread];

    render(<AppBootstrap threadId={unprojectedThread.id} />);

    expect(mocks.appSidebar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projects: [project],
        selectedThreadId: unprojectedThread.id,
        threads: [unprojectedThread],
      }),
    );
    const sidebarProps = mocks.appSidebar.mock.lastCall?.[0];

    expect(sidebarProps?.getThreadHref("thread/with spaces")).toBe(
      "/app/threads/thread%2Fwith%20spaces",
    );
  });

  it("wires sidebar navigation, project creation, and workspace hotkeys", () => {
    setSignedIn();

    render(<AppBootstrap />);

    const sidebarProps = mocks.appSidebar.mock.lastCall?.[0];
    sidebarProps?.onNewGeneration();
    sidebarProps?.onNewGenerationInProject("project_1");
    sidebarProps?.onSelectThread("thread_1");

    expect(mocks.navigate).toHaveBeenNthCalledWith(1, {
      to: "/app",
      search: {},
    });
    expect(mocks.navigate).toHaveBeenNthCalledWith(2, {
      to: "/app",
      search: { projectId: "project_1" },
    });
    expect(mocks.navigate).toHaveBeenNthCalledWith(3, {
      to: "/app/threads/$threadId",
      params: { threadId: "thread_1" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy();

    const newGenerationHotkey = mocks.useHotkey.mock.calls.find(
      ([commandId]) => commandId === "app.newGeneration",
    )?.[1];
    const createProjectHotkey = mocks.useHotkey.mock.calls.find(
      ([commandId]) => commandId === "app.createProject",
    )?.[1];

    expect(newGenerationHotkey).toEqual(
      expect.objectContaining({ allowInEditable: true }),
    );
    expect(createProjectHotkey).toEqual(
      expect.objectContaining({ allowInEditable: true }),
    );

    act(() => {
      newGenerationHotkey?.onKeyDown();
      createProjectHotkey?.onKeyDown();
    });

    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/app",
      search: {},
    });
    expect(screen.getByRole("dialog", { name: "Create project" })).toBeTruthy();
  });

  it("opens the empty web credits route from the shared footer", () => {
    setSignedIn();

    render(<AppBootstrap />);

    fireEvent.click(screen.getByRole("button", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("renders the shared command container for signed-in users", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);

    expect(
      screen.getByRole("main", { name: "Generation workspace" }),
    ).toBeTruthy();
    expect(screen.getByAltText("Remora")).toBeTruthy();
    expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe(
      "seedance-2.0-video",
    );
    await waitFor(() => {
      expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          canSubmit: false,
          generationSettings: defaultSettings,
          models: [seedanceModel],
          projectSelectorDisabled: false,
          projects: [],
          selectedModel: seedanceModel,
        }),
      );
    });
    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("renders pending fresh results in the shared docked overlay stage", () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitState.current.isPending = true;
    mocks.submitState.current.pendingFreshThreadSubmission = {
      id: "optimistic-submission",
    } as GenerationThreadSubmission;

    render(<AppBootstrap />);

    expect(screen.getByTestId("shared-generation-results")).toBeTruthy();
    expect(mocks.generationWorkspaceStage).toHaveBeenCalledWith(
      expect.objectContaining({
        isSupplementalOpen: false,
        placement: "docked",
      }),
    );
    expect(mocks.generationResultsSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        activePanel: null,
        attachmentMediaPanelId: "attachment-media-panel",
        pendingFreshThreadSubmission:
          mocks.submitState.current.pendingFreshThreadSubmission,
        stackPanelId: "generation-stack-panel",
        threadId: null,
        variant: "overlay",
        onActivePanelToggle: mocks.togglePanel,
      }),
    );
    expect(screen.queryByAltText("Remora")).toBeNull();
    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectSelectorDisabled: true,
      }),
    );
  });

  it("renders a thread route through the shared surface and clears fresh state", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap threadId="thread_1" />);

    expect(mocks.generationResultsSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingFreshThreadSubmission: null,
        stackPanelId: "generation-stack-panel",
        threadId: "thread_1",
        variant: "overlay",
      }),
    );
    await waitFor(() => {
      expect(mocks.clearPendingFreshThreadSubmission).toHaveBeenCalledTimes(1);
    });
    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectSelectorDisabled: true,
        selectedProject: null,
        selectedProjectId: null,
      }),
    );
  });

  it("wires fresh project selection to URL navigation", () => {
    const project = createProject("project_1", "Launch concepts");
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.projectSelection.current = {
      isSelectedProjectResolved: true,
      projects: [project],
      selectedProject: project,
      selectedProjectId: project.id,
    };

    render(<AppBootstrap projectId={project.id} />);

    expect(mocks.useGenerationProjectSelection).toHaveBeenCalledWith({
      requestedProjectId: project.id,
      threadId: null,
    });
    const commandProps = mocks.generationCommandContainer.mock.lastCall?.[0];

    commandProps?.onSelectProject("project_2");
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app",
      search: { projectId: "project_2" },
    });

    commandProps?.onClearProject();
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app",
      search: {},
    });
  });

  it("shows an existing thread's project in a disabled selector", () => {
    const project = createProject("project_1", "Launch concepts", [
      {
        id: "thread_1",
        name: "Hero frames",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.projectSelection.current = {
      isSelectedProjectResolved: true,
      projects: [project],
      selectedProject: project,
      selectedProjectId: project.id,
    };

    render(<AppBootstrap projectId="ignored_project" threadId="thread_1" />);

    expect(mocks.useGenerationProjectSelection).toHaveBeenCalledWith({
      requestedProjectId: null,
      threadId: "thread_1",
    });
    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectSelectorDisabled: true,
        projects: [project],
        selectedProject: project,
        selectedProjectId: project.id,
      }),
    );
  });

  it("owns controlled prompt and settings state for the shared container", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change settings" }));

    await waitFor(() => {
      expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          prompt: "A moonlit glass studio",
          generationSettings: expect.objectContaining({
            aspectRatio: "9:16",
            requestedGenerations: 2,
          }),
        }),
      );
    });
  });

  it("enables valid submissions and navigates after a successful new thread without a toast", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Submit generation",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.submitGeneration).toHaveBeenCalledWith({
        model: seedanceModel,
        prompt: "A moonlit glass studio",
        attachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
        settings: defaultSettings,
        target: { kind: "new-thread", projectId: null },
        userId: "user_1",
      });
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/threads/$threadId",
        params: { threadId: "thread_1" },
      });
      expect(mocks.clearPendingFreshThreadSubmission).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "",
    );
  });

  it("reveals a newly created project thread across route navigation", async () => {
    const project = createProject("project_1", "Launch concepts");
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.projectSelection.current = {
      isSelectedProjectResolved: true,
      projects: [project],
      selectedProject: project,
      selectedProjectId: project.id,
    };

    const rendered = render(<AppBootstrap projectId={project.id} />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A launch film hero frame" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.submitGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "A launch film hero frame",
          target: { kind: "new-thread", projectId: project.id },
        }),
      );
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/threads/$threadId",
        params: { threadId: "thread_1" },
      });
      expect(mocks.appSidebar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          projectThreadRevealRequest: {
            projectId: project.id,
            threadId: "thread_1",
          },
        }),
      );
    });

    const refreshedProject = createProject(project.id, project.name, [
      {
        id: "thread_1",
        name: "Launch film",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    mocks.projectSelection.current = {
      isSelectedProjectResolved: true,
      projects: [refreshedProject],
      selectedProject: refreshedProject,
      selectedProjectId: refreshedProject.id,
    };
    rendered.rerender(<AppBootstrap threadId="thread_1" />);

    expect(mocks.appSidebar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projects: [refreshedProject],
        projectThreadRevealRequest: {
          projectId: project.id,
          threadId: "thread_1",
        },
        selectedThreadId: "thread_1",
      }),
    );
  });

  it("blocks submission for an unresolved project ID", () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.projectSelection.current = {
      isSelectedProjectResolved: false,
      projects: [],
      selectedProject: null,
      selectedProjectId: "missing_project",
    };

    render(<AppBootstrap projectId="missing_project" />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A launch film hero frame" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(mocks.submitGeneration).not.toHaveBeenCalled();
  });

  it("submits follow-up generations into the active thread", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap threadId="thread_1" />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Continue through the glass hallway" },
    });

    await waitFor(() => {
      expect(
        (
          screen.getByRole("button", {
            name: "Submit generation",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.submitGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "Continue through the glass hallway",
          target: { kind: "existing-thread", threadId: "thread_1" },
        }),
      );
      expect(mocks.navigate).not.toHaveBeenCalled();
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });
  });

  it("restores the submitted draft when submission fails", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitGeneration.mockRejectedValueOnce(
      new Error("Upload unavailable"),
    );

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add test attachment" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Upload unavailable");
    });
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "A moonlit glass studio",
    );
    expect(
      mocks.generationCommandContainer.mock.lastCall?.[0]
        .generationAttachmentMedia.images[0]?.file.name,
    ).toBe("reference.png");
  });

  it("redirects through auth when an upload reports an expired session", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitGeneration.mockRejectedValueOnce(
      new GenerationAttachmentMediaUploadError("Unauthorized", 401),
    );

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "A moonlit glass studio",
    );
  });

  it("disables submission while the shared workflow is pending", () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitState.current.isPending = true;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("blocks submission when selected attachments have validation issues", () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.hasGenerationAttachmentMediaValidationIssues.mockReturnValue(true);

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    expect(
      (
        screen.getByRole("button", {
          name: "Submit generation",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("retains attachment state and clears it on model change", async () => {
    const klingModel = {
      id: "kling-v3-text-to-video",
      displayName: "Kling 3.0 Text to Video",
    } as PublishedGenerationModelSummary;
    setSignedIn();
    mocks.selection.current.models = [seedanceModel, klingModel];
    mocks.selection.current.selectedModel = seedanceModel;
    const rendered = render(<AppBootstrap />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add test attachment" }),
    );

    await waitFor(() => {
      expect(
        mocks.generationCommandContainer.mock.lastCall?.[0]
          .generationAttachmentMedia.images[0]?.file.name,
      ).toBe("reference.png");
    });

    mocks.selection.current.selectedModel = klingModel;
    rendered.rerender(<AppBootstrap />);

    await waitFor(() => {
      expect(
        mocks.generationCommandContainer.mock.lastCall?.[0]
          .generationAttachmentMedia,
      ).toEqual({
        images: [],
        videos: [],
        audios: [],
      });
    });
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
    expect(
      screen.getByRole("complementary", { name: "Remora workspace" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(mocks.authState.current.requestAuth).toHaveBeenCalledTimes(1);
    });
    expect(mocks.generationCommandContainer).not.toHaveBeenCalled();
  });

  it("shows other failures and retries model loading", () => {
    setSignedIn();
    mocks.selection.current.error = new Error("Network unavailable");

    render(<AppBootstrap />);

    expect(screen.getByText("Unable to prepare the workspace.")).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Remora workspace" }),
    ).toBeTruthy();

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

function createProject(
  id: string,
  name: string,
  threads: ProjectSummary["threads"] = [],
): ProjectSummary {
  return {
    id,
    name,
    threads,
    archivedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

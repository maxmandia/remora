/** @vitest-environment jsdom */

import type {
  GenerationCommandContainerProps,
  GenerationResultsSurfaceProps,
  GenerationSettingsValue,
  GenerationWorkspacePreset,
  GenerationWorkspaceStageProps,
} from "@remora/app/generation";
import { exploreAdsVhsTapes, exploreVhsTapes } from "@remora/app/explore";
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
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuestGenerationDraftInput } from "../lib/guest-generation-draft";
import { useWebPreferencesStore } from "../stores/preferences-store.ts";

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
        role: "admin" | "user";
        image: string | null;
      } | null,
    },
  },
  appSidebar: vi.fn(),
  createProjectDialog: vi.fn(),
  renameProjectDialog: vi.fn(),
  generationCommandContainer: vi.fn(),
  guestGenerationAuthDialog: vi.fn(),
  guestGenerationPreviewResults: vi.fn(),
  guestGenerationRestore: {
    current: {
      complete: vi.fn(),
      discard: vi.fn(),
      draft: null as {
        attachmentMedia: {
          audios: never[];
          images: Array<{
            source: "local";
            file: File;
            role: "reference";
          }>;
          videos: never[];
        };
        model: PublishedGenerationModelSummary;
        prompt: string;
        settings: GenerationSettingsValue;
      } | null,
    },
  },
  generationResultsSurface: vi.fn(),
  generationWorkspaceStage: vi.fn(),
  getDefaultGenerationSettings: vi.fn(),
  hasGenerationAttachmentMediaValidationIssues: vi.fn(),
  isGuestGenerationDraftInputValid: vi.fn(),
  prepareGuestGenerationPreview: vi.fn(),
  useGenerationProjectSelection: vi.fn(),
  clearPendingFreshThreadSubmission: vi.fn(),
  fetchQuery: vi.fn(),
  navigate: vi.fn(),
  useHotkey: vi.fn(),
  togglePanel: vi.fn(),
  submitGeneration: vi.fn(),
  threadQueryOptions: vi.fn(),
  submitState: {
    current: {
      isPending: false,
      pendingFreshThreadSubmission: null as GenerationThreadSubmission | null,
    },
  },
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  trackGuestGenerationAnalyticsEvent: vi.fn(),
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
  useQueryClient: () => ({ fetchQuery: mocks.fetchQuery }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
  }: {
    children: ReactNode;
    search?: Record<string, unknown>;
    to: string;
  }) => <a href={to}>{children}</a>,
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
    RenameProjectDialog: (props: {
      open: boolean;
      project: ProjectSummary;
      onOpenChange: (open: boolean) => void;
    }) => {
      mocks.renameProjectDialog(props);

      return props.open
        ? React.createElement(
            "div",
            { "aria-label": "Rename project", role: "dialog" },
            props.project.name,
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
          {
            disabled: props.createProjectDisabled,
            type: "button",
            onClick: props.onCreateProject,
          },
          "Create project",
        ),
        props.footer,
      );
    },
    AppSidebarFooter: ({
      onOpenAdmin,
      onOpenCredits,
    }: {
      onOpenAdmin: () => void;
      onOpenCredits: () => void;
    }) =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "button",
          { type: "button", onClick: onOpenAdmin },
          "Admin",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: onOpenCredits },
          "Credits",
        ),
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
    generation: {
      listAttachmentMediaFromSubmission: {
        queryOptions: (input: { submissionId: string }, options: unknown) => ({
          ...((options as object | undefined) ?? {}),
          queryKey: ["generation", "listAttachmentMediaFromSubmission", input],
        }),
      },
    },
    generationThread: {
      listWithoutProject: {
        queryOptions: mocks.threadQueryOptions,
      },
    },
  }),
}));

vi.mock("@remora/app/generation", async () => {
  const React = await import("react");
  const actual = await vi.importActual<typeof import("@remora/app/generation")>(
    "@remora/app/generation",
  );

  return {
    ...actual,
    createEmptyGenerationAttachmentMediaValue: () => ({
      images: [],
      videos: [],
      audios: [],
    }),
    createStoredGenerationAttachmentMediaValue: (
      media: Array<{
        fieldId: "images" | "videos" | "audios";
        role: "reference" | "firstFrame" | "lastFrame";
      }>,
    ) => {
      const value = { images: [], videos: [], audios: [] } as Record<
        "images" | "videos" | "audios",
        unknown[]
      >;

      for (const item of media) {
        value[item.fieldId].push({ ...item, source: "stored" });
      }

      return value;
    },
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
                    source: "local",
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
    GenerationCreativeCategoryCtas: (props: {
      onSelectCategory: (category: "ads" | "art" | "film") => void;
    }) =>
      React.createElement(
        "div",
        { "aria-label": "Creative categories", role: "group" },
        React.createElement(
          "button",
          { type: "button", onClick: () => props.onSelectCategory("film") },
          "Film",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: () => props.onSelectCategory("ads") },
          "Ads",
        ),
        React.createElement(
          "button",
          { type: "button", onClick: () => props.onSelectCategory("art") },
          "Art",
        ),
      ),
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
        props.branding
          ? React.createElement("img", {
              alt: props.branding.alt,
              src: props.branding.src,
            })
          : null,
        props.centeredContent,
        props.results,
        props.composer,
      );
    },
    getDefaultGenerationSettings: mocks.getDefaultGenerationSettings,
    getGenerationWorkspacePresetSettings: (
      selectedModel: PublishedGenerationModelSummary | null,
      preset: (typeof exploreVhsTapes)[number] | null,
    ) =>
      selectedModel && preset && selectedModel.id === preset.modelId
        ? {
            ...defaultSettings,
            duration: preset.duration,
            resolution: preset.resolution,
          }
        : null,
    hasGenerationAttachmentMediaValidationIssues:
      mocks.hasGenerationAttachmentMediaValidationIssues,
    restoreGenerationSettingsFromSubmission: () => ({
      settings: defaultSettings,
      wasAdapted: false,
    }),
    useGeneratedImageAttachment: () => ({
      addGeneratedImage: vi.fn(),
      getRoleChoices: () => [],
      isPending: () => false,
    }),
    useCreateGenerationSubmissionMutation: () => ({
      clearPendingFreshThreadSubmission:
        mocks.clearPendingFreshThreadSubmission,
      isPending: mocks.submitState.current.isPending,
      pendingFreshThreadSubmission:
        mocks.submitState.current.pendingFreshThreadSubmission,
      submitGeneration: mocks.submitGeneration,
    }),
    useEditGenerationSubmission: ({
      models,
      onApply,
    }: {
      models: PublishedGenerationModelSummary[];
      onApply: (draft: {
        attachmentMedia: Record<"images" | "videos" | "audios", unknown[]>;
        model: PublishedGenerationModelSummary;
        prompt: string;
        settings: GenerationSettingsValue;
      }) => void;
    }) => ({
      editGenerationSubmission: async (
        submission: GenerationThreadSubmission,
      ) => {
        const model = models.find(
          (candidate) => candidate.id === submission.modelId,
        );

        if (!model) {
          return;
        }

        const media = (await mocks.fetchQuery({
          queryKey: [
            "generation",
            "listAttachmentMediaFromSubmission",
            { submissionId: submission.id },
          ],
        })) as Array<{
          fieldId: "images" | "videos" | "audios";
        }>;
        const attachmentMedia = {
          images: [],
          videos: [],
          audios: [],
        } as Record<"images" | "videos" | "audios", unknown[]>;

        for (const item of media) {
          attachmentMedia[item.fieldId].push({ ...item, source: "stored" });
        }

        onApply({
          attachmentMedia,
          model,
          prompt: submission.submittedInput.prompt,
          settings: defaultSettings,
        });
      },
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

vi.mock("../lib/guest-generation-draft", () => ({
  isGuestGenerationDraftInputValid: mocks.isGuestGenerationDraftInputValid,
}));

vi.mock("../lib/analytics", () => ({
  trackGuestGenerationAnalyticsEvent: mocks.trackGuestGenerationAnalyticsEvent,
}));

vi.mock("../lib/guest-generation-preview", () => {
  class GuestGenerationPreviewError extends Error {}

  return {
    GuestGenerationPreviewError,
    guestGenerationPreviewService: {
      prepare: mocks.prepareGuestGenerationPreview,
    },
  };
});

vi.mock("./guest-generation-preview-results", async () => {
  const React = await import("react");

  return {
    GuestGenerationPreviewResults: (props: {
      guestGenerationPreviewDraft: GuestGenerationDraftInput;
    }) => {
      mocks.guestGenerationPreviewResults(props);

      return React.createElement(
        "div",
        { role: "status" },
        "Preparing guest generation",
      );
    },
  };
});

vi.mock("./guest-generation-auth-dialog", async () => {
  const React = await import("react");

  return {
    GuestGenerationAuthDialog: (props: {
      open: boolean;
      onClose: () => void;
      onCreateAccount: () => void;
      onSignIn: () => void;
    }) => {
      mocks.guestGenerationAuthDialog(props);

      return props.open
        ? React.createElement(
            "div",
            {
              "aria-label": "Continue your guest generation",
              role: "dialog",
            },
            React.createElement(
              "p",
              null,
              "Sign up or sign in to continue with your generation.",
            ),
            React.createElement(
              "button",
              { type: "button", onClick: props.onCreateAccount },
              "Create account",
            ),
            React.createElement(
              "button",
              { type: "button", onClick: props.onSignIn },
              "Sign in",
            ),
            React.createElement(
              "button",
              { type: "button", onClick: props.onClose },
              "Close",
            ),
          )
        : null;
    },
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
      info: mocks.toastInfo,
      success: mocks.toastSuccess,
    },
  };
});

import { GenerationAttachmentMediaUploadError } from "../lib/generation-attachment-media-file-uploader";
import { GuestGenerationPreviewError } from "../lib/guest-generation-preview";
import { WebGenerationWorkspace } from "./web-generation-workspace";

const seedanceModel = {
  id: "seedance-2.0-video",
  displayName: "Seedance 2.0",
  type: "video",
} as PublishedGenerationModelSummary;
const seedance25Model = {
  id: "seedance-2.5-video",
  displayName: "Seedance 2.5",
  type: "video",
} as PublishedGenerationModelSummary;
const nanoBananaModel = {
  id: "nano-banana-2",
  displayName: "Nano Banana 2",
  type: "image",
} as PublishedGenerationModelSummary;
const defaultSettings = {
  modelType: "video",
  aspectRatio: "16:9",
  resolution: "720p",
  duration: 5,
  generateAudio: true,
  requestedGenerations: 1,
} satisfies GenerationSettingsValue;
describe("web generation workspace", () => {
  beforeEach(() => {
    useWebPreferencesStore.setState({ hasSeenWizardEntrance: false });
    mocks.authState.current.error = null;
    mocks.authState.current.requestAuth.mockReset();
    mocks.authState.current.requestAuth.mockResolvedValue(undefined);
    mocks.authState.current.signOut.mockReset();
    mocks.authState.current.signOut.mockResolvedValue(undefined);
    mocks.authState.current.status = "loading";
    mocks.authState.current.user = null;
    mocks.appSidebar.mockReset();
    mocks.createProjectDialog.mockReset();
    mocks.renameProjectDialog.mockReset();
    mocks.generationCommandContainer.mockReset();
    mocks.guestGenerationAuthDialog.mockReset();
    mocks.guestGenerationPreviewResults.mockReset();
    mocks.guestGenerationRestore.current = {
      complete: vi.fn().mockResolvedValue(true),
      discard: vi.fn().mockResolvedValue(true),
      draft: null,
    };
    mocks.generationResultsSurface.mockReset();
    mocks.generationWorkspaceStage.mockReset();
    mocks.getDefaultGenerationSettings.mockReset();
    mocks.getDefaultGenerationSettings.mockReturnValue(defaultSettings);
    mocks.hasGenerationAttachmentMediaValidationIssues.mockReset();
    mocks.hasGenerationAttachmentMediaValidationIssues.mockReturnValue(false);
    mocks.isGuestGenerationDraftInputValid.mockReset();
    mocks.isGuestGenerationDraftInputValid.mockReturnValue(true);
    mocks.prepareGuestGenerationPreview.mockReset();
    mocks.prepareGuestGenerationPreview.mockResolvedValue({
      promotionTicket: "promotion-ticket",
    });
    mocks.useGenerationProjectSelection.mockReset();
    mocks.clearPendingFreshThreadSubmission.mockReset();
    mocks.fetchQuery.mockReset();
    mocks.fetchQuery.mockResolvedValue([]);
    mocks.navigate.mockReset();
    mocks.navigate.mockResolvedValue(undefined);
    mocks.useHotkey.mockReset();
    mocks.submitGeneration.mockReset();
    mocks.submitGeneration.mockResolvedValue({
      submissionId: "submission_1",
      threadId: "thread_1",
      jobs: [],
    });
    mocks.threadQueryOptions.mockReset();
    mocks.threadQueryOptions.mockImplementation((_input, options) => ({
      ...options,
      queryKey: [["generationThread", "listWithoutProject"]],
    }));
    mocks.submitState.current.isPending = false;
    mocks.submitState.current.pendingFreshThreadSubmission = null;
    mocks.toastError.mockReset();
    mocks.toastInfo.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.trackGuestGenerationAnalyticsEvent.mockReset();
    mocks.trackGuestGenerationAnalyticsEvent.mockResolvedValue(undefined);
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
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("renders a guest workspace without account-backed actions", () => {
    mocks.authState.current.status = "signed-out";
    mocks.threadsWithoutProject.current = [
      {
        id: "cached_thread",
        name: "Cached account thread",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    render(<AppBootstrap />);

    expect(
      screen.getByRole("complementary", { name: "Remora workspace" }),
    ).toBeTruthy();
    expect(mocks.generationCommandContainer).toHaveBeenCalledWith(
      expect.objectContaining({
        canSubmit: false,
        projectSelectorDisabled: true,
        requiresAffordability: false,
      }),
    );
    expect(
      (
        screen.getByRole("button", {
          name: "Create project",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Credits" })).toBeNull();
    expect(mocks.createProjectDialog).not.toHaveBeenCalled();
    expect(mocks.threadQueryOptions).toHaveBeenCalledWith(undefined, {
      enabled: false,
    });
    expect(mocks.appSidebar).toHaveBeenCalledWith(
      expect.objectContaining({
        threads: [],
      }),
    );
    expect(mocks.authState.current.requestAuth).not.toHaveBeenCalled();
    expect(mocks.useGenerationProjectSelection).toHaveBeenCalledWith({
      requestedProjectId: null,
      threadId: null,
    });
  });

  it("initializes the composer from a resolved Explore preset", () => {
    const tape = exploreVhsTapes[0];
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(
      <AppBootstrap
        initialGenerationPreset={tape}
        initialPrompt={tape.prompt}
      />,
    );

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generationSettings: {
          ...defaultSettings,
          duration: -1,
          resolution: "1080p",
        },
        prompt: tape.prompt,
        selectedModel: seedanceModel,
      }),
    );
  });

  it("hydrates ordered Explore references after the preset model resolves", async () => {
    const tape = exploreAdsVhsTapes.find(
      (candidate) => candidate.title === "Fresh on Seedance",
    );

    if (!tape || !("referenceMedia" in tape)) {
      throw new Error("Expected the Fresh on Seedance reference preset.");
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = String(input);
        const type = url.endsWith(".png") ? "image/png" : "video/mp4";

        return new Response(url, {
          headers: { "Content-Type": type },
        });
      }),
    );
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedance25Model];
    mocks.selection.current.selectedModel = seedance25Model;

    render(
      <AppBootstrap
        initialGenerationPreset={tape}
        initialPrompt={tape.prompt}
      />,
    );

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        canSubmit: false,
        referenceMediaState: expect.objectContaining({ status: "loading" }),
      }),
    );

    await waitFor(() => {
      expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          generationAttachmentMedia: {
            audios: [],
            images: [
              expect.objectContaining({
                file: expect.objectContaining({ name: "image1.png" }),
                role: "reference",
              }),
            ],
            videos: Array.from({ length: 6 }, (_, index) =>
              expect.objectContaining({
                file: expect.objectContaining({
                  name: `video${index + 1}.mp4`,
                }),
                role: "reference",
              }),
            ),
          },
          referenceMediaState: expect.objectContaining({ status: "ready" }),
          selectedModel: seedance25Model,
        }),
      );
    });
  });

  it("keeps a restored guest draft ahead of an Explore prompt", () => {
    const restoredDraft = setRestoredGuestGeneration();
    const tape = exploreAdsVhsTapes.find(
      (candidate) => candidate.title === "Fresh on Seedance",
    );
    const fetcher = vi.fn();

    if (!tape) {
      throw new Error("Expected the Fresh on Seedance preset.");
    }

    vi.stubGlobal("fetch", fetcher);
    setSignedIn();

    render(
      <AppBootstrap
        initialGenerationPreset={tape}
        initialPrompt={tape.prompt}
      />,
    );

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generationAttachmentMedia: restoredDraft.attachmentMedia,
        prompt: restoredDraft.prompt,
      }),
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("shows and dismisses the wizard callout after the entrance completes", () => {
    mocks.authState.current.status = "signed-out";

    render(<AppBootstrap />);

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wizardCalloutVisible: false,
        wizardHidden: true,
      }),
    );

    act(() => {
      mocks.generationWorkspaceStage.mock.lastCall?.[0].onWizardEntranceComplete?.();
    });

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wizardCalloutVisible: true,
        wizardHidden: false,
      }),
    );

    act(() => {
      mocks.generationCommandContainer.mock.lastCall?.[0].onWizardCalloutDismiss?.();
    });

    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({ wizardCalloutVisible: false }),
    );
  });

  it("persists a valid guest draft before showing a three-second simulated result", async () => {
    vi.useFakeTimers();
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Submit generation" }),
      );
      await Promise.resolve();
    });

    expect(mocks.prepareGuestGenerationPreview).toHaveBeenCalledWith({
      attachmentMedia: {
        audios: [],
        images: [],
        videos: [],
      },
      model: seedanceModel,
      prompt: "A moonlit glass studio",
      settings: defaultSettings,
    });
    expect(mocks.trackGuestGenerationAnalyticsEvent).toHaveBeenCalledWith({
      type: "guest_generation_workspace_viewed",
    });
    expect(mocks.trackGuestGenerationAnalyticsEvent).toHaveBeenCalledWith({
      type: "guest_generation_preview_submitted",
      attachmentCount: 0,
      modelType: "video",
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Preparing guest generation",
    );
    expect(
      screen
        .getByLabelText("Prompt")
        .closest("[data-guest-preview-locked]")
        ?.getAttribute("data-guest-preview-locked"),
    ).toBe("true");
    expect(mocks.generationWorkspaceStage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        branding: undefined,
        centeredContent: undefined,
      }),
    );
    expect(mocks.submitGeneration).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", {
        name: "Continue your guest generation",
      }),
    ).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_999);
    });
    expect(
      screen.queryByRole("dialog", {
        name: "Continue your guest generation",
      }),
    ).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(
      screen.getByRole("dialog", {
        name: "Continue your guest generation",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText("Sign up or sign in to continue with your generation."),
    ).toBeTruthy();
  });

  it("guards guest preview preparation against duplicate submit callbacks", async () => {
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    const onSubmit =
      mocks.generationCommandContainer.mock.lastCall?.[0].onSubmit;

    await act(async () => {
      onSubmit?.();
      onSubmit?.();
      await Promise.resolve();
    });

    expect(mocks.prepareGuestGenerationPreview).toHaveBeenCalledOnce();
  });

  it("closes the guest auth modal back to the intact editable draft", async () => {
    vi.useFakeTimers();
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Add test attachment" }),
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Submit generation" }),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(
      screen.queryByRole("dialog", {
        name: "Continue your guest generation",
      }),
    ).toBeNull();
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "A moonlit glass studio",
    );
    expect(
      mocks.generationCommandContainer.mock.lastCall?.[0]
        .generationAttachmentMedia.images[0]?.file.name,
    ).toBe("reference.png");
    expect(mocks.generationWorkspaceStage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        branding: {
          alt: "Remora",
          src: "/remora-wordmark.svg",
        },
        centeredContent: expect.anything(),
      }),
    );
    expect(
      screen
        .getByLabelText("Prompt")
        .closest("[data-guest-preview-locked]")
        ?.getAttribute("data-guest-preview-locked"),
    ).toBe("false");
  });

  it("routes guest auth choices with the saved-draft handoff", async () => {
    vi.useFakeTimers();
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Submit generation" }),
      );
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(3_000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/sign-up",
      search: { guestGeneration: true, redirect: "/app" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mocks.navigate).toHaveBeenLastCalledWith({
      to: "/sign-in",
      search: { guestGeneration: true, redirect: "/app" },
    });
  });

  it("keeps a guest draft editable when preview preparation fails", async () => {
    const previewError = new GuestGenerationPreviewError(
      "Unable to save your generation in this browser. Try again.",
    );
    mocks.prepareGuestGenerationPreview.mockRejectedValueOnce(previewError);
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Submit generation" }),
      );
      await Promise.resolve();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Unable to save your generation in this browser. Try again.",
    );
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "A moonlit glass studio",
    );
    expect(mocks.guestGenerationPreviewResults).not.toHaveBeenCalled();
    expect(mocks.guestGenerationAuthDialog).not.toHaveBeenCalled();
    expect(mocks.trackGuestGenerationAnalyticsEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: "guest_generation_preview_submitted",
      }),
    );
  });

  it("cancels the guest preview timer when the workspace unmounts", async () => {
    vi.useFakeTimers();
    mocks.authState.current.status = "signed-out";
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    const rendered = render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Submit generation" }),
      );
      await Promise.resolve();
    });
    rendered.unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(mocks.guestGenerationAuthDialog).not.toHaveBeenCalled();
  });

  it("preserves the authenticated composer through Strict Mode effect replay", async () => {
    const restoredDraft = setRestoredGuestGeneration();
    restoredDraft.settings = {
      ...defaultSettings,
      aspectRatio: "9:16",
      duration: 10,
      resolution: "1080p",
    };
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(
      <StrictMode>
        <AppBootstrap />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          generationAttachmentMedia: restoredDraft.attachmentMedia,
          generationSettings: restoredDraft.settings,
          prompt: restoredDraft.prompt,
          requiresAffordability: true,
          selectedModel: seedanceModel,
        }),
      );
    });
    expect(mocks.submitGeneration).not.toHaveBeenCalled();
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

    expect(newGenerationHotkey).not.toHaveProperty("allowInEditable");
    expect(createProjectHotkey).not.toHaveProperty("allowInEditable");

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

  it("opens the rename project dialog for the selected sidebar project", () => {
    const project = createProject("project_1", "Launch concepts");
    setSignedIn();
    mocks.projectSelection.current.projects = [project];

    render(<AppBootstrap />);

    act(() => {
      mocks.appSidebar.mock.lastCall?.[0].onRenameProject(project);
    });

    expect(
      screen.getByRole("dialog", { name: "Rename project" }).textContent,
    ).toContain(project.name);
    expect(mocks.renameProjectDialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ open: true, project }),
    );

    act(() => {
      mocks.renameProjectDialog.mock.lastCall?.[0].onOpenChange(false);
    });
    expect(screen.queryByRole("dialog", { name: "Rename project" })).toBeNull();
  });

  it("opens the web credits route from the shared footer", () => {
    setSignedIn();

    render(<AppBootstrap />);

    fireEvent.click(screen.getByRole("button", { name: "Credits" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/settings/credits",
    });
  });

  it("opens the web admin route from the shared footer", () => {
    setSignedIn();

    render(<AppBootstrap />);

    fireEvent.click(screen.getByRole("button", { name: "Admin" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app/admin",
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
    expect(
      screen.getByRole("group", { name: "Creative categories" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Film" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ads" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Art" })).toBeTruthy();
    expect(
      mocks.generationWorkspaceStage.mock.lastCall?.[0].welcomeTopOffset,
    ).toBeUndefined();
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

  it("opens the selected creative category in explore", () => {
    setSignedIn();

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "Ads" }));

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/explore/$category",
      params: { category: "ads" },
    });
  });

  it("renders pending fresh results without welcome content", () => {
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
        branding: undefined,
        centeredContent: undefined,
        isSupplementalOpen: false,
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
    expect(
      screen.queryByRole("group", { name: "Creative categories" }),
    ).toBeNull();
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

  it("rehydrates an editable submission with stored references", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.fetchQuery.mockResolvedValue([
      {
        id: "attachment_1",
        kind: "image",
        fieldId: "images",
        role: "reference",
        originalFileName: "reference.png",
        contentType: "image/png",
        contentLength: 5,
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: null,
          fps: null,
        },
        createdAt: "2026-06-15T11:00:00.000Z",
        url: "https://assets.example/reference.png",
        urlExpiresAt: "2026-06-15T12:00:00.000Z",
      },
    ]);
    const submission = createEditableSubmission();

    render(<AppBootstrap threadId="thread_1" />);
    const resultsProps = mocks.generationResultsSurface.mock.lastCall?.[0];

    await act(async () => {
      await resultsProps?.onEditSubmission?.(submission);
    });

    expect(mocks.fetchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: [
          "generation",
          "listAttachmentMediaFromSubmission",
          { submissionId: submission.id },
        ],
      }),
    );
    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        focusRequestKey: 1,
        prompt: "Restore this prompt",
        generationAttachmentMedia: {
          images: [
            expect.objectContaining({
              source: "stored",
              id: "attachment_1",
              role: "reference",
            }),
          ],
          videos: [],
          audios: [],
        },
        generationSettings: defaultSettings,
      }),
    );
    expect(mocks.selection.current.setSelectedModel).toHaveBeenCalledWith(
      seedanceModel,
    );
    expect(mocks.togglePanel).toHaveBeenCalledWith(null);
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

  it("clears submitted prompt and attachments while preserving settings", async () => {
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "A moonlit glass studio" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change settings" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Add test attachment" }),
    );

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
          images: [
            expect.objectContaining({
              file: expect.objectContaining({ name: "reference.png" }),
              role: "reference",
            }),
          ],
          videos: [],
          audios: [],
        },
        settings: {
          modelType: "video",
          aspectRatio: "9:16",
          resolution: "1080p",
          duration: 10,
          generateAudio: false,
          requestedGenerations: 2,
        },
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
    expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        generationAttachmentMedia: {
          images: [],
          videos: [],
          audios: [],
        },
        generationSettings: expect.objectContaining({
          aspectRatio: "9:16",
          requestedGenerations: 2,
        }),
        prompt: "",
      }),
    );
  });

  it("preserves a new prompt typed while the submitted draft is pending", async () => {
    let resolveSubmission!: (value: {
      submissionId: string;
      threadId: string;
      jobs: [];
    }) => void;
    const pendingSubmission = new Promise<{
      submissionId: string;
      threadId: string;
      jobs: [];
    }>((resolve) => {
      resolveSubmission = resolve;
    });
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitGeneration.mockReturnValue(pendingSubmission);

    render(<AppBootstrap />);
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Submitted prompt" },
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
    fireEvent.change(screen.getByLabelText("Prompt"), {
      target: { value: "Next prompt" },
    });

    await act(async () => {
      resolveSubmission({
        submissionId: "submission_1",
        threadId: "thread_1",
        jobs: [],
      });
      await pendingSubmission;
    });

    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      "Next prompt",
    );
  });

  it("clears a restored draft after real submission succeeds and before navigation", async () => {
    const order: string[] = [];
    setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitGeneration.mockImplementation(async () => {
      order.push("submit");
      return {
        submissionId: "submission_1",
        threadId: "thread_1",
        jobs: [],
      };
    });
    mocks.guestGenerationRestore.current.complete.mockImplementation(
      async () => {
        order.push("clear");
        return true;
      },
    );
    mocks.navigate.mockImplementation(async () => {
      order.push("navigate");
    });

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(order).toEqual(["submit", "clear", "navigate"]);
    });
  });

  it("does not clear a restored draft when real submission fails", async () => {
    setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.submitGeneration.mockRejectedValueOnce(new Error("Upload failed"));

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith("Upload failed");
    });
    expect(
      mocks.guestGenerationRestore.current.complete,
    ).not.toHaveBeenCalled();
  });

  it("keeps a successful submission when browser cleanup fails", async () => {
    setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.guestGenerationRestore.current.complete.mockResolvedValue(false);

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "Submit generation" }));

    await waitFor(() => {
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app/threads/$threadId",
        params: { threadId: "thread_1" },
      });
    });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "Your generation was submitted, but its saved browser copy could not be removed.",
    );
  });

  it("uses global New Generation to discard and reset a restored draft", async () => {
    setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "New generation" }));

    await waitFor(() => {
      expect(
        mocks.guestGenerationRestore.current.discard,
      ).toHaveBeenCalledOnce();
      expect(mocks.navigate).toHaveBeenCalledWith({
        to: "/app",
        search: {},
      });
      expect(mocks.generationCommandContainer).toHaveBeenLastCalledWith(
        expect.objectContaining({
          generationAttachmentMedia: {
            audios: [],
            images: [],
            videos: [],
          },
          generationSettings: defaultSettings,
          prompt: "",
        }),
      );
    });
  });

  it("preserves a restored composer when explicit discard fails", async () => {
    const restoredDraft = setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;
    mocks.guestGenerationRestore.current.discard.mockResolvedValue(false);

    render(<AppBootstrap />);
    fireEvent.click(screen.getByRole("button", { name: "New generation" }));

    await waitFor(() => {
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Unable to discard your saved generation. Try again.",
      );
    });
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect((screen.getByLabelText("Prompt") as HTMLTextAreaElement).value).toBe(
      restoredDraft.prompt,
    );
  });

  it("selects a project for the restored draft without discarding it", () => {
    setRestoredGuestGeneration();
    setSignedIn();
    mocks.selection.current.models = [seedanceModel];
    mocks.selection.current.selectedModel = seedanceModel;

    render(<AppBootstrap />);
    mocks.appSidebar.mock.lastCall?.[0].onNewGenerationInProject("project_1");

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/app",
      search: { projectId: "project_1" },
    });
    expect(mocks.guestGenerationRestore.current.discard).not.toHaveBeenCalled();
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

  it("retains composer state and resets model-specific state on model change", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Change settings" }));

    await waitFor(() => {
      expect(
        mocks.generationCommandContainer.mock.lastCall?.[0]
          .generationAttachmentMedia.images[0]?.file.name,
      ).toBe("reference.png");
      expect(
        mocks.generationCommandContainer.mock.lastCall?.[0].generationSettings,
      ).toEqual(
        expect.objectContaining({
          aspectRatio: "9:16",
          duration: 10,
          resolution: "1080p",
        }),
      );
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
      expect(
        mocks.generationCommandContainer.mock.lastCall?.[0].generationSettings,
      ).toEqual(defaultSettings);
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

  it("preserves an atomic prompt-builder draft across its model-change effect", async () => {
    const promptBuilderSettings = {
      modelType: "image",
      aspectRatio: "1:1",
      resolution: "1K",
      requestedGenerations: 1,
    } satisfies GenerationSettingsValue;
    setSignedIn();
    mocks.selection.current.models = [seedanceModel, nanoBananaModel];
    mocks.selection.current.selectedModel = seedanceModel;
    const rendered = render(<AppBootstrap />);

    fireEvent.click(
      screen.getByRole("button", { name: "Add test attachment" }),
    );
    const onPromptBuilderApply =
      mocks.generationCommandContainer.mock.lastCall?.[0].onPromptBuilderApply;

    act(() => {
      onPromptBuilderApply?.({
        model: nanoBananaModel,
        prompt: "A cinematic glass studio",
        settings: promptBuilderSettings,
      });
    });

    mocks.selection.current.selectedModel = nanoBananaModel;
    rendered.rerender(<AppBootstrap />);

    await waitFor(() => {
      const commandProps = mocks.generationCommandContainer.mock.lastCall?.[0];

      expect(commandProps?.prompt).toBe("A cinematic glass studio");
      expect(commandProps?.generationSettings).toEqual(promptBuilderSettings);
      expect(commandProps?.generationAttachmentMedia).toEqual({
        images: [],
        videos: [],
        audios: [],
      });
    });
    expect(mocks.selection.current.setSelectedModel).toHaveBeenCalledWith(
      nanoBananaModel,
    );
  });
});

function AppBootstrap({
  initialGenerationPreset = null,
  initialPrompt = "",
  projectId = null,
  threadId = null,
}: {
  initialGenerationPreset?: GenerationWorkspacePreset | null;
  initialPrompt?: string;
  projectId?: string | null;
  threadId?: string | null;
}) {
  const { requestAuth, status, user } = mocks.authState.current;

  return (
    <WebGenerationWorkspace
      guestGenerationRestore={{
        complete: mocks.guestGenerationRestore.current.complete,
        discard: mocks.guestGenerationRestore.current.discard,
        draft: mocks.guestGenerationRestore.current.draft,
      }}
      initialGenerationPreset={initialGenerationPreset}
      initialPrompt={initialPrompt}
      isSignedIn={status === "signed-in" && Boolean(user)}
      modelSelection={mocks.selection.current as never}
      projectId={projectId}
      requestAuth={requestAuth}
      threadId={threadId}
      userId={user?.id ?? null}
    />
  );
}

function createEditableSubmission(): GenerationThreadSubmission {
  return {
    id: "submission_editable",
    threadId: "thread_1",
    userId: "user_1",
    modelId: "seedance-2.0-video",
    modelDisplayName: "Seedance 2.0",
    modelType: "video",
    modelSpecId: "seedance-2.0-video-v1",
    submittedInput: {
      prompt: "Restore this prompt",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      draft: false,
    },
    requestedGenerations: 1,
    attachmentMedia: { images: [], videos: [], audios: [] },
    createdAt: "2026-06-15T11:00:00.000Z",
    updatedAt: "2026-06-15T11:00:00.000Z",
    jobs: [],
  };
}

function setSignedIn() {
  mocks.authState.current.status = "signed-in";
  mocks.authState.current.user = {
    id: "user_1",
    name: "Remora User",
    email: "user@example.com",
    role: "user",
    image: null,
  };
}

function setRestoredGuestGeneration() {
  const draft = {
    attachmentMedia: {
      audios: [],
      images: [
        {
          source: "local" as const,
          file: new File(["restored"], "restored-reference.png", {
            type: "image/png",
          }),
          role: "reference" as const,
        },
      ],
      videos: [],
    },
    model: seedanceModel,
    prompt: "A restored moonlit glass studio",
    settings: defaultSettings,
  };

  mocks.guestGenerationRestore.current.draft = draft;

  return draft;
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

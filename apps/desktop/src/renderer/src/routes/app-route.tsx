import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import { toast } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  AppSidebar,
  type ProjectThreadRevealRequest,
} from "../components/app-sidebar/app-sidebar.tsx";
import { CreateProjectDialog } from "../components/app-sidebar/create-project-dialog.tsx";
import { GenerationCommandContainer } from "../components/generation-composer/generation-command-container.tsx";
import { AttachmentMediaPreview } from "../components/generation-composer/attachment-media-preview.tsx";
import {
  GenerationResultsSurface,
  type GenerationResultsActivePanel,
} from "../components/generation-submission/generation-results.tsx";
import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import {
  getDefaultGenerationSettings,
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
  type GenerationSettingsValue,
} from "../lib/generation/index.ts";
import { getPublicAssetUrl } from "../lib/public-asset.ts";
import {
  createEmptyGenerationAttachmentMediaValue,
  hasGenerationAttachmentMediaValidationIssues,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import { getUserFacingErrorMessage, isAppTRPCError } from "../lib/error.ts";
import { useTRPC } from "../lib/trpc.ts";
import {
  useCreateGenerationSubmissionMutation,
  type GenerationSubmissionTarget,
} from "../modules/generation/use-create-generation-submission-mutation.ts";
import { useAuth } from "../providers/auth-provider.tsx";
import { useHotkey } from "../providers/hotkeys-provider.tsx";

const modelStaleTimeMs = 5 * 60 * 1000;
const remoraLogoImageUrl = getPublicAssetUrl("logo.svg");

type ComposerPlacement = "centered" | "docked";

export function AppRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { threadId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const selectedThreadId = typeof threadId === "string" ? threadId : null;
  const newGenerationProjectId =
    !selectedThreadId &&
    "projectId" in search &&
    typeof search.projectId === "string"
      ? search.projectId
      : null;
  const generationStackPanelId = useId();
  const generationAttachmentMediaPanelId = useId();
  const generationComposerLayoutRef = useRef<HTMLDivElement | null>(null);
  const [activeGenerationPanel, setActiveGenerationPanel] =
    useState<GenerationResultsActivePanel | null>(null);
  const [
    generationComposerMeasuredHeight,
    setGenerationComposerMeasuredHeight,
  ] = useState(0);
  const [selectedModel, setSelectedModel] =
    useState<PublishedGenerationModelSummary | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] =
    useState(false);
  const [projectThreadRevealRequest, setProjectThreadRevealRequest] =
    useState<ProjectThreadRevealRequest | null>(null);
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettingsValue | null>(null);
  const [generationAttachmentMedia, setGenerationAttachmentMedia] =
    useState<GenerationAttachmentMediaValue>(() =>
      createEmptyGenerationAttachmentMediaValue(),
    );
  const {
    clearPendingFreshThreadSubmission,
    isPending: isSubmitPending,
    pendingFreshThreadSubmission,
    submitGeneration,
  } = useCreateGenerationSubmissionMutation();
  const modelListQueryOptions = trpc.model.listPublished.queryOptions(
    undefined,
    {
      enabled: status === "signed-in",
      staleTime: modelStaleTimeMs,
    },
  );
  const threadListQueryOptions =
    trpc.generationThread.listWithoutProject.queryOptions(undefined, {
      enabled: status === "signed-in",
    });
  const projectListQueryOptions = trpc.project.listProjects.queryOptions(
    undefined,
    {
      enabled: status === "signed-in",
    },
  );
  const { data: models = [] } = useQuery(modelListQueryOptions);
  const { data: threadsWithoutProject = [] } = useQuery(threadListQueryOptions);
  const { data: projects = [] } = useQuery(projectListQueryOptions);
  const selectedNewGenerationProject = newGenerationProjectId
    ? (projects.find((project) => project.id === newGenerationProjectId) ??
      null)
    : null;
  const selectedThreadProject = selectedThreadId
    ? (projects.find((project) =>
        project.threads.some((thread) => thread.id === selectedThreadId),
      ) ?? null)
    : null;
  const selectedProject = selectedThreadId
    ? selectedThreadProject
    : selectedNewGenerationProject;
  const selectedProjectId = selectedThreadId
    ? (selectedThreadProject?.id ?? null)
    : newGenerationProjectId;

  const effectiveComposerPlacement: ComposerPlacement =
    selectedThreadId || isSubmitPending ? "docked" : "centered";
  const shouldShowProjectSelector = true;
  const isProjectSelectorDisabled =
    Boolean(selectedThreadId) || isSubmitPending;
  const isGenerationPanelOpen = Boolean(activeGenerationPanel);
  const isLogoAccessible = effectiveComposerPlacement === "centered";
  const generationStageStyle =
    generationComposerMeasuredHeight > 0
      ? ({
          "--remora-generation-composer-measured-height": `${generationComposerMeasuredHeight}px`,
        } as CSSProperties)
      : undefined;
  const hasAttachmentMediaValidationIssues = selectedModel
    ? hasGenerationAttachmentMediaValidationIssues(
        selectedModel,
        generationAttachmentMedia,
      )
    : false;

  const canSubmit =
    Boolean(selectedModel) &&
    Boolean(generationSettings) &&
    prompt.trim().length > 0 &&
    (!newGenerationProjectId || Boolean(selectedNewGenerationProject)) &&
    !hasAttachmentMediaValidationIssues &&
    !isSubmitPending;

  async function handleSubmit() {
    if (!selectedModel || !generationSettings || !user || !canSubmit) {
      return;
    }

    const submittedPrompt = prompt;
    const submittedSettings = generationSettings;
    const submittedAttachmentMedia = generationAttachmentMedia;
    const submittedModel = selectedModel;
    const target: GenerationSubmissionTarget = selectedThreadId
      ? { kind: "existing-thread", threadId: selectedThreadId }
      : { kind: "new-thread", projectId: newGenerationProjectId };

    try {
      setPrompt("");
      setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());

      const createdSubmission = await submitGeneration({
        model: submittedModel,
        prompt: submittedPrompt,
        attachmentMedia: submittedAttachmentMedia,
        settings: submittedSettings,
        target,
        userId: user.id,
      });

      if (target.kind === "existing-thread") return;

      if (target.projectId) {
        setProjectThreadRevealRequest({
          projectId: target.projectId,
          threadId: createdSubmission.threadId,
        });
      }

      await navigate({
        to: "/app/threads/$threadId",
        params: { threadId: createdSubmission.threadId },
      });
    } catch (error) {
      setPrompt(submittedPrompt);
      setGenerationSettings(submittedSettings);
      setGenerationAttachmentMedia(submittedAttachmentMedia);

      if (!isAppTRPCError(error)) {
        toast.error(
          getUserFacingErrorMessage(
            error,
            "Could not create submission. Please try again.",
          ),
        );
      }
    }
  }

  function handleNewGeneration() {
    void navigate({ to: "/app", search: {} });
  }

  function handleNewGenerationInProject(projectId: string) {
    void navigate({ to: "/app", search: { projectId } });
  }

  function handleCreateProject() {
    setIsCreateProjectDialogOpen(true);
  }

  function handleSelectThread(nextThreadId: string) {
    void navigate({
      to: "/app/threads/$threadId",
      params: { threadId: nextThreadId },
    });
  }

  function handleGenerationPanelToggle(
    panel: GenerationResultsActivePanel | null,
  ) {
    setActiveGenerationPanel((currentPanel) =>
      currentPanel &&
      panel &&
      currentPanel.kind === panel.kind &&
      currentPanel.submissionId === panel.submissionId
        ? null
        : panel,
    );
  }

  function handlePromptChange(nextPrompt: string) {
    setPrompt(nextPrompt);
  }

  function handleGenerationSettingsChange(
    nextSettings: GenerationSettingsValue,
  ) {
    setGenerationSettings(nextSettings);
  }

  function handleGenerationAttachmentMediaChange(
    nextAttachmentMedia: GenerationAttachmentMediaValue,
  ) {
    setGenerationAttachmentMedia(nextAttachmentMedia);
  }

  function handleSelectedModelChange(
    nextModel: PublishedGenerationModelSummary | null,
  ) {
    setSelectedModel(nextModel);
  }

  useHotkey("app.newGeneration", {
    allowInEditable: true,
    onKeyDown: handleNewGeneration,
  });

  useHotkey("app.createProject", {
    allowInEditable: true,
    onKeyDown: handleCreateProject,
  });

  useHotkey("generation.closeStackPanel", {
    allowInEditable: true,
    enabled: isGenerationPanelOpen,
    onKeyDown: () => setActiveGenerationPanel(null),
  });

  useLayoutEffect(() => {
    function measureComposerLayoutHeight() {
      const composerLayout = generationComposerLayoutRef.current;

      if (!composerLayout) {
        return;
      }

      const measuredHeight = Math.ceil(
        composerLayout.getBoundingClientRect().height,
      );

      if (measuredHeight <= 0) {
        return;
      }

      setGenerationComposerMeasuredHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight,
      );
    }

    measureComposerLayoutHeight();

    const composerLayout = generationComposerLayoutRef.current;
    const Observer = window.ResizeObserver;
    const resizeObserver =
      typeof Observer === "function"
        ? new Observer(measureComposerLayoutHeight)
        : null;

    if (composerLayout) {
      resizeObserver?.observe(composerLayout);
    }

    window.addEventListener("resize", measureComposerLayoutHeight);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureComposerLayoutHeight);
    };
  }, [
    effectiveComposerPlacement,
    generationSettings,
    selectedModel,
    shouldShowProjectSelector,
  ]);

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    setGenerationSettings(getDefaultGenerationSettings(selectedModel));
    // TODO: We can improve the UX here by checking if the new model accepts any of the same type of attachment media as the previous model.
    setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());
  }, [selectedModel]);

  useEffect(() => {
    setActiveGenerationPanel(null);
    if (selectedThreadId) {
      clearPendingFreshThreadSubmission();
    }
  }, [clearPendingFreshThreadSubmission, selectedThreadId]);

  return (
    <AppWorkspaceLayout
      data-auth-status={status}
      data-user-id={user?.id}
      sidebar={
        <AppSidebar
          projectThreadRevealRequest={projectThreadRevealRequest}
          selectedThreadId={selectedThreadId}
          threads={threadsWithoutProject}
          projects={projects}
          onCreateProject={handleCreateProject}
          onNewGeneration={handleNewGeneration}
          onNewGenerationInProject={handleNewGenerationInProject}
          onSelectThread={handleSelectThread}
        />
      }
    >
      <CreateProjectDialog
        open={isCreateProjectDialogOpen}
        onOpenChange={setIsCreateProjectDialogOpen}
      />
      <div
        className="remora-generation-composer-stage relative isolate h-[max(28rem,calc(100vh_-_var(--remora-titlebar-height)))] min-h-[max(28rem,calc(100vh_-_var(--remora-titlebar-height)))] w-full overflow-hidden"
        data-placement={effectiveComposerPlacement}
        data-testid="generation-composer-stage"
        style={generationStageStyle}
      >
        <GenerationResultsSurface
          activePanel={activeGenerationPanel}
          pendingFreshThreadSubmission={pendingFreshThreadSubmission}
          attachmentMediaPanelId={generationAttachmentMediaPanelId}
          stackPanelId={generationStackPanelId}
          threadId={selectedThreadId}
          onActivePanelToggle={handleGenerationPanelToggle}
        />
        <img
          src={remoraLogoImageUrl}
          alt={isLogoAccessible ? "Remora" : ""}
          aria-hidden={isLogoAccessible ? undefined : "true"}
          className="pointer-events-none absolute left-1/2 z-[1] h-auto w-[min(20.5rem,calc(100%_-_3rem))] -translate-x-1/2 transition-[top,translate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,translate] select-none data-[placement=centered]:top-[calc(50%_-_10.5rem)] data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset)_-_var(--remora-generation-composer-block-height)_+_1rem)] motion-reduce:transition-none"
          data-placement={effectiveComposerPlacement}
          draggable={false}
        />
        <div
          className="absolute left-1/2 z-[3] w-[var(--remora-generation-content-width)] -translate-x-1/2 transition-[top,translate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,translate] data-[placement=centered]:top-1/2 data-[placement=centered]:translate-y-[-8%] data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset))] data-[placement=docked]:-translate-y-full motion-reduce:transition-none"
          data-placement={effectiveComposerPlacement}
          data-testid="generation-composer"
        >
          <div
            ref={generationComposerLayoutRef}
            className={[
              "relative isolate w-full",
              multiGenerationPanelShiftClassName,
            ].join(" ")}
            data-stack-panel-state={isGenerationPanelOpen ? "open" : "closed"}
            data-slot="generation-composer-layout"
            style={{
              transform: getMultiGenerationPanelShiftTransform(
                isGenerationPanelOpen,
              ),
            }}
          >
            {effectiveComposerPlacement === "docked" ? (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[var(--remora-generation-results-bottom-reserve)] bg-[var(--remora-stage-background)]"
                data-slot="generation-composer-dock-occlusion"
              />
            ) : null}

            <AttachmentMediaPreview
              selectedModel={selectedModel}
              value={generationAttachmentMedia}
              onValueChange={handleGenerationAttachmentMediaChange}
            />

            <GenerationCommandContainer
              canSubmit={canSubmit}
              models={models}
              prompt={prompt}
              selectedModel={selectedModel}
              projects={projects}
              selectedProject={selectedProject}
              selectedProjectId={selectedProjectId}
              projectSelectorDisabled={isProjectSelectorDisabled}
              showProjectSelector={shouldShowProjectSelector}
              generationAttachmentMedia={generationAttachmentMedia}
              generationSettings={generationSettings}
              onClearProject={handleNewGeneration}
              onGenerationAttachmentMediaChange={
                handleGenerationAttachmentMediaChange
              }
              onGenerationSettingsChange={handleGenerationSettingsChange}
              onPromptChange={handlePromptChange}
              onSelectProject={handleNewGenerationInProject}
              onSelectedModelChange={handleSelectedModelChange}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    </AppWorkspaceLayout>
  );
}

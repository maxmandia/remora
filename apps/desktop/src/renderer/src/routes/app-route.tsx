import { useAuth } from "@remora/app/auth";
import {
  createEmptyGenerationAttachmentMediaValue,
  GenerationCommandContainer,
  GenerationWorkspaceStage,
  getDefaultGenerationSettings,
  hasGenerationAttachmentMediaValidationIssues,
  useCreateGenerationSubmissionMutation,
  useGenerationModelSelection,
  useGenerationProjectSelection,
  useGenerationResultsPanelController,
  type GenerationSubmissionTarget,
  type GenerationAttachmentMediaValue,
  type GenerationSettingsValue,
} from "@remora/app/generation";
import { useHotkey } from "@remora/app/hotkeys";
import { getUserFacingErrorMessage, isAppTRPCError } from "@remora/app/query";
import { useTRPC } from "@remora/app/trpc";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { toast } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AppSidebar,
  type ProjectThreadRevealRequest,
} from "../components/app-sidebar/app-sidebar.tsx";
import { CreateProjectDialog } from "../components/app-sidebar/create-project-dialog.tsx";
import { GenerationResultsSurface } from "../components/generation-submission/generation-results.tsx";
import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import { getPublicAssetUrl } from "../lib/public-asset.ts";
import { uploadGenerationAttachmentMediaFile } from "../modules/generation/generation-attachment-media-file-uploader.ts";

const remoraLogoImageUrl = getPublicAssetUrl("logo.svg");

export function AppRoute() {
  const { status, user } = useAuth();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const { threadId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const selectedThreadId = typeof threadId === "string" ? threadId : null;
  const {
    activePanel: activeGenerationPanel,
    attachmentMediaPanelId: generationAttachmentMediaPanelId,
    isPanelOpen: isGenerationPanelOpen,
    stackPanelId: generationStackPanelId,
    togglePanel: toggleGenerationPanel,
  } = useGenerationResultsPanelController({
    scopeKey: selectedThreadId,
  });
  const newGenerationProjectId =
    !selectedThreadId &&
    "projectId" in search &&
    typeof search.projectId === "string"
      ? search.projectId
      : null;
  const { models, selectedModel, setSelectedModel } =
    useGenerationModelSelection();
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
  } = useCreateGenerationSubmissionMutation({
    uploadAttachmentMediaFile: uploadGenerationAttachmentMediaFile,
  });
  const threadListQueryOptions =
    trpc.generationThread.listWithoutProject.queryOptions(undefined, {
      enabled: status === "signed-in",
    });
  const { data: threadsWithoutProject = [] } = useQuery(threadListQueryOptions);
  const {
    isSelectedProjectResolved,
    projects,
    selectedProject,
    selectedProjectId,
  } = useGenerationProjectSelection({
    requestedProjectId: newGenerationProjectId,
    threadId: selectedThreadId,
  });

  const effectiveComposerPlacement =
    selectedThreadId || isSubmitPending ? "docked" : "centered";
  const isProjectSelectorDisabled =
    Boolean(selectedThreadId) || isSubmitPending;
  const hasAttachmentMediaValidationIssues = selectedModel
    ? hasGenerationAttachmentMediaValidationIssues(
        selectedModel,
        generationAttachmentMedia,
      )
    : false;

  const canSubmit =
    Boolean(selectedModel) &&
    Boolean(generationSettings) &&
    selectedModel?.type === generationSettings?.modelType &&
    prompt.trim().length > 0 &&
    isSelectedProjectResolved &&
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
      <GenerationWorkspaceStage
        branding={{ alt: "Remora", src: remoraLogoImageUrl }}
        className="h-[max(28rem,calc(100vh_-_var(--remora-titlebar-height)))] min-h-[max(28rem,calc(100vh_-_var(--remora-titlebar-height)))]"
        composer={
          <GenerationCommandContainer
            canSubmit={canSubmit}
            models={models}
            prompt={prompt}
            selectedModel={selectedModel}
            projects={projects}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
            projectSelectorDisabled={isProjectSelectorDisabled}
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
        }
        isSupplementalOpen={isGenerationPanelOpen}
        placement={effectiveComposerPlacement}
        results={
          <GenerationResultsSurface
            activePanel={activeGenerationPanel}
            attachmentMediaPanelId={generationAttachmentMediaPanelId}
            pendingFreshThreadSubmission={pendingFreshThreadSubmission}
            stackPanelId={generationStackPanelId}
            threadId={selectedThreadId}
            onActivePanelToggle={toggleGenerationPanel}
          />
        }
      />
    </AppWorkspaceLayout>
  );
}

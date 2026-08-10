import {
  createEmptyGenerationAttachmentMediaValue,
  GenerationCommandContainer,
  GenerationCreativeCategoryCtas,
  GenerationResultsSurface,
  GenerationWorkspaceStage,
  getDefaultGenerationSettings,
  getGenerationWorkspacePresetSettings,
  hasGenerationAttachmentMediaValidationIssues,
  useCreateGenerationSubmissionMutation,
  useGeneratedImageAttachment,
  useGenerationModelSelection,
  useGenerationProjectSelection,
  useGenerationResultsPanelController,
  useGenerationWorkspaceReferenceMedia,
  type GenerationAttachmentMediaValue,
  type PromptBuilderAppliedDraft,
  type GenerationSettingsValue,
  type GenerationWorkspacePreset,
} from "@remora/app/generation";
import { useHotkey } from "@remora/app/hotkeys";
import { CreateProjectDialog, RenameProjectDialog } from "@remora/app/project";
import { getUserFacingErrorMessage, isAppTRPCError } from "@remora/app/query";
import {
  AppSidebar,
  AppSidebarFooter,
  type ProjectThreadRevealRequest,
} from "@remora/app/sidebar";
import { useTRPC } from "@remora/app/trpc";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { toast } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useGuestGenerationPreview } from "../hooks/use-guest-generation-preview";
import { useWebPreferencesStore } from "../stores/preferences-store";
import { useWebGeneratedImageContextMenu } from "../hooks/use-web-generated-image-context-menu";
import { trackGuestGenerationAnalyticsEvent } from "../lib/analytics";
import {
  GenerationAttachmentMediaUploadError,
  uploadGenerationAttachmentMediaFile,
} from "../lib/generation-attachment-media-file-uploader";
import { loadGeneratedImageFile } from "../lib/generated-image-file";
import type { GuestGenerationDraftInput } from "../lib/guest-generation-draft";
import { GuestGenerationAuthDialog } from "./guest-generation-auth-dialog";
import { GuestGenerationPreviewResults } from "./guest-generation-preview-results";
import { WebAppWorkspaceLayout } from "./web-app-workspace-layout";

export type GuestGenerationRestoreOperations = {
  complete: () => Promise<boolean>;
  discard: () => Promise<boolean>;
  draft: GuestGenerationDraftInput | null;
};

export function WebGenerationWorkspace({
  guestGenerationRestore,
  initialGenerationPreset = null,
  initialPrompt = "",
  isSignedIn,
  modelSelection,
  projectId,
  requestAuth,
  threadId,
  userId,
}: {
  guestGenerationRestore: GuestGenerationRestoreOperations;
  initialGenerationPreset?: GenerationWorkspacePreset | null;
  initialPrompt?: string;
  isSignedIn: boolean;
  modelSelection: ReturnType<typeof useGenerationModelSelection>;
  projectId: string | null;
  requestAuth: () => Promise<void>;
  threadId: string | null;
  userId: string | null;
}) {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const activeProjectId = isSignedIn ? projectId : null;
  const activeThreadId = isSignedIn ? threadId : null;
  const {
    activePanel,
    attachmentMediaPanelId,
    isPanelOpen,
    stackPanelId,
    togglePanel,
  } = useGenerationResultsPanelController({ scopeKey: activeThreadId });
  const { models, selectedModel, setSelectedModel } = modelSelection;
  const {
    isSelectedProjectResolved,
    projects,
    selectedProject,
    selectedProjectId,
  } = useGenerationProjectSelection({
    requestedProjectId: activeThreadId ? null : activeProjectId,
    threadId: activeThreadId,
  });
  const initialGuestGenerationDraft = guestGenerationRestore.draft;
  const [prompt, setPrompt] = useState(
    () => initialGuestGenerationDraft?.prompt ?? initialPrompt,
  );
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] =
    useState(false);
  const [projectToRename, setProjectToRename] = useState<ProjectSummary | null>(
    null,
  );
  const [projectThreadRevealRequest, setProjectThreadRevealRequest] =
    useState<ProjectThreadRevealRequest | null>(null);
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettingsValue | null>(
      () =>
        initialGuestGenerationDraft?.settings ??
        getGenerationWorkspacePresetSettings(
          selectedModel,
          initialGenerationPreset,
        ) ??
        getDefaultGenerationSettings(selectedModel),
    );
  const [generationAttachmentMedia, setGenerationAttachmentMedia] =
    useState<GenerationAttachmentMediaValue>(
      () =>
        initialGuestGenerationDraft?.attachmentMedia ??
        createEmptyGenerationAttachmentMediaValue(),
    );
  const referenceMediaState = useGenerationWorkspaceReferenceMedia({
    enabled:
      !initialGuestGenerationDraft &&
      !activeThreadId &&
      selectedModel?.id === initialGenerationPreset?.modelId,
    preset: initialGenerationPreset,
    setValue: setGenerationAttachmentMedia,
  });
  const generatedImageAttachment = useGeneratedImageAttachment({
    loadFile: loadGeneratedImageFile,
    selectedModel,
    setValue: setGenerationAttachmentMedia,
    value: generationAttachmentMedia,
  });
  const generatedImageContextMenu = useWebGeneratedImageContextMenu(
    generatedImageAttachment,
  );
  const previousSelectedModelIdRef = useRef(selectedModel?.id ?? null);
  const pendingPromptBuilderModelIdRef = useRef<string | null>(null);
  const pendingRestoredModelIdRef = useRef(
    initialGuestGenerationDraft &&
      initialGuestGenerationDraft.model.id !== selectedModel?.id
      ? initialGuestGenerationDraft.model.id
      : null,
  );
  const guestGenerationDraft =
    selectedModel && generationSettings
      ? ({
          attachmentMedia: generationAttachmentMedia,
          model: selectedModel,
          prompt,
          settings: generationSettings,
        } satisfies GuestGenerationDraftInput)
      : null;
  const {
    canSubmit: canSubmitGuestGeneration,
    isAuthDialogOpen: isGuestGenerationAuthDialogOpen,
    isInteractionLocked: isGuestGenerationInteractionLocked,
    previewDraft: guestGenerationPreviewDraft,
    reset: resetGuestGenerationPreview,
    submit: submitGuestGenerationPreview,
  } = useGuestGenerationPreview({
    draft: guestGenerationDraft,
    enabled: !isSignedIn,
    onSubmitted: trackGuestGenerationPreviewSubmitted,
  });
  const {
    clearPendingFreshThreadSubmission,
    isPending: isSubmitPending,
    pendingFreshThreadSubmission,
    submitGeneration,
  } = useCreateGenerationSubmissionMutation({
    uploadAttachmentMediaFile: uploadGenerationAttachmentMediaFile,
  });
  const { data: queriedThreadsWithoutProject = [] } = useQuery(
    trpc.generationThread.listWithoutProject.queryOptions(undefined, {
      enabled: isSignedIn,
    }),
  );
  const threadsWithoutProject = isSignedIn ? queriedThreadsWithoutProject : [];
  const hasAttachmentMediaValidationIssues = selectedModel
    ? hasGenerationAttachmentMediaValidationIssues(
        selectedModel,
        generationAttachmentMedia,
      )
    : false;
  const canSubmitAuthenticatedGeneration =
    Boolean(userId) &&
    Boolean(selectedModel) &&
    Boolean(generationSettings) &&
    selectedModel?.type === generationSettings?.modelType &&
    prompt.trim().length > 0 &&
    isSelectedProjectResolved &&
    !hasAttachmentMediaValidationIssues &&
    !isSubmitPending;
  const canSubmit = isSignedIn
    ? canSubmitAuthenticatedGeneration &&
      referenceMediaState.status !== "loading" &&
      referenceMediaState.status !== "error"
    : canSubmitGuestGeneration &&
      referenceMediaState.status !== "loading" &&
      referenceMediaState.status !== "error";
  const hasResults = isSignedIn
    ? Boolean(activeThreadId || pendingFreshThreadSubmission)
    : Boolean(guestGenerationPreviewDraft);
  const showWelcomeContent = !hasResults;
  const hasRestoredGuestGenerationDraft = Boolean(guestGenerationRestore.draft);
  const [isWizardEntranceActive, setIsWizardEntranceActive] = useState(false);
  const [isWizardCalloutVisible, setIsWizardCalloutVisible] = useState(false);

  // Activated after hydration instead of in the state initializer so the
  // server and client render the same initial markup. Thread and result views
  // skip the entrance without consuming the flag, so it still plays the
  // first time this browser sees the welcome experience.
  useLayoutEffect(() => {
    if (
      !hasResults &&
      !useWebPreferencesStore.getState().hasSeenWizardEntrance
    ) {
      setIsWizardEntranceActive(true);
    }
  }, []);

  function handleWizardEntranceComplete() {
    useWebPreferencesStore.getState().markWizardEntranceSeen();
    setIsWizardEntranceActive(false);
    setIsWizardCalloutVisible(true);
  }

  useEffect(() => {
    if (!isSignedIn) {
      void trackGuestGenerationAnalyticsEvent({
        type: "guest_generation_workspace_viewed",
      });
    }
  }, [isSignedIn]);

  async function handleSubmit() {
    if (!isSignedIn) {
      await submitGuestGenerationPreview();
      return;
    }

    if (!selectedModel || !generationSettings || !userId || !canSubmit) {
      return;
    }

    const submittedPrompt = prompt;
    const submittedSettings = generationSettings;
    const submittedAttachmentMedia = generationAttachmentMedia;

    try {
      const target = activeThreadId
        ? ({ kind: "existing-thread", threadId: activeThreadId } as const)
        : ({ kind: "new-thread", projectId: selectedProjectId } as const);
      const createdSubmission = await submitGeneration({
        model: selectedModel,
        prompt: submittedPrompt,
        attachmentMedia: submittedAttachmentMedia,
        settings: submittedSettings,
        target,
        userId,
      });

      if (hasRestoredGuestGenerationDraft) {
        const cleared = await guestGenerationRestore.complete();

        if (!cleared) {
          toast.error(
            "Your generation was submitted, but its saved browser copy could not be removed.",
          );
        }
      }

      if (target.kind === "new-thread") {
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
      }
    } catch (submissionError) {
      if (
        submissionError instanceof GenerationAttachmentMediaUploadError &&
        submissionError.status === 401
      ) {
        void requestAuth();
        return;
      }

      if (!isAppTRPCError(submissionError)) {
        toast.error(
          getUserFacingErrorMessage(
            submissionError,
            "Could not create submission. Please try again.",
          ),
        );
      }
    }
  }

  function createGuestGenerationAccount() {
    void navigate({
      to: "/sign-up",
      search: { guestGeneration: true, redirect: "/app" },
    });
  }

  function signInForGuestGeneration() {
    void navigate({
      to: "/sign-in",
      search: { guestGeneration: true, redirect: "/app" },
    });
  }

  function handleClearProject() {
    void navigate({ to: "/app", search: {} });
  }

  function handleSelectProject(nextProjectId: string) {
    handleNewGenerationInProject(nextProjectId);
  }

  function handlePromptBuilderApply(draft: PromptBuilderAppliedDraft) {
    if (selectedModel?.id !== draft.model.id) {
      pendingPromptBuilderModelIdRef.current = draft.model.id;
      setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());
    }

    setPrompt(draft.prompt);
    setGenerationSettings(draft.settings);
    setSelectedModel(draft.model);
  }

  async function handleNewGeneration() {
    if (hasRestoredGuestGenerationDraft) {
      if (isSubmitPending) {
        return;
      }

      const discarded = await guestGenerationRestore.discard();

      if (!discarded) {
        toast.error("Unable to discard your saved generation. Try again.");
        return;
      }

      setPrompt("");
      setGenerationSettings(getDefaultGenerationSettings(selectedModel));
      setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());
    }

    void navigate({ to: "/app", search: {} });
  }

  function handleNewGenerationInProject(nextProjectId: string) {
    void navigate({ to: "/app", search: { projectId: nextProjectId } });
  }

  function handleCreateProject() {
    if (!isSignedIn) {
      return;
    }

    setIsCreateProjectDialogOpen(true);
  }

  function handleRenameProject(project: ProjectSummary) {
    setProjectToRename(project);
  }

  function handleSelectThread(nextThreadId: string) {
    void navigate({
      to: "/app/threads/$threadId",
      params: { threadId: nextThreadId },
    });
  }

  function handleSelectCreativeCategory(category: "ads" | "art" | "film") {
    void navigate({
      to: "/explore/$category",
      params: { category },
    });
  }

  useHotkey("app.newGeneration", {
    allowInEditable: true,
    onKeyDown: () => void handleNewGeneration(),
  });

  useHotkey("app.createProject", {
    allowInEditable: true,
    enabled: isSignedIn,
    onKeyDown: handleCreateProject,
  });

  useEffect(() => {
    const selectedModelId = selectedModel?.id ?? null;

    if (previousSelectedModelIdRef.current === selectedModelId) {
      return;
    }

    previousSelectedModelIdRef.current = selectedModelId;

    if (pendingPromptBuilderModelIdRef.current === selectedModelId) {
      pendingPromptBuilderModelIdRef.current = null;
      return;
    }

    if (pendingRestoredModelIdRef.current === selectedModelId) {
      pendingRestoredModelIdRef.current = null;
      return;
    }

    pendingRestoredModelIdRef.current = null;
    setGenerationSettings(
      getGenerationWorkspacePresetSettings(
        selectedModel,
        initialGenerationPreset,
      ) ?? getDefaultGenerationSettings(selectedModel),
    );
    setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());
  }, [selectedModel]);

  useEffect(() => {
    if (activeThreadId) {
      clearPendingFreshThreadSubmission();
    }
  }, [activeThreadId, clearPendingFreshThreadSubmission]);

  return (
    <WebAppWorkspaceLayout
      sidebar={
        <AppSidebar
          createProjectDisabled={!isSignedIn}
          footer={
            isSignedIn ? (
              <AppSidebarFooter
                onOpenAdmin={() => navigate({ to: "/app/admin" })}
                onOpenCredits={() => navigate({ to: "/app/settings/credits" })}
              />
            ) : undefined
          }
          getThreadHref={getThreadHref}
          onCreateProject={handleCreateProject}
          onNewGeneration={handleNewGeneration}
          onNewGenerationInProject={handleNewGenerationInProject}
          onRenameProject={handleRenameProject}
          onSelectThread={handleSelectThread}
          projects={projects}
          projectThreadRevealRequest={projectThreadRevealRequest}
          selectedThreadId={activeThreadId}
          threads={threadsWithoutProject}
        />
      }
    >
      {isSignedIn ? (
        <CreateProjectDialog
          open={isCreateProjectDialogOpen}
          onOpenChange={setIsCreateProjectDialogOpen}
        />
      ) : null}
      {isSignedIn && projectToRename ? (
        <RenameProjectDialog
          open
          project={projectToRename}
          onOpenChange={(open) => {
            if (!open) {
              setProjectToRename(null);
            }
          }}
        />
      ) : null}
      <GenerationWorkspaceStage
        branding={
          showWelcomeContent
            ? { alt: "Remora", src: "/remora-wordmark.svg" }
            : undefined
        }
        centeredContent={
          showWelcomeContent ? (
            <GenerationCreativeCategoryCtas
              onSelectCategory={handleSelectCreativeCategory}
            />
          ) : undefined
        }
        composer={
          <div
            aria-disabled={isGuestGenerationInteractionLocked}
            data-guest-preview-locked={isGuestGenerationInteractionLocked}
            inert={isGuestGenerationInteractionLocked}
          >
            <GenerationCommandContainer
              canSubmit={canSubmit}
              referenceMediaState={referenceMediaState}
              requiresAffordability={isSignedIn}
              models={models}
              projects={projects}
              prompt={prompt}
              selectedModel={selectedModel}
              selectedProject={selectedProject}
              selectedProjectId={selectedProjectId}
              projectSelectorDisabled={
                !isSignedIn || Boolean(activeThreadId) || isSubmitPending
              }
              generationAttachmentMedia={generationAttachmentMedia}
              generationSettings={generationSettings}
              onClearProject={handleClearProject}
              onGenerationAttachmentMediaChange={setGenerationAttachmentMedia}
              onGenerationSettingsChange={setGenerationSettings}
              onPromptBuilderApply={handlePromptBuilderApply}
              onPromptChange={setPrompt}
              onSelectProject={handleSelectProject}
              onSelectedModelChange={setSelectedModel}
              onSubmit={() => void handleSubmit()}
              onWizardCalloutDismiss={() => setIsWizardCalloutVisible(false)}
              wizardCalloutVisible={isWizardCalloutVisible}
              wizardHidden={isWizardEntranceActive}
            />
          </div>
        }
        isSupplementalOpen={isPanelOpen}
        wizardEntranceActive={isWizardEntranceActive}
        onWizardEntranceComplete={handleWizardEntranceComplete}
        results={
          isSignedIn && hasResults ? (
            <GenerationResultsSurface
              activePanel={activePanel}
              attachmentMediaPanelId={attachmentMediaPanelId}
              pendingFreshThreadSubmission={pendingFreshThreadSubmission}
              stackPanelId={stackPanelId}
              threadId={activeThreadId}
              variant="overlay"
              generatedImageContextMenu={generatedImageContextMenu}
              onActivePanelToggle={togglePanel}
            />
          ) : guestGenerationPreviewDraft ? (
            <GuestGenerationPreviewResults
              guestGenerationPreviewDraft={guestGenerationPreviewDraft}
            />
          ) : undefined
        }
      />
      {isGuestGenerationAuthDialogOpen && guestGenerationPreviewDraft ? (
        <GuestGenerationAuthDialog
          open
          onClose={resetGuestGenerationPreview}
          onCreateAccount={createGuestGenerationAccount}
          onSignIn={signInForGuestGeneration}
        />
      ) : null}
    </WebAppWorkspaceLayout>
  );
}

function getThreadHref(threadId: string) {
  return `/app/threads/${encodeURIComponent(threadId)}`;
}

function trackGuestGenerationPreviewSubmitted(
  draft: GuestGenerationDraftInput,
) {
  void trackGuestGenerationAnalyticsEvent({
    type: "guest_generation_preview_submitted",
    attachmentCount: Object.values(draft.attachmentMedia).reduce(
      (count, attachments) => count + attachments.length,
      0,
    ),
    modelType: draft.model.type,
  });
}

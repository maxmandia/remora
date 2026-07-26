import { useAuth } from "@remora/app/auth";
import {
  createEmptyGenerationAttachmentMediaValue,
  GenerationCommandContainer,
  GenerationResultsSurface,
  GenerationWorkspaceStage,
  getDefaultGenerationSettings,
  hasGenerationAttachmentMediaValidationIssues,
  useCreateGenerationSubmissionMutation,
  useGenerationModelSelection,
  useGenerationProjectSelection,
  useGenerationResultsPanelController,
  type GenerationAttachmentMediaValue,
  type GenerationSettingsValue,
} from "@remora/app/generation";
import { useHotkey } from "@remora/app/hotkeys";
import { CreateProjectDialog } from "@remora/app/project";
import { getUserFacingErrorMessage, isAppTRPCError } from "@remora/app/query";
import {
  AppSidebar,
  AppSidebarFooter,
  type ProjectThreadRevealRequest,
} from "@remora/app/sidebar";
import { useTRPC } from "@remora/app/trpc";
import { toast } from "@remora/ui";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import {
  GenerationAttachmentMediaUploadError,
  uploadGenerationAttachmentMediaFile,
} from "../lib/generation-attachment-media-file-uploader";
import { WebAppWorkspaceLayout } from "./web-app-workspace-layout";

export function AppBootstrap({
  projectId = null,
  threadId = null,
}: {
  projectId?: string | null;
  threadId?: string | null;
}) {
  const { requestAuth, status, user } = useAuth();

  // TODO: Add a fullscreen loading page that actually looks presentable
  if (status === "loading") {
    return (
      <FullPageWorkspaceStatus>Resolving session...</FullPageWorkspaceStatus>
    );
  }

  if (status === "signed-out" || !user) {
    return <SignedOutRedirect requestAuth={requestAuth} />;
  }

  return (
    <AuthenticatedWorkspace
      requestAuth={requestAuth}
      projectId={projectId}
      threadId={threadId}
      userId={user.id}
    />
  );
}

function SignedOutRedirect({
  requestAuth,
}: {
  requestAuth: () => Promise<void>;
}) {
  useEffect(() => {
    void requestAuth();
  }, [requestAuth]);

  return (
    <FullPageWorkspaceStatus>Redirecting to sign in...</FullPageWorkspaceStatus>
  );
}

function AuthenticatedWorkspace({
  projectId,
  requestAuth,
  threadId,
  userId,
}: {
  projectId: string | null;
  requestAuth: () => Promise<void>;
  threadId: string | null;
  userId: string;
}) {
  const navigate = useNavigate();
  const trpc = useTRPC();
  const {
    activePanel,
    attachmentMediaPanelId,
    isPanelOpen,
    stackPanelId,
    togglePanel,
  } = useGenerationResultsPanelController({ scopeKey: threadId });
  const { error, isPending, models, retry, selectedModel, setSelectedModel } =
    useGenerationModelSelection();
  const {
    isSelectedProjectResolved,
    projects,
    selectedProject,
    selectedProjectId,
  } = useGenerationProjectSelection({
    requestedProjectId: threadId ? null : projectId,
    threadId,
  });
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
  const { data: threadsWithoutProject = [] } = useQuery(
    trpc.generationThread.listWithoutProject.queryOptions(),
  );
  const isUnauthorized = isUnauthorizedError(error);
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
  const hasResults = Boolean(threadId || pendingFreshThreadSubmission);
  const composerPlacement = hasResults ? "docked" : "centered";

  async function handleSubmit() {
    if (!selectedModel || !generationSettings || !canSubmit) {
      return;
    }

    const submittedPrompt = prompt;
    const submittedSettings = generationSettings;
    const submittedAttachmentMedia = generationAttachmentMedia;

    try {
      setPrompt("");
      setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());

      const target = threadId
        ? ({ kind: "existing-thread", threadId } as const)
        : ({ kind: "new-thread", projectId: selectedProjectId } as const);
      const createdSubmission = await submitGeneration({
        model: selectedModel,
        prompt: submittedPrompt,
        attachmentMedia: submittedAttachmentMedia,
        settings: submittedSettings,
        target,
        userId,
      });

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
      setPrompt(submittedPrompt);
      setGenerationSettings(submittedSettings);
      setGenerationAttachmentMedia(submittedAttachmentMedia);

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

  function handleClearProject() {
    handleNewGeneration();
  }

  function handleSelectProject(nextProjectId: string) {
    handleNewGenerationInProject(nextProjectId);
  }

  function handleNewGeneration() {
    void navigate({ to: "/app", search: {} });
  }

  function handleNewGenerationInProject(nextProjectId: string) {
    void navigate({ to: "/app", search: { projectId: nextProjectId } });
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

  useHotkey("app.newGeneration", {
    allowInEditable: true,
    onKeyDown: handleNewGeneration,
  });

  useHotkey("app.createProject", {
    allowInEditable: true,
    onKeyDown: handleCreateProject,
  });

  useEffect(() => {
    if (isUnauthorized) {
      void requestAuth();
    }
  }, [isUnauthorized, requestAuth]);

  useEffect(() => {
    setGenerationSettings(getDefaultGenerationSettings(selectedModel));
    setGenerationAttachmentMedia(createEmptyGenerationAttachmentMediaValue());
  }, [selectedModel]);

  useEffect(() => {
    if (threadId) {
      clearPendingFreshThreadSubmission();
    }
  }, [clearPendingFreshThreadSubmission, threadId]);

  return (
    <WebAppWorkspaceLayout
      sidebar={
        <AppSidebar
          footer={
            <AppSidebarFooter
              onOpenCredits={() => navigate({ to: "/app/settings/credits" })}
            />
          }
          getThreadHref={getThreadHref}
          onCreateProject={handleCreateProject}
          onNewGeneration={handleNewGeneration}
          onNewGenerationInProject={handleNewGenerationInProject}
          onSelectThread={handleSelectThread}
          projects={projects}
          projectThreadRevealRequest={projectThreadRevealRequest}
          selectedThreadId={threadId}
          threads={threadsWithoutProject}
        />
      }
    >
      <CreateProjectDialog
        open={isCreateProjectDialogOpen}
        onOpenChange={setIsCreateProjectDialogOpen}
      />
      {isPending ? (
        <WorkspaceStatus>Preparing workspace...</WorkspaceStatus>
      ) : isUnauthorized ? (
        <WorkspaceStatus>Redirecting to sign in...</WorkspaceStatus>
      ) : error ? (
        <WorkspaceStatus>
          <p>Unable to prepare the workspace.</p>
          <button type="button" onClick={() => void retry()}>
            Retry
          </button>
        </WorkspaceStatus>
      ) : (
        <GenerationWorkspaceStage
          branding={{ alt: "Remora", src: "/remora-wordmark.svg" }}
          composer={
            <GenerationCommandContainer
              canSubmit={canSubmit}
              models={models}
              projects={projects}
              prompt={prompt}
              selectedModel={selectedModel}
              selectedProject={selectedProject}
              selectedProjectId={selectedProjectId}
              projectSelectorDisabled={Boolean(threadId) || isSubmitPending}
              generationAttachmentMedia={generationAttachmentMedia}
              generationSettings={generationSettings}
              onClearProject={handleClearProject}
              onGenerationAttachmentMediaChange={setGenerationAttachmentMedia}
              onGenerationSettingsChange={setGenerationSettings}
              onPromptChange={setPrompt}
              onSelectProject={handleSelectProject}
              onSelectedModelChange={setSelectedModel}
              onSubmit={() => void handleSubmit()}
            />
          }
          isSupplementalOpen={isPanelOpen}
          placement={composerPlacement}
          results={
            hasResults ? (
              <GenerationResultsSurface
                activePanel={activePanel}
                attachmentMediaPanelId={attachmentMediaPanelId}
                pendingFreshThreadSubmission={pendingFreshThreadSubmission}
                stackPanelId={stackPanelId}
                threadId={threadId}
                variant="overlay"
                onActivePanelToggle={togglePanel}
              />
            ) : undefined
          }
        />
      )}
    </WebAppWorkspaceLayout>
  );
}

function WorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex h-full min-h-[28rem] items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </div>
  );
}

function FullPageWorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
}

function getThreadHref(threadId: string) {
  return `/app/threads/${encodeURIComponent(threadId)}`;
}

function isUnauthorizedError(error: unknown) {
  if (!error || typeof error !== "object" || !("data" in error)) {
    return false;
  }

  const data = error.data;

  if (!data || typeof data !== "object" || !("code" in data)) {
    return false;
  }

  return data.code === "UNAUTHORIZED";
}

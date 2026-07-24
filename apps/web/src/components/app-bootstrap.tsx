import { useAuth } from "@remora/app/auth";
import {
  createEmptyGenerationAttachmentMediaValue,
  GenerationCommandContainer,
  GenerationResultsSurface,
  getDefaultGenerationSettings,
  hasGenerationAttachmentMediaValidationIssues,
  useCreateGenerationSubmissionMutation,
  useGenerationModelSelection,
  type GenerationAttachmentMediaValue,
  type GenerationSettingsValue,
} from "@remora/app/generation";
import { getUserFacingErrorMessage, isAppTRPCError } from "@remora/app/query";
import { cn, toast } from "@remora/ui";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import {
  GenerationAttachmentMediaUploadError,
  uploadGenerationAttachmentMediaFile,
} from "../lib/generation-attachment-media-file-uploader";

export function AppBootstrap({
  threadId = null,
}: {
  threadId?: string | null;
}) {
  const { requestAuth, status, user } = useAuth();

  if (status === "loading") {
    return <p>Resolving session...</p>;
  }

  if (status === "signed-out" || !user) {
    return <SignedOutRedirect requestAuth={requestAuth} />;
  }

  return (
    <AuthenticatedWorkspace
      requestAuth={requestAuth}
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

  return <p>Redirecting to sign in...</p>;
}

function AuthenticatedWorkspace({
  requestAuth,
  threadId,
  userId,
}: {
  requestAuth: () => Promise<void>;
  threadId: string | null;
  userId: string;
}) {
  const navigate = useNavigate();
  const { error, isPending, models, retry, selectedModel, setSelectedModel } =
    useGenerationModelSelection();
  const [prompt, setPrompt] = useState("");
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
  const hasAttachmentMedia = Object.values(generationAttachmentMedia).some(
    (items) => items.length > 0,
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
    !hasAttachmentMediaValidationIssues &&
    !isSubmitPending;
  const hasResults = Boolean(threadId || pendingFreshThreadSubmission);

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
        : ({ kind: "new-thread", projectId: null } as const);
      const createdSubmission = await submitGeneration({
        model: selectedModel,
        prompt: submittedPrompt,
        attachmentMedia: submittedAttachmentMedia,
        settings: submittedSettings,
        target,
        userId,
      });

      if (target.kind === "new-thread") {
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

  if (isPending) {
    return <WorkspaceStatus>Preparing workspace...</WorkspaceStatus>;
  }

  if (isUnauthorized) {
    return <WorkspaceStatus>Redirecting to sign in...</WorkspaceStatus>;
  }

  if (error) {
    return (
      <WorkspaceStatus>
        <p>Unable to prepare the workspace.</p>
        <button type="button" onClick={() => void retry()}>
          Retry
        </button>
      </WorkspaceStatus>
    );
  }

  return (
    <main
      aria-label="Generation workspace"
      className={cn(
        "bg-background text-foreground min-h-svh",
        hasResults
          ? "flex h-svh flex-col overflow-hidden"
          : "flex items-center justify-center px-6 py-8",
      )}
    >
      <section
        className={cn(
          "flex w-full flex-col",
          hasResults ? "h-full min-h-0" : "max-w-4xl gap-5",
        )}
      >
        {hasResults ? (
          <div className="mx-auto min-h-0 w-full max-w-5xl flex-1 overflow-y-auto px-6 py-8">
            <GenerationResultsSurface
              pendingFreshThreadSubmission={pendingFreshThreadSubmission}
              threadId={threadId}
              variant="flow"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <h1 className="text-lg font-medium">Create a generation</h1>
            <p className="text-secondary-foreground text-sm font-light">
              Describe what you want to create.
            </p>
          </div>
        )}
        <div
          className={cn(
            "data-[has-attachment-media=true]:mt-16",
            hasResults &&
              "bg-background/95 sticky bottom-0 z-10 mt-auto border-t border-white/5 px-6 py-5 backdrop-blur-sm",
          )}
          data-has-attachment-media={hasAttachmentMedia}
          data-slot="web-generation-command-layout"
        >
          <div className={cn(hasResults && "mx-auto w-full max-w-4xl")}>
            <GenerationCommandContainer
              canSubmit={canSubmit}
              models={models}
              projects={[]}
              prompt={prompt}
              selectedModel={selectedModel}
              selectedProject={null}
              selectedProjectId={null}
              projectSelectorDisabled={true}
              showProjectSelector={false}
              generationAttachmentMedia={generationAttachmentMedia}
              generationSettings={generationSettings}
              onClearProject={() => undefined}
              onGenerationAttachmentMediaChange={setGenerationAttachmentMedia}
              onGenerationSettingsChange={setGenerationSettings}
              onPromptChange={setPrompt}
              onSelectProject={() => undefined}
              onSelectedModelChange={setSelectedModel}
              onSubmit={() => void handleSubmit()}
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function WorkspaceStatus({ children }: { children: ReactNode }) {
  return (
    <main className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8 text-center">
      <div className="flex flex-col items-center gap-4">{children}</div>
    </main>
  );
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

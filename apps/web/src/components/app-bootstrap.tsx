import { useAuth } from "@remora/app/auth";
import {
  createEmptyGenerationAttachmentMediaValue,
  GenerationCommandContainer,
  getDefaultGenerationSettings,
  hasGenerationAttachmentMediaValidationIssues,
  useCreateGenerationSubmissionMutation,
  useGenerationModelSelection,
  type GenerationAttachmentMediaValue,
  type GenerationSettingsValue,
} from "@remora/app/generation";
import { getUserFacingErrorMessage, isAppTRPCError } from "@remora/app/query";
import { toast } from "@remora/ui";
import { useEffect, useState, type ReactNode } from "react";

import {
  GenerationAttachmentMediaUploadError,
  uploadGenerationAttachmentMediaFile,
} from "../lib/generation-attachment-media-file-uploader";

export function AppBootstrap() {
  const { requestAuth, status, user } = useAuth();

  if (status === "loading") {
    return <p>Resolving session...</p>;
  }

  if (status === "signed-out" || !user) {
    return <SignedOutRedirect requestAuth={requestAuth} />;
  }

  return <AuthenticatedWorkspace requestAuth={requestAuth} userId={user.id} />;
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
  userId,
}: {
  requestAuth: () => Promise<void>;
  userId: string;
}) {
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

      await submitGeneration({
        model: selectedModel,
        prompt: submittedPrompt,
        attachmentMedia: submittedAttachmentMedia,
        settings: submittedSettings,
        target: { kind: "new-thread", projectId: null },
        userId,
      });
      clearPendingFreshThreadSubmission();
      toast.success("Generation submitted.");
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
      className="bg-background text-foreground flex min-h-svh items-center justify-center px-6 py-8"
    >
      <section className="flex w-full max-w-4xl flex-col gap-5">
        <div className="space-y-1">
          <h1 className="text-lg font-medium">Create a generation</h1>
          <p className="text-secondary-foreground text-sm font-light">
            Describe what you want to create.
          </p>
        </div>
        <div
          className="data-[has-attachment-media=true]:mt-16"
          data-has-attachment-media={hasAttachmentMedia}
          data-slot="web-generation-command-layout"
        >
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

import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AppSidebar } from "../components/app-sidebar/app-sidebar.tsx";
import { CreateProjectDialog } from "../components/app-sidebar/create-project-dialog.tsx";
import { GenerationCommandInput } from "../components/generation-composer/generation-command-input.tsx";
import { GenerationSettings } from "../components/generation-composer/generation-settings.tsx";
import { GenerationResults } from "../components/generation-submission/generation-results.tsx";
import { AppWorkspaceLayout } from "../layouts/app-workspace-layout.tsx";
import {
  getDefaultGenerationSettings,
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
  type GenerationSettingsValue,
} from "../lib/generation/index.ts";
import { useTRPC } from "../lib/trpc.ts";
import { useAuth } from "../providers/auth-provider.tsx";
import { useHotkey } from "../providers/hotkeys-provider.tsx";

const modelStaleTimeMs = 5 * 60 * 1000;

type ComposerPlacement = "centered" | "docked";

export function AppRoute() {
  const { signOut, status, user } = useAuth();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { threadId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const selectedThreadId = typeof threadId === "string" ? threadId : null;
  const selectedProjectId =
    !selectedThreadId &&
    "projectId" in search &&
    typeof search.projectId === "string"
      ? search.projectId
      : null;
  const generationStackPanelId = useId();
  const generationComposerLayoutRef = useRef<HTMLDivElement | null>(null);
  const [activeStackSubmissionId, setActiveStackSubmissionId] = useState<
    string | null
  >(null);
  const [
    generationComposerMeasuredHeight,
    setGenerationComposerMeasuredHeight,
  ] = useState(0);
  const [selectedModel, setSelectedModel] =
    useState<PublishedGenerationModelSummary | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] =
    useState(false);
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettingsValue | null>(null);
  const modelListQueryOptions = trpc.model.listPublished.queryOptions(
    undefined,
    {
      enabled: status === "signed-in",
      staleTime: modelStaleTimeMs,
    },
  );
  const threadListQueryOptions = trpc.generation.listThreads.queryOptions(
    undefined,
    {
      enabled: status === "signed-in",
    },
  );
  const projectListQueryOptions = trpc.project.listProjects.queryOptions(
    undefined,
    {
      enabled: status === "signed-in",
    },
  );
  const { data: models = [] } = useQuery(modelListQueryOptions);
  const { data: threads = [], isSuccess: hasLoadedThreads } = useQuery(
    threadListQueryOptions,
  );
  const { data: projects = [] } = useQuery(projectListQueryOptions);
  const selectedProject = selectedProjectId
    ? (projects.find((project) => project.id === selectedProjectId) ?? null)
    : null;
  const createVideoMutation = useMutation(
    trpc.generation.createVideo.mutationOptions({
      onSuccess: async (createdJob) => {
        setPrompt("");
        await queryClient.invalidateQueries({
          queryKey: threadListQueryOptions.queryKey,
        });
        if (createdJob.threadId) {
          await queryClient.invalidateQueries({
            queryKey: trpc.generation.listSubmissionsFromThread.queryOptions({
              threadId: createdJob.threadId,
            }).queryKey,
          });
          await navigate({
            to: "/app/threads/$threadId",
            params: { threadId: createdJob.threadId },
          });
        }
      },
    }),
  );

  const effectiveComposerPlacement: ComposerPlacement =
    selectedThreadId || createVideoMutation.isPending ? "docked" : "centered";
  const isMultiGenerationPanelOpen = Boolean(activeStackSubmissionId);
  const isLogoAccessible = effectiveComposerPlacement === "centered";
  const generationStageStyle =
    generationComposerMeasuredHeight > 0
      ? ({
          "--remora-generation-composer-measured-height": `${generationComposerMeasuredHeight}px`,
        } as CSSProperties)
      : undefined;

  const canSubmit =
    Boolean(selectedModel) &&
    Boolean(generationSettings) &&
    prompt.trim().length > 0 &&
    (!selectedProjectId || Boolean(selectedProject)) &&
    !createVideoMutation.isPending;

  function handleSubmit() {
    if (!selectedModel || !generationSettings || !canSubmit) {
      return;
    }

    const threadInput = selectedThreadId ? { threadId: selectedThreadId } : {};
    const projectInput =
      !selectedThreadId && selectedProjectId
        ? { projectId: selectedProjectId }
        : {};

    createVideoMutation.mutate({
      modelId: selectedModel.id,
      prompt,
      ...generationSettings,
      ...threadInput,
      ...projectInput,
    });
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

  function handleStackSubmissionToggle(submissionId: string | null) {
    setActiveStackSubmissionId((currentSubmissionId) =>
      currentSubmissionId === submissionId ? null : submissionId,
    );
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
    enabled: isMultiGenerationPanelOpen,
    onKeyDown: () => setActiveStackSubmissionId(null),
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
  }, [effectiveComposerPlacement, generationSettings, selectedModel]);

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    if (!hasLoadedThreads || !selectedThreadId) {
      return;
    }

    if (!threads.some((thread) => thread.id === selectedThreadId)) {
      void navigate({ to: "/app", replace: true });
    }
  }, [hasLoadedThreads, navigate, selectedThreadId, threads]);

  useEffect(() => {
    setGenerationSettings(getDefaultGenerationSettings(selectedModel));
  }, [selectedModel]);

  useEffect(() => {
    setActiveStackSubmissionId(null);
  }, [selectedThreadId]);

  return (
    <AppWorkspaceLayout
      data-auth-status={status}
      data-user-id={user?.id}
      sidebar={
        <AppSidebar
          selectedThreadId={selectedThreadId}
          threads={threads}
          projects={projects}
          onCreateProject={handleCreateProject}
          onNewGeneration={handleNewGeneration}
          onNewGenerationInProject={handleNewGenerationInProject}
          onSelectThread={handleSelectThread}
          onSignOut={() => {
            void signOut();
          }}
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
        {selectedThreadId && (
          <GenerationResults
            activeStackSubmissionId={activeStackSubmissionId}
            stackPanelId={generationStackPanelId}
            threadId={selectedThreadId}
            onStackSubmissionToggle={handleStackSubmissionToggle}
          />
        )}
        <img
          src="/logo.svg"
          alt={isLogoAccessible ? "Remora" : ""}
          aria-hidden={isLogoAccessible ? undefined : "true"}
          className="pointer-events-none absolute left-1/2 z-[1] h-auto w-[min(20.5rem,calc(100%_-_3rem))] -translate-x-1/2 transition-[top,translate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,translate] select-none data-[placement=centered]:top-[calc(50%_-_9.25rem)] data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset)_-_8.5rem)] motion-reduce:transition-none"
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
            data-stack-panel-state={
              isMultiGenerationPanelOpen ? "open" : "closed"
            }
            data-slot="generation-composer-layout"
            style={{
              transform: getMultiGenerationPanelShiftTransform(
                isMultiGenerationPanelOpen,
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
            <GenerationCommandInput
              canSubmit={canSubmit}
              models={models}
              prompt={prompt}
              selectedModel={selectedModel}
              onPromptChange={setPrompt}
              onSelectedModelChange={setSelectedModel}
              onSubmit={handleSubmit}
            />
            <div className="bg-card relative z-0 -mt-3 flex h-16 w-full items-center justify-start rounded-b-lg px-3 pt-2">
              <GenerationSettings
                selectedModel={selectedModel}
                value={generationSettings}
                onValueChange={setGenerationSettings}
              />
            </div>
          </div>
        </div>
      </div>
    </AppWorkspaceLayout>
  );
}

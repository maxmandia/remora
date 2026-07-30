import { useAuth } from "@remora/app/auth";
import { useTRPC } from "@remora/app/trpc";
import { skipToken, useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useMemo } from "react";

import { useGenerationVideoDurations } from "../../hooks/use-generation-video-durations.ts";
import {
  generationChromeTransitionDurationMs,
  type GenerationChromeMotionState,
  type GenerationCommandPhase,
} from "../../lib/generation/generation-command-transition.ts";
import { toEstimateGenerationCostInput } from "../../lib/model-rates/generation-cost-estimate.ts";
import type { GenerationCommandContainerProps } from "./generation-command-container.tsx";
import { GenerationCostEstimate } from "./generation-cost-estimate.tsx";
import { ManualGenerationForm } from "./manual-generation-form.tsx";
import { ProjectSelector } from "./project-selector.tsx";
import { PromptBuilder } from "./prompt-builder.tsx";

type GenerationCommandFormProps = GenerationCommandContainerProps & {
  phase: GenerationCommandPhase;
};

type GenerationMode = "manual" | "prompt-builder";

type GenerationProjectTrayMotionState = GenerationChromeMotionState | "hidden";

function GenerationCommandForm({
  canSubmit,
  requiresAffordability,
  models,
  projects,
  prompt,
  selectedModel,
  selectedProject,
  selectedProjectId,
  projectSelectorDisabled,
  generationSettings,
  generationAttachmentMedia,
  phase,
  onBuyCredits,
  onClearProject,
  onGenerationSettingsChange,
  onGenerationAttachmentMediaChange,
  onPromptChange,
  onSelectProject,
  onSelectedModelChange,
  onSubmit,
}: GenerationCommandFormProps) {
  const { status } = useAuth();
  const trpc = useTRPC();
  const buildPromptMutation = useMutation(
    trpc.promptBuilder.build.mutationOptions({}),
  );
  const isPromptBuilderSettled = phase === "prompt-builder";
  const accountQueriesEnabled =
    !isPromptBuilderSettled && requiresAffordability && status === "signed-in";
  const {
    durationSecByFile: videoDurationSecByFile,
    isPending: isVideoDurationPending,
  } = useGenerationVideoDurations(generationAttachmentMedia.videos);
  const generationCostEstimateInput = useMemo(
    () =>
      generationSettings &&
      selectedModel &&
      selectedModel.type === generationSettings.modelType &&
      !isVideoDurationPending
        ? toEstimateGenerationCostInput({
            attachmentMediaValue: generationAttachmentMedia,
            generationSettings,
            selectedModel,
            videoDurationSecByFile,
          })
        : null,
    [
      generationAttachmentMedia,
      generationSettings,
      isVideoDurationPending,
      selectedModel,
      videoDurationSecByFile,
    ],
  );
  const { data: queriedCreditBalance } = useQuery(
    trpc.credits.getBalance.queryOptions(undefined, {
      enabled: accountQueriesEnabled,
    }),
  );
  const { data: queriedGenerationCostEstimate } = useQuery({
    ...trpc.modelRates.estimateGenerationCost.queryOptions(
      generationCostEstimateInput ?? skipToken,
      {
        meta: { suppressErrorToast: true },
      },
    ),
    enabled: accountQueriesEnabled && generationCostEstimateInput !== null,
  });
  const creditBalance = accountQueriesEnabled
    ? queriedCreditBalance
    : undefined;
  const generationCostEstimate = accountQueriesEnabled
    ? queriedGenerationCostEstimate
    : undefined;
  const estimatedCostUsdMicros = isVideoDurationPending
    ? null
    : (generationCostEstimate?.estimatedCostUsdMicros ?? null);
  const isGenerationCostEstimateLoading =
    accountQueriesEnabled &&
    (isVideoDurationPending ||
      (generationCostEstimateInput !== null &&
        generationCostEstimate === undefined));
  const isGenerationCostEstimateInsufficient =
    estimatedCostUsdMicros !== null &&
    creditBalance !== undefined &&
    estimatedCostUsdMicros > creditBalance.availableCreditAmountUsdMicros;
  const isGenerationAffordabilityUnknown =
    requiresAffordability &&
    canSubmit &&
    (estimatedCostUsdMicros === null || creditBalance === undefined);
  const canSubmitGeneration =
    phase === "generation" &&
    canSubmit &&
    !isGenerationAffordabilityUnknown &&
    !isGenerationCostEstimateInsufficient;
  const generationMode: GenerationMode =
    phase === "generation" || phase === "returning-generation"
      ? "manual"
      : "prompt-builder";
  const projectTrayMotionState = getProjectTrayMotionState(phase);

  return (
    <>
      <div
        className="bg-surface-strong relative isolate z-10 flex min-h-28 w-full flex-col rounded-lg px-3 py-2 transition-[box-shadow] duration-[260ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[mode=prompt-builder]/generation-command:shadow-[0_0_0_1px,0_0_14px] group-data-[mode=prompt-builder]/generation-command:shadow-white/8 motion-reduce:transition-none"
        data-slot="generation-command-surface"
        data-surface="strong"
        data-transition-state={phase}
      >
        {generationMode === "manual" ? (
          <ManualGenerationForm
            canSubmit={canSubmitGeneration}
            generationAttachmentMedia={generationAttachmentMedia}
            generationSettings={generationSettings}
            isInteractive={phase === "generation"}
            models={models}
            prompt={prompt}
            selectedModel={selectedModel}
            onGenerationAttachmentMediaChange={
              onGenerationAttachmentMediaChange
            }
            onGenerationSettingsChange={onGenerationSettingsChange}
            onPromptChange={onPromptChange}
            onSelectedModelChange={onSelectedModelChange}
            onSubmit={onSubmit}
          />
        ) : (
          <PromptBuilder
            isInteractive={phase === "prompt-builder"}
            isPending={buildPromptMutation.isPending}
            prompt={prompt}
            onPromptChange={onPromptChange}
            onSubmit={(input) => buildPromptMutation.mutate(input)}
          />
        )}
      </div>
      <GenerationProjectTray
        estimatedCostUsdMicros={estimatedCostUsdMicros}
        isGenerationCostEstimateInsufficient={
          isGenerationCostEstimateInsufficient
        }
        isGenerationCostEstimateLoading={isGenerationCostEstimateLoading}
        motionState={projectTrayMotionState}
        onBuyCredits={onBuyCredits}
        projectSelectorDisabled={projectSelectorDisabled}
        projects={projects}
        requiresAffordability={requiresAffordability}
        selectedProject={selectedProject}
        selectedProjectId={selectedProjectId}
        onClearProject={onClearProject}
        onSelectProject={onSelectProject}
      />
    </>
  );
}

function GenerationProjectTray({
  estimatedCostUsdMicros,
  isGenerationCostEstimateInsufficient,
  isGenerationCostEstimateLoading,
  motionState,
  onBuyCredits,
  projectSelectorDisabled,
  projects,
  requiresAffordability,
  selectedProject,
  selectedProjectId,
  onClearProject,
  onSelectProject,
}: Pick<
  GenerationCommandContainerProps,
  | "onClearProject"
  | "onBuyCredits"
  | "onSelectProject"
  | "projectSelectorDisabled"
  | "projects"
  | "requiresAffordability"
  | "selectedProject"
  | "selectedProjectId"
> & {
  estimatedCostUsdMicros: number | null;
  isGenerationCostEstimateInsufficient: boolean;
  isGenerationCostEstimateLoading: boolean;
  motionState: GenerationProjectTrayMotionState;
}) {
  const hiddenContentState = {
    y: -52,
  };
  const visibleContentState = {
    y: 0,
  };
  const isExiting = motionState === "exiting";
  const transitionDurationSeconds = generationChromeTransitionDurationMs / 1000;
  const transitionEase = [0.22, 1, 0.36, 1] as const;
  const shouldRenderContent = motionState !== "hidden";

  return (
    <div
      aria-hidden={motionState === "visible" ? undefined : "true"}
      className="relative z-0 -mt-3 h-16 w-full overflow-hidden"
      data-motion-state={motionState}
      data-slot="generation-project-selector"
      inert={motionState === "visible" ? undefined : true}
      style={{
        pointerEvents: motionState === "visible" ? undefined : "none",
      }}
    >
      {shouldRenderContent ? (
        <motion.div
          animate={isExiting ? hiddenContentState : visibleContentState}
          className="bg-card flex h-16 w-full items-center justify-between rounded-b-lg px-4 pt-2"
          data-motion-state={motionState}
          data-slot="generation-project-selector-content"
          data-surface="card"
          initial={motionState === "entering" ? hiddenContentState : false}
          transition={{
            duration: transitionDurationSeconds,
            ease: transitionEase,
          }}
        >
          <ProjectSelector
            disabled={projectSelectorDisabled}
            projects={projects}
            onClearProject={onClearProject}
            onSelectProject={onSelectProject}
            selectedProject={selectedProject}
            selectedProjectId={selectedProjectId}
          />
          {requiresAffordability ? (
            <GenerationCostEstimate
              estimatedCostUsdMicros={estimatedCostUsdMicros}
              isInsufficientCredits={isGenerationCostEstimateInsufficient}
              isLoading={isGenerationCostEstimateLoading}
              onBuyCredits={onBuyCredits}
            />
          ) : null}
        </motion.div>
      ) : null}
    </div>
  );
}

function getProjectTrayMotionState(
  phase: GenerationCommandPhase,
): GenerationProjectTrayMotionState {
  switch (phase) {
    case "generation":
      return "visible";
    case "entering-prompt-builder":
      return "exiting";
    case "prompt-builder":
      return "hidden";
    case "returning-generation":
      return "entering";
  }
}

export { GenerationCommandForm };
export type { GenerationCommandFormProps };

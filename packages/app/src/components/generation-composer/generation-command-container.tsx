import { useAuth } from "@remora/app/auth";
import { useTRPC } from "@remora/app/trpc";
import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { Button } from "@remora/ui";
import { skipToken, useQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { useGenerationVideoDurations } from "../../hooks/use-generation-video-durations.ts";
import type { GenerationSettingsValue } from "../../lib/generation/generation-settings.ts";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import { toEstimateGenerationCostInput } from "../../lib/model-rates/generation-cost-estimate.ts";
import { AttachmentMediaPreview } from "./attachment-media-preview.tsx";
import { GenerationCommandInput } from "./generation-command-input.tsx";
import { GenerationCostEstimate } from "./generation-cost-estimate.tsx";
import { GenerationModelSelector } from "./generation-model-selector.tsx";
import { GenerationSettings } from "./generation-settings.tsx";
import { ProjectSelector } from "./project-selector.tsx";

export type GenerationCommandContainerProps = {
  canSubmit: boolean;
  /**
   * Real generation submissions must wait for an authenticated balance and
   * cost estimate. Guest previews are simulated, so they deliberately bypass
   * affordability without weakening the real submission path.
   */
  requiresAffordability: boolean;
  models: PublishedGenerationModelSummary[];
  prompt: string;
  selectedModel: PublishedGenerationModelSummary | null;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedProjectId: string | null;
  projectSelectorDisabled: boolean;
  generationAttachmentMedia: GenerationAttachmentMediaValue;
  generationSettings: GenerationSettingsValue | null;
  onClearProject: () => void;
  onGenerationAttachmentMediaChange: (
    generationAttachmentMedia: GenerationAttachmentMediaValue,
  ) => void;
  onGenerationSettingsChange: (
    generationSettings: GenerationSettingsValue,
  ) => void;
  onPromptChange: (prompt: string) => void;
  onBuyCredits: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
  onSubmit: () => void;
};

export function GenerationCommandContainer({
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
  onClearProject,
  onGenerationSettingsChange,
  onGenerationAttachmentMediaChange,
  onPromptChange,
  onBuyCredits,
  onSelectProject,
  onSelectedModelChange,
  onSubmit,
}: GenerationCommandContainerProps) {
  const { status } = useAuth();
  const trpc = useTRPC();
  const accountQueriesEnabled = requiresAffordability && status === "signed-in";
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
    canSubmit &&
    !isGenerationAffordabilityUnknown &&
    !isGenerationCostEstimateInsufficient;

  return (
    <div
      className="relative isolate w-full"
      data-slot="generation-command-container"
    >
      <AttachmentMediaPreview
        selectedModel={selectedModel}
        value={generationAttachmentMedia}
        onValueChange={onGenerationAttachmentMediaChange}
      />
      <div
        className="bg-surface-strong relative z-10 flex min-h-28 w-full flex-col rounded-lg px-3 py-2"
        data-surface="strong"
      >
        <GenerationCommandInput
          attachmentMediaValue={generationAttachmentMedia}
          prompt={prompt}
          onPromptChange={onPromptChange}
        />
        <div
          className="mt-auto flex min-w-0 items-center gap-2"
          data-slot="generation-command-controls"
        >
          <div
            className="min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
            data-slot="generation-settings-scroll-viewport"
          >
            <div
              className="w-max"
              data-slot="generation-settings-scroll-content"
            >
              <GenerationSettings
                attachmentMediaValue={generationAttachmentMedia}
                selectedModel={selectedModel}
                value={generationSettings}
                onAttachmentMediaValueChange={onGenerationAttachmentMediaChange}
                onValueChange={onGenerationSettingsChange}
              />
            </div>
          </div>
          <div
            className="flex shrink-0 items-center gap-2"
            data-slot="generation-primary-controls"
          >
            <GenerationModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelectedModelChange={onSelectedModelChange}
            />
            <Button
              aria-label="Submit generation"
              variant="ghost"
              size="icon"
              disabled={!canSubmitGeneration}
              onClick={onSubmit}
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
      </div>
      <div
        data-slot="generation-project-selector"
        data-surface="card"
        className="bg-card relative z-0 -mt-3 flex h-16 w-full items-center justify-between rounded-b-lg px-4 pt-2"
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
      </div>
    </div>
  );
}

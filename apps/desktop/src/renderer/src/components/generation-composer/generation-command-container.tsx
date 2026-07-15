import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { Button } from "@remora/ui";
import { skipToken, useQuery } from "@tanstack/react-query";
import { ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { useGenerationVideoDurations } from "../../hooks/use-generation-video-durations.ts";
import type { GenerationSettingsValue } from "../../lib/generation";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import { toEstimateGenerationCostInput } from "../../lib/model-rates/generation-cost-estimate.ts";
import { useTRPC } from "../../lib/trpc.ts";
import { GenerationCommandInput } from "./generation-command-input.tsx";
import { GenerationCostEstimate } from "./generation-cost-estimate.tsx";
import { GenerationModelSelector } from "./generation-model-selector.tsx";
import { GenerationSettings } from "./generation-settings";
import { ProjectSelector } from "./project-selector.tsx";

export function GenerationCommandContainer({
  canSubmit,
  models,
  projects,
  prompt,
  selectedModel,
  selectedProject,
  selectedProjectId,
  projectSelectorDisabled,
  showProjectSelector,
  generationSettings,
  generationAttachmentMedia,
  onClearProject,
  onGenerationSettingsChange,
  onGenerationAttachmentMediaChange,
  onPromptChange,
  onSelectProject,
  onSelectedModelChange,
  onSubmit,
}: {
  canSubmit: boolean;
  models: PublishedGenerationModelSummary[];
  prompt: string;
  selectedModel: PublishedGenerationModelSummary | null;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedProjectId: string | null;
  projectSelectorDisabled: boolean;
  showProjectSelector: boolean;
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
  onSelectProject: (projectId: string) => void;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
  onSubmit: () => void;
}) {
  const trpc = useTRPC();
  const {
    durationSecByFile: videoDurationSecByFile,
    isPending: isVideoDurationPending,
  } = useGenerationVideoDurations(generationAttachmentMedia.videos);
  const generationCostEstimateInput = useMemo(
    () =>
      generationSettings && selectedModel && !isVideoDurationPending
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
  const { data: creditBalance } = useQuery(
    trpc.credits.getBalance.queryOptions(),
  );
  const { data: generationCostEstimate } = useQuery({
    ...trpc.modelRates.estimateGenerationCost.queryOptions(
      generationCostEstimateInput ?? skipToken,
      {
        meta: { suppressErrorToast: true },
      },
    ),
    enabled: generationCostEstimateInput !== null,
  });

  const estimatedCostUsdMicros = isVideoDurationPending
    ? null
    : (generationCostEstimate?.estimatedCostUsdMicros ?? null);
  const isGenerationCostEstimateLoading =
    isVideoDurationPending ||
    (generationCostEstimateInput !== null &&
      generationCostEstimate === undefined);
  const isGenerationCostEstimateInsufficient =
    estimatedCostUsdMicros !== null &&
    creditBalance !== undefined &&
    estimatedCostUsdMicros > creditBalance.availableCreditAmountUsdMicros;
  const isGenerationAffordabilityUnknown =
    canSubmit &&
    (estimatedCostUsdMicros === null || creditBalance === undefined);

  const canSubmitGeneration =
    canSubmit &&
    !isGenerationAffordabilityUnknown &&
    !isGenerationCostEstimateInsufficient;

  return (
    <>
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
      {showProjectSelector ? (
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
          <GenerationCostEstimate
            estimatedCostUsdMicros={estimatedCostUsdMicros}
            isInsufficientCredits={isGenerationCostEstimateInsufficient}
            isLoading={isGenerationCostEstimateLoading}
          />
        </div>
      ) : null}
    </>
  );
}

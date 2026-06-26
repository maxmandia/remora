import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { Button } from "@remora/ui";
import { ArrowUp } from "lucide-react";
import type { GenerationSettingsValue } from "../../lib/generation";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
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
        <div className="mt-auto flex items-center gap-2">
          <GenerationSettings
            attachmentMediaValue={generationAttachmentMedia}
            selectedModel={selectedModel}
            value={generationSettings}
            onAttachmentMediaValueChange={onGenerationAttachmentMediaChange}
            onValueChange={onGenerationSettingsChange}
          />
          <div className="ml-auto flex items-center gap-2">
            <GenerationModelSelector
              models={models}
              selectedModel={selectedModel}
              onSelectedModelChange={onSelectedModelChange}
            />

            <Button
              aria-label="Submit generation"
              variant="ghost"
              size="icon"
              disabled={!canSubmit}
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
            attachmentMediaValue={generationAttachmentMedia}
            generationSettings={generationSettings}
            selectedModel={selectedModel}
          />
        </div>
      ) : null}
    </>
  );
}

import { Button } from "@remora/ui";
import { ArrowUp } from "lucide-react";

import type { GenerationCommandContainerProps } from "./generation-command-container.tsx";
import { GenerationCommandInput } from "./generation-command-input.tsx";
import { GenerationModelSelector } from "./generation-model-selector.tsx";
import { GenerationSettings } from "./generation-settings.tsx";

type ManualGenerationFormProps = Pick<
  GenerationCommandContainerProps,
  | "generationAttachmentMedia"
  | "generationSettings"
  | "models"
  | "onGenerationAttachmentMediaChange"
  | "onGenerationSettingsChange"
  | "onPromptChange"
  | "onSelectedModelChange"
  | "onSubmit"
  | "prompt"
  | "selectedModel"
> & {
  canSubmit: boolean;
  isInteractive: boolean;
};

function ManualGenerationForm({
  canSubmit,
  generationAttachmentMedia,
  generationSettings,
  isInteractive,
  models,
  prompt,
  selectedModel,
  onGenerationAttachmentMediaChange,
  onGenerationSettingsChange,
  onPromptChange,
  onSelectedModelChange,
  onSubmit,
}: ManualGenerationFormProps) {
  return (
    <div
      aria-hidden={isInteractive ? undefined : "true"}
      className="contents"
      data-slot="generation-command-form"
      inert={isInteractive ? undefined : true}
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
          <div className="w-max" data-slot="generation-settings-scroll-content">
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
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            <ArrowUp />
          </Button>
        </div>
      </div>
    </div>
  );
}

export { ManualGenerationForm };
export type { ManualGenerationFormProps };

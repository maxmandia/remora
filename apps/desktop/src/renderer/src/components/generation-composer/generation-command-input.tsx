import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import {
  Button,
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@remora/ui";
import { ArrowUp } from "lucide-react";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { GenerationSettingsValue } from "../../lib/generation";
import type { GenerationReferenceMediaValue } from "../../lib/generation/reference-media.ts";
import { GenerationSettings } from "./generation-settings";

const modelComboboxPlaceholder = "Select a model";
const modelInputWidthBufferPx = 6;

export function GenerationCommandInput({
  canSubmit,
  models,
  prompt,
  selectedModel,
  generationSettings,
  generationReferenceMedia,
  onGenerationSettingsChange,
  onGenerationReferenceMediaChange,
  onPromptChange,
  onSelectedModelChange,
  onSubmit,
}: {
  canSubmit: boolean;
  models: PublishedGenerationModelSummary[];
  prompt: string;
  selectedModel: PublishedGenerationModelSummary | null;
  generationReferenceMedia: GenerationReferenceMediaValue;
  generationSettings: GenerationSettingsValue | null;
  onGenerationReferenceMediaChange: (
    generationReferenceMedia: GenerationReferenceMediaValue,
  ) => void;
  onGenerationSettingsChange: (
    generationSettings: GenerationSettingsValue,
  ) => void;
  onPromptChange: (prompt: string) => void;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
  onSubmit: () => void;
}) {
  const modelStableInputMeasureRef = useRef<HTMLSpanElement | null>(null);
  const modelQueryInputMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [modelInputValue, setModelInputValue] = useState("");
  const [modelInputWidth, setModelInputWidth] = useState(0);
  const modelStableSizingText =
    selectedModel?.displayName ?? modelComboboxPlaceholder;
  const modelInputStyle = {
    "--model-combobox-input-width": `${modelInputWidth}px`,
  } as CSSProperties;

  useLayoutEffect(() => {
    const stableWidth =
      modelStableInputMeasureRef.current?.getBoundingClientRect().width ?? 0;
    const queryWidth =
      modelQueryInputMeasureRef.current?.getBoundingClientRect().width ?? 0;

    setModelInputWidth(
      Math.ceil(Math.max(stableWidth, queryWidth)) + modelInputWidthBufferPx,
    );
  }, [modelInputValue, modelStableSizingText]);

  return (
    <div
      className="bg-surface-strong relative z-10 flex min-h-28 w-full flex-col rounded-lg px-3 py-2"
      data-surface="strong"
    >
      <input
        className="text-surface-strong-foreground h-10 w-full font-light focus:outline-none"
        placeholder="A castle in the sky with..."
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
      />
      <span
        ref={modelStableInputMeasureRef}
        aria-hidden="true"
        className="pointer-events-none fixed -top-96 left-0 h-0 overflow-hidden text-base whitespace-pre md:text-sm"
      >
        {modelStableSizingText}
      </span>
      <span
        ref={modelQueryInputMeasureRef}
        aria-hidden="true"
        className="pointer-events-none fixed -top-96 left-0 h-0 overflow-hidden text-base whitespace-pre md:text-sm"
      >
        {modelInputValue}
      </span>
      <div className="mt-auto flex items-center gap-2">
        <GenerationSettings
          referenceMediaValue={generationReferenceMedia}
          selectedModel={selectedModel}
          value={generationSettings}
          onReferenceMediaValueChange={onGenerationReferenceMediaChange}
          onValueChange={onGenerationSettingsChange}
        />
        <div className="ml-auto flex items-center gap-2">
          <Combobox
            items={models}
            value={selectedModel}
            onValueChange={onSelectedModelChange}
            onInputValueChange={setModelInputValue}
            itemToStringLabel={(model) => model.displayName}
            itemToStringValue={(model) => model.id}
            isItemEqualToValue={(item, value) => item.id === value.id}
          >
            <ComboboxInput
              className="[&_[data-slot=input-group-control]]:w-[var(--model-combobox-input-width)]"
              placeholder={modelComboboxPlaceholder}
              style={modelInputStyle}
            />
            <ComboboxContent className="min-w-64">
              <ComboboxList>
                {(model: PublishedGenerationModelSummary) => (
                  <ComboboxItem key={model.id} value={model}>
                    {model.displayName}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
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

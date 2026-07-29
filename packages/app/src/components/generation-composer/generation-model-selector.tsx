import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@remora/ui";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const modelComboboxPlaceholder = "Select a model";
const modelInputWidthBufferPx = 6;
const modelGroupDefinitions = [
  { label: "Images", type: "image" },
  { label: "Videos", type: "video" },
] as const;

export function GenerationModelSelector({
  models,
  selectedModel,
  onSelectedModelChange,
}: {
  models: PublishedGenerationModelSummary[];
  selectedModel: PublishedGenerationModelSummary | null;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
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
  const modelGroups = modelGroupDefinitions
    .map(({ label, type }) => ({
      value: label,
      items: models.filter((model) => model.type === type),
    }))
    .filter((group) => group.items.length > 0);

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
    <>
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
      <Combobox
        items={modelGroups}
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
            {(group) => (
              <ComboboxGroup key={group.value} items={group.items}>
                <ComboboxLabel>{group.value}</ComboboxLabel>
                <ComboboxCollection>
                  {(model: PublishedGenerationModelSummary) => (
                    <ComboboxItem key={model.id} value={model}>
                      {model.displayName}
                    </ComboboxItem>
                  )}
                </ComboboxCollection>
              </ComboboxGroup>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </>
  );
}

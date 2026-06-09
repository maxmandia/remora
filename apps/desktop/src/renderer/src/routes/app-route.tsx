import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import { useAuth } from "../providers/auth-provider.tsx";
import {
  Button,
  ComboboxInput,
  Combobox,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from "@remora/ui";
import { ArrowUp } from "lucide-react";
import { useTRPC } from "../lib/trpc.ts";
import { GenerationSettings } from "../components/generation-settings.tsx";
import {
  getDefaultGenerationSettings,
  type GenerationSettingsValue,
} from "../lib/generation/index.ts";

const modelStaleTimeMs = 5 * 60 * 1000;
const modelComboboxPlaceholder = "Select a model";
const modelInputWidthBufferPx = 6;

export function AppRoute() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const modelStableInputMeasureRef = useRef<HTMLSpanElement | null>(null);
  const modelQueryInputMeasureRef = useRef<HTMLSpanElement | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<PublishedGenerationModelSummary | null>(null);
  const [modelInputValue, setModelInputValue] = useState("");
  const [modelInputWidth, setModelInputWidth] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [generationSettings, setGenerationSettings] =
    useState<GenerationSettingsValue | null>(null);

  const { data: models = [] } = useQuery(
    trpc.model.listPublished.queryOptions(undefined, {
      enabled: status === "signed-in",
      staleTime: modelStaleTimeMs,
    }),
  );
  const createVideoMutation = useMutation(
    trpc.generation.createVideo.mutationOptions({
      onSuccess: () => {
        setPrompt("");
      },
    }),
  );

  const modelStableSizingText =
    selectedModel?.displayName ?? modelComboboxPlaceholder;
  const modelInputStyle = {
    "--model-combobox-input-width": `${modelInputWidth}px`,
  } as CSSProperties;

  const canSubmit =
    Boolean(selectedModel) &&
    Boolean(generationSettings) &&
    prompt.trim().length > 0 &&
    !createVideoMutation.isPending;

  function handleSubmit() {
    if (!selectedModel || !generationSettings || !canSubmit) {
      return;
    }

    createVideoMutation.mutate({
      modelId: selectedModel.id,
      prompt,
      ...generationSettings,
    });
  }

  useLayoutEffect(() => {
    const stableWidth =
      modelStableInputMeasureRef.current?.getBoundingClientRect().width ?? 0;
    const queryWidth =
      modelQueryInputMeasureRef.current?.getBoundingClientRect().width ?? 0;

    setModelInputWidth(
      Math.ceil(Math.max(stableWidth, queryWidth)) + modelInputWidthBufferPx,
    );
  }, [modelInputValue, modelStableSizingText]);

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  useEffect(() => {
    setGenerationSettings(getDefaultGenerationSettings(selectedModel));
  }, [selectedModel]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-12">
      <img
        src="/logo.svg"
        alt="Remora"
        className="h-auto w-82 select-none"
        draggable={false}
      />
      <div className="relative isolate w-[min(50rem,calc(100vw-3rem))]">
        <div className="bg-card relative z-10 min-h-28 w-full rounded-lg px-3 py-2">
          <input
            className="text-primary-foreground h-10 w-full font-light focus:outline-none"
            placeholder="A castle in the sky with..."
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
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
          <div className="flex items-center justify-end gap-2">
            <Combobox
              items={models}
              value={selectedModel}
              onValueChange={setSelectedModel}
              onInputValueChange={setModelInputValue}
              itemToStringLabel={(model) => model.displayName}
              itemToStringValue={(model) => model.id}
              isItemEqualToValue={(item, value) => item.id === value.id}
            >
              <ComboboxInput
                className="border-none has-[[data-slot=input-group-control]:focus-visible]:border-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_[data-slot=input-group-addon]]:pr-0 [&_[data-slot=input-group-addon]]:pl-1 [&_[data-slot=input-group-control]]:w-[var(--model-combobox-input-width)] [&_[data-slot=input-group-control]]:px-0"
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
              variant="default"
              size="icon"
              disabled={!canSubmit}
              onClick={handleSubmit}
            >
              <ArrowUp />
            </Button>
          </div>
        </div>
        <div className="bg-card relative z-0 -mt-3 flex h-16 w-full items-center justify-start rounded-b-lg px-3 pt-2">
          <GenerationSettings
            selectedModel={selectedModel}
            value={generationSettings}
            onValueChange={setGenerationSettings}
          />
        </div>
      </div>
    </div>
  );
}

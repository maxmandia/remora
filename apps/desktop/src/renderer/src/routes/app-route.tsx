import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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

  const { data: models = [] } = useQuery(
    trpc.model.listPublished.queryOptions(undefined, {
      enabled: status === "signed-in",
      staleTime: modelStaleTimeMs,
    }),
  );

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

  useEffect(() => {
    if (status === "signed-out") {
      void navigate({ to: "/welcome", replace: true });
    }
  }, [navigate, status]);

  return (
    <div className="flex flex-col gap-12 h-full w-full items-center justify-center">
      <img
        src="/logo.svg"
        alt="Remora"
        className="w-82 h-auto select-none"
        draggable={false}
      />
      <div className="relative isolate w-[min(50rem,calc(100vw-3rem))]">
        <div className="relative z-10 min-h-28 w-full rounded-lg bg-card px-3 py-2">
          <input
            className="h-10 w-full focus:outline-none text-primary-foreground font-light"
            placeholder="A castle in the sky with..."
          />
          <span
            ref={modelStableInputMeasureRef}
            aria-hidden="true"
            className="pointer-events-none fixed -top-96 left-0 h-0 overflow-hidden whitespace-pre text-base md:text-sm"
          >
            {modelStableSizingText}
          </span>
          <span
            ref={modelQueryInputMeasureRef}
            aria-hidden="true"
            className="pointer-events-none fixed -top-96 left-0 h-0 overflow-hidden whitespace-pre text-base md:text-sm"
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
                className="border-none has-[[data-slot=input-group-control]:focus-visible]:border-none has-[[data-slot=input-group-control]:focus-visible]:ring-0 [&_[data-slot=input-group-addon]]:pl-1 [&_[data-slot=input-group-addon]]:pr-0 [&_[data-slot=input-group-control]]:w-[var(--model-combobox-input-width)] [&_[data-slot=input-group-control]]:px-0"
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
            <Button variant="default" size="icon">
              <ArrowUp />
            </Button>
          </div>
        </div>
        <div className="relative z-0 -mt-3 h-16 w-full rounded-b-lg bg-card pt-2 px-3 flex items-center justify-start">
          <GenerationSettings selectedModel={selectedModel} />
        </div>
      </div>
    </div>
  );
}

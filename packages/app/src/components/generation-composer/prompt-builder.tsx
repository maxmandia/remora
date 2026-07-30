import type { GenerationModelType } from "@remora/domain/generation-model/dto";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@remora/ui";
import { useState, type ChangeEvent } from "react";

import { Loader2Icon, WandSparklesIcon } from "lucide-react";
import { PromptTextarea } from "./prompt-textarea.tsx";

const generationTypeOptions = [
  { label: "image", value: "image" },
  { label: "video", value: "video" },
] satisfies Array<{ label: GenerationModelType; value: GenerationModelType }>;

type PromptBuilderProps = {
  isInteractive: boolean;
  isPending: boolean;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  onSubmit: (input: { modelType: GenerationModelType; prompt: string }) => void;
};

function PromptBuilder({
  isInteractive,
  isPending,
  prompt,
  onPromptChange,
  onSubmit,
}: PromptBuilderProps) {
  const [generationType, setGenerationType] =
    useState<GenerationModelType>("image");

  function handlePromptChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onPromptChange(event.target.value);
  }

  return (
    <div
      aria-hidden={isInteractive ? undefined : "true"}
      className="contents"
      data-slot="prompt-builder"
      inert={isInteractive ? undefined : true}
    >
      <div
        className="text-surface-strong-foreground flex min-h-10 min-w-0 items-start gap-1 py-2 leading-6 font-light"
        data-slot="prompt-builder-sentence"
      >
        <span className="shrink-0" data-slot="prompt-builder-prefix">
          Generate {generationType === "image" ? "an" : "a "}
        </span>
        <Select
          items={generationTypeOptions}
          value={generationType}
          onValueChange={(value) => {
            if (value) {
              setGenerationType(value);
            }
          }}
        >
          <SelectTrigger
            aria-label="Generation type"
            className="-my-0.5 h-7 px-1 text-base leading-6 font-light"
            size="sm"
            variant="ghost"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {generationTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="shrink-0" data-slot="prompt-builder-connector">
          of
        </span>
        <PromptTextarea
          aria-label="Prompt details"
          className="min-h-6 min-w-0 flex-1 py-0"
          value={prompt}
          onChange={handlePromptChange}
        />
      </div>
      <div
        className="mt-auto flex min-w-0 items-center justify-end gap-2"
        data-slot="prompt-builder-controls"
      >
        <Button
          aria-busy={isPending}
          aria-label="Submit prompt builder"
          disabled={!isInteractive || isPending || prompt.trim().length === 0}
          type="button"
          onClick={() => onSubmit({ modelType: generationType, prompt })}
        >
          {isPending ? (
            <Loader2Icon className="animate-spin" />
          ) : (
            <WandSparklesIcon />
          )}
          Build Prompt
        </Button>
      </div>
    </div>
  );
}

export { PromptBuilder };
export type { PromptBuilderProps };

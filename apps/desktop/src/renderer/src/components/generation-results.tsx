import type { GenerationThreadSubmission } from "@remora/backend/types";
import { Badge, Button, cn } from "@remora/ui";
import { assertNever } from "@remora/utils";
import { useQuery } from "@tanstack/react-query";
import { Clock8Icon, Layers2Icon, RatioIcon, Volume2Icon } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import {
  orderedGenerationSettingIds,
  type GenerationSettingsFieldId,
} from "../lib/generation/index.ts";
import { useTRPC } from "../lib/trpc.ts";
import { DotFieldSkeleton } from "./dot-field-skeleton.tsx";

type GenerationResultsProps = {
  threadId: string;
};

export function GenerationResults({ threadId }: GenerationResultsProps) {
  const trpc = useTRPC();
  const { data: submissions = [] } = useQuery(
    trpc.generation.listSubmissionsFromThread.queryOptions({ threadId }),
  );

  if (submissions.length === 0) return null;

  return (
    <section
      aria-label="Generation results"
      className="relative z-[3] mx-auto flex w-[min(60rem,calc(100%_-_3rem))] flex-col gap-3 pt-[clamp(2rem,9vh,5rem)] pb-56"
    >
      {submissions.map((submission) => (
        <GenerationSubmissionRow key={submission.id} submission={submission} />
      ))}
    </section>
  );
}

function GenerationSubmissionRow({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  return (
    <article className="flex w-full items-start gap-6">
      <GenerationSubmissionOutputs />
      <GenerationResultSubmittedInput submission={submission} />
    </article>
  );
}

function GenerationSubmissionOutputs() {
  return (
    <div className="flex w-1/5 shrink-0 flex-wrap gap-2">
      <DotFieldSkeleton
        className="size-40 shrink-0"
        data-testid="generation-thread-job"
      />
    </div>
  );
}

function GenerationResultSubmittedInput({
  submission,
}: {
  submission: GenerationThreadSubmission;
}) {
  const promptId = useId();
  const promptMeasureViewportRef = useRef<HTMLDivElement | null>(null);
  const promptMeasureContentRef = useRef<HTMLParagraphElement | null>(null);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [canExpandPrompt, setCanExpandPrompt] = useState(false);
  const submittedInput = submission.submittedInput;
  const submittedSettings = {
    ...submittedInput,
    requestedGenerations: submission.requestedGenerations,
  } satisfies SubmittedGenerationSettingsValue;
  const prompt = submittedInput.prompt;

  const measurePromptOverflow = useCallback(() => {
    const viewport = promptMeasureViewportRef.current;
    const content = promptMeasureContentRef.current;

    if (!viewport || !content) {
      return;
    }

    const viewportHeight =
      viewport.clientHeight || viewport.getBoundingClientRect().height;
    const contentHeight =
      content.scrollHeight || content.getBoundingClientRect().height;
    const hasOverflow = contentHeight - viewportHeight > 1;

    setCanExpandPrompt(hasOverflow);

    if (!hasOverflow) {
      setIsPromptExpanded(false);
    }
  }, []);

  useLayoutEffect(() => {
    measurePromptOverflow();

    const viewport = promptMeasureViewportRef.current;
    const content = promptMeasureContentRef.current;
    const Observer = window.ResizeObserver;
    const resizeObserver =
      typeof Observer === "function"
        ? new Observer(measurePromptOverflow)
        : null;

    if (viewport) {
      resizeObserver?.observe(viewport);
    }

    if (content) {
      resizeObserver?.observe(content);
    }

    window.addEventListener("resize", measurePromptOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measurePromptOverflow);
    };
  }, [measurePromptOverflow, prompt]);

  return (
    <div
      className={["relative min-w-0 flex-1", isPromptExpanded ? "py-4" : "h-40"]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        ref={promptMeasureViewportRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-4 right-0 left-0 h-[5rem] overflow-hidden opacity-0"
        data-slot="generation-result-prompt-measure"
      >
        <p
          ref={promptMeasureContentRef}
          className="text-secondary-foreground text-sm leading-5 break-words whitespace-pre-wrap"
          data-slot="generation-result-prompt-measure-content"
        >
          {prompt}
        </p>
      </div>
      {isPromptExpanded ? (
        <>
          <p
            id={promptId}
            className="text-secondary-foreground text-sm leading-5 break-words whitespace-pre-wrap"
          >
            {prompt}
          </p>
          {canExpandPrompt ? (
            <PromptOverflowToggle
              className="mt-2"
              isExpanded={isPromptExpanded}
              promptId={promptId}
              onClick={() => setIsPromptExpanded(false)}
            />
          ) : null}
          <SubmittedGenerationSettings
            className="mt-3"
            settings={submittedSettings}
          />
        </>
      ) : (
        <>
          <div
            id={promptId}
            className="absolute top-4 right-0 left-0 h-[5rem] overflow-hidden"
            data-slot="generation-result-prompt-collapsed"
          >
            <p
              className="text-secondary-foreground text-sm leading-5 break-words whitespace-pre-wrap"
              data-slot="generation-result-prompt-text"
            >
              {prompt}
            </p>
            {canExpandPrompt ? (
              <div
                className="pointer-events-none absolute right-0 bottom-0 z-10 flex h-5 items-center bg-[linear-gradient(to_right,transparent,var(--background)_2.25rem,var(--background)_100%)] pl-12"
                data-slot="generation-result-prompt-overflow-overlay"
              >
                <PromptOverflowToggle
                  className="pointer-events-auto h-5 px-1.5 leading-5"
                  isExpanded={isPromptExpanded}
                  promptId={promptId}
                  onClick={() => setIsPromptExpanded(true)}
                />
              </div>
            ) : null}
          </div>
          <SubmittedGenerationSettings
            className="absolute top-[8.5rem] right-0 left-0 -translate-y-full"
            settings={submittedSettings}
          />
        </>
      )}
    </div>
  );
}

function PromptOverflowToggle({
  className,
  isExpanded,
  promptId,
  onClick,
}: {
  className?: string;
  isExpanded: boolean;
  promptId: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-controls={promptId}
      aria-expanded={isExpanded}
      className={cn(
        "text-secondary-foreground hover:text-foreground h-6 px-1.5 text-xs",
        className,
      )}
      onClick={onClick}
      size="xs"
      type="button"
      variant="ghost"
    >
      {isExpanded ? "Show less" : "Show more"}
    </Button>
  );
}

type SubmittedGenerationSettingsValue = Pick<
  GenerationThreadSubmission["submittedInput"] &
    Pick<GenerationThreadSubmission, "requestedGenerations">,
  GenerationSettingsFieldId
>;

function SubmittedGenerationSettings({
  className,
  settings,
}: {
  className?: string;
  settings: SubmittedGenerationSettingsValue;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-slot="submitted-generation-settings"
    >
      {orderedGenerationSettingIds.map((fieldId) => (
        <SubmittedGenerationSetting
          key={fieldId}
          fieldId={fieldId}
          value={settings[fieldId]}
        />
      ))}
    </div>
  );
}

function SubmittedGenerationSetting({
  fieldId,
  value,
}: {
  fieldId: GenerationSettingsFieldId;
  value: SubmittedGenerationSettingsValue[GenerationSettingsFieldId];
}) {
  switch (fieldId) {
    case "requestedGenerations":
      return (
        <SubmittedGenerationSettingPill
          icon={<Layers2Icon />}
          text={value.toString()}
        />
      );
    case "aspectRatio":
      return (
        <SubmittedGenerationSettingPill
          icon={<RatioIcon />}
          text={value.toString()}
        />
      );
    case "duration":
      return (
        <SubmittedGenerationSettingPill
          icon={<Clock8Icon />}
          text={value.toString()}
        />
      );
    case "generateAudio":
      return (
        <SubmittedGenerationSettingPill
          icon={<Volume2Icon />}
          text={value.toString()}
        />
      );
    default:
      return assertNever(fieldId);
  }
}

function SubmittedGenerationSettingPill({
  text,
  icon,
}: {
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <Badge className="text-secondary-foreground">
      {icon}
      {text}
    </Badge>
  );
}

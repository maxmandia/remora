import type { GenerationThreadSubmission } from "@remora/backend/types";
import { Button, cn } from "@remora/ui";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import {
  SubmittedGenerationSettings,
  type SubmittedGenerationSettingsValue,
} from "./submitted-generation-settings.tsx";
import { SubmittedReferenceMediaBadge } from "./submitted-reference-media-badge.tsx";

export function GenerationResultSubmittedInput({
  isReferenceMediaPanelOpen,
  referenceMediaPanelId,
  submission,
  onReferenceMediaPanelToggle,
}: {
  isReferenceMediaPanelOpen: boolean;
  referenceMediaPanelId: string;
  submission: GenerationThreadSubmission;
  onReferenceMediaPanelToggle: () => void;
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
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <SubmittedReferenceMediaBadge
              isPanelOpen={isReferenceMediaPanelOpen}
              panelId={referenceMediaPanelId}
              onPanelToggle={onReferenceMediaPanelToggle}
              referenceMedia={submission.referenceMedia}
            />
            <SubmittedGenerationSettings settings={submittedSettings} />
          </div>
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
          <div className="absolute top-36 right-0 left-0 flex -translate-y-full flex-wrap items-center gap-2">
            <SubmittedReferenceMediaBadge
              isPanelOpen={isReferenceMediaPanelOpen}
              panelId={referenceMediaPanelId}
              onPanelToggle={onReferenceMediaPanelToggle}
              referenceMedia={submission.referenceMedia}
            />
            <SubmittedGenerationSettings settings={submittedSettings} />
          </div>
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

import type { GenerationThreadSubmission } from "@remora/domain/generation-submission/dto";
import { Button, cn } from "@remora/ui";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";

import {
  SubmittedGenerationSettings,
  type SubmittedGenerationSettingsValue,
} from "./submitted-generation-settings.tsx";
import { SubmittedAttachmentMediaBadge } from "./submitted-attachment-media-badge.tsx";

export function GenerationResultSubmittedInput({
  isAttachmentMediaPanelOpen,
  attachmentMediaPanelId,
  submission,
  onAttachmentMediaPanelToggle,
}: {
  isAttachmentMediaPanelOpen: boolean;
  attachmentMediaPanelId: string;
  submission: GenerationThreadSubmission;
  onAttachmentMediaPanelToggle: () => void;
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
      data-slot="generation-result-submitted-input"
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
      <GenerationResultPrompt
        canExpand={canExpandPrompt}
        isExpanded={isPromptExpanded}
        prompt={prompt}
        promptId={promptId}
        onExpandedChange={setIsPromptExpanded}
      />
      <SubmittedGenerationMetadata
        isAttachmentMediaPanelOpen={isAttachmentMediaPanelOpen}
        isPromptExpanded={isPromptExpanded}
        attachmentMediaPanelId={attachmentMediaPanelId}
        submission={submission}
        submittedSettings={submittedSettings}
        onAttachmentMediaPanelToggle={onAttachmentMediaPanelToggle}
      />
    </div>
  );
}

function GenerationResultPrompt({
  canExpand,
  isExpanded,
  prompt,
  promptId,
  onExpandedChange,
}: {
  canExpand: boolean;
  isExpanded: boolean;
  prompt: string;
  promptId: string;
  onExpandedChange: (isExpanded: boolean) => void;
}) {
  if (isExpanded) {
    return (
      <>
        <p
          id={promptId}
          className="text-secondary-foreground text-sm leading-5 break-words whitespace-pre-wrap"
        >
          {prompt}
        </p>
        {canExpand ? (
          <PromptOverflowToggle
            className="mt-2"
            isExpanded
            promptId={promptId}
            onClick={() => onExpandedChange(false)}
          />
        ) : null}
      </>
    );
  }

  return (
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
      {canExpand ? (
        <div
          className="pointer-events-none absolute right-0 bottom-0 z-10 flex h-5 items-center bg-[linear-gradient(to_right,transparent,var(--background)_2.25rem,var(--background)_100%)] pl-12"
          data-slot="generation-result-prompt-overflow-overlay"
        >
          <PromptOverflowToggle
            className="pointer-events-auto h-5 px-1.5 leading-5"
            isExpanded={false}
            promptId={promptId}
            onClick={() => onExpandedChange(true)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SubmittedGenerationMetadata({
  isAttachmentMediaPanelOpen,
  isPromptExpanded,
  attachmentMediaPanelId,
  submission,
  submittedSettings,
  onAttachmentMediaPanelToggle,
}: {
  isAttachmentMediaPanelOpen: boolean;
  isPromptExpanded: boolean;
  attachmentMediaPanelId: string;
  submission: GenerationThreadSubmission;
  submittedSettings: SubmittedGenerationSettingsValue;
  onAttachmentMediaPanelToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        isPromptExpanded
          ? "mt-3"
          : "absolute top-36 right-0 left-0 -translate-y-full",
      )}
    >
      <SubmittedAttachmentMediaBadge
        isPanelOpen={isAttachmentMediaPanelOpen}
        panelId={attachmentMediaPanelId}
        onPanelToggle={onAttachmentMediaPanelToggle}
        attachmentMedia={submission.attachmentMedia}
      />
      <SubmittedGenerationSettings
        modelDisplayName={submission.modelDisplayName}
        settings={submittedSettings}
      />
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

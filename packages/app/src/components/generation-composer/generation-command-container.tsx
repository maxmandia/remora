import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";
import type { GenerationAttachmentMediaValue } from "../../lib/generation/attachment-media.ts";
import {
  generationChromeTransitionDurationMs,
  getGenerationCommandMode,
  type GenerationChromeMotionState,
  type GenerationCommandPhase,
} from "../../lib/generation/generation-command-transition.ts";
import type { GenerationSettingsValue } from "../../lib/generation/generation-settings.ts";
import { AttachmentMediaPreview } from "./attachment-media-preview.tsx";
import { GenerationCommandForm } from "./generation-command-form.tsx";
import { WizardHead } from "./wizard-head.tsx";

type GenerationCommandContainerProps = {
  canSubmit: boolean;
  /**
   * Real generation submissions must wait for an authenticated balance and
   * cost estimate. Guest previews are simulated, so they deliberately bypass
   * affordability without weakening the real submission path.
   */
  requiresAffordability: boolean;
  models: PublishedGenerationModelSummary[];
  prompt: string;
  selectedModel: PublishedGenerationModelSummary | null;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  selectedProjectId: string | null;
  projectSelectorDisabled: boolean;
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
  onBuyCredits: () => void;
  onSelectProject: (projectId: string) => void;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
  onSubmit: () => void;
};

export type { GenerationCommandContainerProps };

export function GenerationCommandContainer(
  props: GenerationCommandContainerProps,
) {
  const [phase, setPhase] = useState<GenerationCommandPhase>("generation");
  const prefersReducedMotion = usePrefersReducedMotion();
  const mode = getGenerationCommandMode(phase);
  const attachmentMotionState = getAttachmentMotionState(phase);

  useEffect(() => {
    if (
      phase !== "entering-prompt-builder" &&
      phase !== "returning-generation"
    ) {
      return;
    }

    const settledPhase =
      phase === "entering-prompt-builder" ? "prompt-builder" : "generation";

    if (prefersReducedMotion) {
      setPhase(settledPhase);
      return;
    }

    const completionTimer = window.setTimeout(
      () => setPhase(settledPhase),
      generationChromeTransitionDurationMs,
    );

    return () => window.clearTimeout(completionTimer);
  }, [phase, prefersReducedMotion]);

  function handleWizardClick() {
    if (phase === "generation") {
      if (prefersReducedMotion) {
        setPhase("prompt-builder");
        return;
      }

      setPhase("entering-prompt-builder");
      return;
    }

    if (phase === "entering-prompt-builder") {
      setPhase("generation");
      return;
    }

    if (phase === "prompt-builder") {
      if (prefersReducedMotion) {
        setPhase("generation");
        return;
      }

      setPhase("returning-generation");
      return;
    }

    if (phase === "returning-generation") {
      setPhase("prompt-builder");
    }
  }

  return (
    <div
      className="group/generation-command relative isolate w-full"
      data-mode={mode}
      data-slot="generation-command-container"
      data-transition-state={phase}
    >
      {attachmentMotionState ? (
        <AttachmentMediaPreview
          motionState={attachmentMotionState}
          selectedModel={props.selectedModel}
          value={props.generationAttachmentMedia}
          onValueChange={props.onGenerationAttachmentMediaChange}
        />
      ) : null}
      <button
        aria-label={
          mode === "generation"
            ? "Open prompt builder"
            : "Return to generation composer"
        }
        aria-pressed={mode === "prompt-builder"}
        className="focus-visible:ring-ring absolute top-0 right-4 z-[5] size-12 -translate-y-3/5 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 outline-none select-none focus-visible:ring-2"
        data-slot="generation-command-wizard"
        type="button"
        onClick={handleWizardClick}
      >
        <WizardHead />
      </button>
      <GenerationCommandForm {...props} phase={phase} />
    </div>
  );
}

function getAttachmentMotionState(
  phase: GenerationCommandPhase,
): GenerationChromeMotionState | null {
  switch (phase) {
    case "generation":
      return "visible";
    case "entering-prompt-builder":
      return "exiting";
    case "prompt-builder":
      return null;
    case "returning-generation":
      return "entering";
  }
}

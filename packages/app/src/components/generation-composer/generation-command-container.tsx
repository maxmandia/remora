import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import type { ProjectSummary } from "@remora/domain/project/dto";
import { cn, toast } from "@remora/ui";
import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";
import { useGenerationVideoDurations } from "../../hooks/use-generation-video-durations.ts";
import type { GenerationWorkspaceReferenceMediaState } from "../../hooks/use-generation-workspace-reference-media.ts";
import {
  getAttachmentMediaVideoDurationSummary,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import {
  generationChromeTransitionDurationMs,
  getGenerationCommandMode,
  type GenerationChromeMotionState,
  type GenerationCommandPhase,
} from "../../lib/generation/generation-command-transition.ts";
import {
  getDefaultGenerationSettings,
  isGenerationSettingsValidForModel,
  type GenerationSettingsValue,
} from "../../lib/generation/generation-settings.ts";
import type { GenerationImageViewerRenderer } from "../generation-results/generation-image-viewer-modal.tsx";
import type { GenerationVideoPlaybackRenderer } from "../generation-results/generation-video-playback-modal.tsx";
import { AttachmentMediaPreview } from "./attachment-media-preview.tsx";
import { GenerationCommandForm } from "./generation-command-form.tsx";
import { WizardHead } from "./wizard-head.tsx";
import { WizardHandwrittenCallout } from "./wizard-handwritten-callout.tsx";

type GenerationCommandContainerProps = {
  canSubmit: boolean;
  referenceMediaState?: GenerationWorkspaceReferenceMediaState;
  focusRequestKey?: number | null;
  /**
   * Real generation submissions must wait for an authenticated balance and
   * cost estimate. Guest previews are simulated, so they deliberately bypass
   * affordability without weakening the real submission path.
   */
  requiresAffordability: boolean;
  renderImageViewer?: GenerationImageViewerRenderer;
  renderVideoViewer?: GenerationVideoPlaybackRenderer;
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
  onPromptBuilderApply: (draft: PromptBuilderAppliedDraft) => void;
  onPromptChange: (prompt: string) => void;
  onSelectProject: (projectId: string) => void;
  onSelectedModelChange: (
    selectedModel: PublishedGenerationModelSummary | null,
  ) => void;
  onSubmit: () => void;
  /**
   * Keeps the wizard button mounted but hidden while the first-visit
   * entrance overlay animates its stand-in into this slot.
   */
  wizardHidden?: boolean;
  wizardCalloutVisible?: boolean;
  onWizardCalloutDismiss?: () => void;
};

type PromptBuilderResult =
  | {
      modelId: string;
      modelType: "image";
      prompt: string;
    }
  | {
      modelId: string;
      modelType: "video";
      prompt: string;
      duration: number;
    };

type PromptBuilderAppliedDraft = {
  model: PublishedGenerationModelSummary;
  prompt: string;
  settings: GenerationSettingsValue;
};

export type {
  GenerationCommandContainerProps,
  PromptBuilderAppliedDraft,
  PromptBuilderResult,
};

export function GenerationCommandContainer(
  props: GenerationCommandContainerProps,
) {
  const [phase, setPhase] = useState<GenerationCommandPhase>("generation");
  const [promptBuilderPrompt, setPromptBuilderPrompt] = useState("");
  const hasOpenedPromptBuilderRef = useRef(false);
  const prefersReducedMotion = usePrefersReducedMotion();
  const mode = getGenerationCommandMode(phase);
  const attachmentMotionState = getAttachmentMotionState(phase);
  const {
    durationSecByItem: videoDurationSecByItem,
    isPending: isVideoDurationPending,
  } = useGenerationVideoDurations(props.generationAttachmentMedia.videos);
  const videoDurationSummary = getAttachmentMediaVideoDurationSummary({
    durationSecByItem: videoDurationSecByItem,
    isPending: isVideoDurationPending,
    selectedModel: props.selectedModel,
    value: props.generationAttachmentMedia,
  });
  const hasVideoDurationIssue =
    videoDurationSummary !== null &&
    (videoDurationSummary.status !== "ready" ||
      videoDurationSummary.isOverLimit);

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

  useEffect(() => {
    if (props.focusRequestKey !== null && props.focusRequestKey !== undefined) {
      setPhase("generation");
    }
  }, [props.focusRequestKey]);

  function handleWizardClick() {
    if (props.wizardHidden) {
      return;
    }

    if (props.wizardCalloutVisible) {
      props.onWizardCalloutDismiss?.();
    }

    if (phase === "generation") {
      if (!hasOpenedPromptBuilderRef.current) {
        hasOpenedPromptBuilderRef.current = true;
        setPromptBuilderPrompt(props.prompt);
      }

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
      returnToGeneration();
      return;
    }

    if (phase === "returning-generation") {
      setPhase("prompt-builder");
    }
  }

  function handlePromptBuilderSuccess(result: PromptBuilderResult) {
    const targetModel = props.models.find(
      (model) => model.id === result.modelId && model.type === result.modelType,
    );

    if (!targetModel) {
      toast.error("The prompt builder target model is unavailable.");
      return;
    }

    const canPreserveSettings =
      props.selectedModel?.id === targetModel.id &&
      props.generationSettings !== null &&
      isGenerationSettingsValidForModel(targetModel, props.generationSettings);
    const baseSettings = canPreserveSettings
      ? props.generationSettings
      : getDefaultGenerationSettings(targetModel);

    if (!baseSettings || baseSettings.modelType !== result.modelType) {
      toast.error("The prompt builder result could not be applied.");
      return;
    }

    const nextSettings: GenerationSettingsValue =
      result.modelType === "video" && baseSettings.modelType === "video"
        ? { ...baseSettings, duration: result.duration }
        : baseSettings;

    if (!isGenerationSettingsValidForModel(targetModel, nextSettings)) {
      toast.error("The prompt builder returned unsupported settings.");
      return;
    }

    props.onPromptBuilderApply({
      model: targetModel,
      prompt: result.prompt,
      settings: nextSettings,
    });
    setPromptBuilderPrompt("");

    if (phase === "prompt-builder") {
      returnToGeneration();
    }
  }

  function returnToGeneration() {
    setPhase(prefersReducedMotion ? "generation" : "returning-generation");
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
          renderImageViewer={props.renderImageViewer}
          renderVideoViewer={props.renderVideoViewer}
          selectedModel={props.selectedModel}
          value={props.generationAttachmentMedia}
          onValueChange={props.onGenerationAttachmentMediaChange}
        />
      ) : null}
      <WizardHandwrittenCallout
        visible={Boolean(props.wizardCalloutVisible && !props.wizardHidden)}
        onDismiss={props.onWizardCalloutDismiss}
      />
      <button
        aria-label={
          mode === "generation"
            ? "Open prompt builder"
            : "Return to generation composer"
        }
        aria-pressed={mode === "prompt-builder"}
        className={cn(
          "focus-visible:ring-ring absolute top-0 right-4 z-[5] size-12 -translate-y-3/5 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 outline-none select-none focus-visible:ring-2",
          props.wizardHidden && "invisible",
        )}
        data-entrance-hidden={props.wizardHidden ? "true" : undefined}
        data-slot="generation-command-wizard"
        tabIndex={props.wizardHidden ? -1 : undefined}
        type="button"
        onClick={handleWizardClick}
      >
        <WizardHead />
      </button>
      <GenerationCommandForm
        {...props}
        canSubmit={props.canSubmit && !hasVideoDurationIssue}
        isVideoDurationPending={isVideoDurationPending}
        phase={phase}
        promptBuilderPrompt={promptBuilderPrompt}
        videoDurationSecByItem={videoDurationSecByItem}
        videoDurationSummary={videoDurationSummary}
        onPromptBuilderPromptChange={setPromptBuilderPrompt}
        onPromptBuilderSuccess={handlePromptBuilderSuccess}
      />
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

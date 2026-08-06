import { cn } from "@remora/ui";
import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

import {
  getMultiGenerationPanelShiftTransform,
  multiGenerationPanelShiftClassName,
} from "../../lib/generation/generation-preview.ts";
import { WizardEntranceOverlay } from "./wizard-entrance-overlay.tsx";

export type GenerationWorkspaceStageProps = {
  branding?: {
    alt: string;
    src: string;
  };
  centeredContent?: ReactNode;
  className?: string;
  composer: ReactNode;
  isSupplementalOpen: boolean;
  onWizardEntranceComplete?: () => void;
  results?: ReactNode;
  welcomeTopOffset?: string;
  wizardEntranceActive?: boolean;
};

const generationWorkspaceStageStyle = {
  containerType: "inline-size",
  "--remora-generation-composer-bottom-inset": "clamp(1rem, 3.5vh, 2.5rem)",
  "--remora-generation-content-max-width": "60rem",
  "--remora-generation-content-compact-min-width": "36rem",
  "--remora-generation-stage-inline-inset": "1.5rem",
  "--remora-generation-stage-available-width":
    "calc(100cqi - var(--remora-generation-stage-inline-inset) - var(--remora-generation-stage-inline-inset))",
  "--remora-generation-content-base-width":
    "min(var(--remora-generation-content-max-width), var(--remora-generation-stage-available-width))",
  "--remora-generation-content-stack-panel-aware-width":
    "max(var(--remora-generation-content-compact-min-width), min(var(--remora-generation-content-base-width), calc(var(--remora-generation-stage-available-width) - var(--remora-generation-stack-panel-shift-width) - var(--remora-generation-stack-panel-gap))))",
  "--remora-generation-composer-block-height":
    "var(--remora-generation-composer-measured-height, 10.25rem)",
  "--remora-generation-results-bottom-gap": "1rem",
  "--remora-generation-results-bottom-reserve":
    "calc(var(--remora-generation-composer-bottom-inset) + var(--remora-generation-composer-block-height) + var(--remora-generation-results-bottom-gap))",
  "--remora-generation-stack-panel-gap": "1rem",
  "--remora-generation-stack-panel-base-width": "clamp(12rem, 28cqi, 22rem)",
  "--remora-generation-stack-panel-expanded-width":
    "max(var(--remora-generation-stack-panel-base-width), calc((var(--remora-generation-stage-available-width) - var(--remora-generation-content-width) + var(--remora-generation-stack-panel-shift-width) - var(--remora-generation-stack-panel-gap)) / 2))",
  "--remora-generation-stack-panel-shift-width":
    "var(--remora-generation-stack-panel-base-width)",
  "--remora-generation-stack-panel-width":
    "var(--remora-generation-stack-panel-base-width)",
  "--remora-preview-stack-overflow-inset": "1.5rem",
} as CSSProperties;

export function GenerationWorkspaceStage({
  branding,
  centeredContent,
  className,
  composer,
  isSupplementalOpen,
  onWizardEntranceComplete,
  results,
  welcomeTopOffset = "0px",
  wizardEntranceActive = false,
}: GenerationWorkspaceStageProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const brandingImageRef = useRef<HTMLImageElement | null>(null);
  const composerLayoutRef = useRef<HTMLDivElement | null>(null);
  const [composerMeasuredHeight, setComposerMeasuredHeight] = useState(0);
  const contentWidth = isSupplementalOpen
    ? "var(--remora-generation-content-stack-panel-aware-width)"
    : "var(--remora-generation-content-base-width)";
  const style = {
    ...generationWorkspaceStageStyle,
    "--remora-generation-content-width": contentWidth,
    "--remora-generation-welcome-top-offset": welcomeTopOffset,
    ...(composerMeasuredHeight > 0
      ? {
          "--remora-generation-composer-measured-height": `${composerMeasuredHeight}px`,
        }
      : {}),
  } as CSSProperties;

  useLayoutEffect(() => {
    function measureComposerLayoutHeight() {
      const composerLayout = composerLayoutRef.current;

      if (!composerLayout) {
        return;
      }

      const measuredHeight = Math.ceil(
        composerLayout.getBoundingClientRect().height,
      );

      if (measuredHeight <= 0) {
        return;
      }

      setComposerMeasuredHeight((currentHeight) =>
        currentHeight === measuredHeight ? currentHeight : measuredHeight,
      );
    }

    measureComposerLayoutHeight();

    const composerLayout = composerLayoutRef.current;
    const Observer = window.ResizeObserver;
    const resizeObserver =
      typeof Observer === "function"
        ? new Observer(measureComposerLayoutHeight)
        : null;

    if (composerLayout) {
      resizeObserver?.observe(composerLayout);
    }

    window.addEventListener("resize", measureComposerLayoutHeight);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", measureComposerLayoutHeight);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className={cn(
        "relative isolate h-full min-h-[28rem] w-full overflow-hidden",
        className,
      )}
      data-testid="generation-composer-stage"
      style={style}
    >
      {results}
      {branding || centeredContent ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-[var(--remora-generation-welcome-top-offset)] bottom-0 z-[1] grid grid-rows-[minmax(0,1fr)_auto_minmax(var(--remora-generation-results-bottom-reserve),1fr)]"
          data-slot="generation-workspace-welcome"
        >
          <div className="row-start-2 flex w-[min(52rem,var(--remora-generation-content-width))] justify-self-center flex-col items-center gap-8">
            {branding ? (
              <img
                ref={brandingImageRef}
                alt={branding.alt}
                className="h-auto w-[min(20.5rem,calc(100%_-_3rem))] select-none"
                draggable={false}
                src={branding.src}
              />
            ) : null}
            {centeredContent ? (
              <div
                className="pointer-events-auto w-full"
                data-slot="generation-workspace-centered-content"
              >
                {centeredContent}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <div
        className="absolute bottom-[var(--remora-generation-composer-bottom-inset)] left-1/2 z-[3] w-[var(--remora-generation-content-width)] -translate-x-1/2"
        data-testid="generation-composer"
      >
        <div
          ref={composerLayoutRef}
          className={cn(
            "relative isolate w-full",
            multiGenerationPanelShiftClassName,
          )}
          data-stack-panel-state={isSupplementalOpen ? "open" : "closed"}
          data-slot="generation-composer-layout"
          style={{
            transform:
              getMultiGenerationPanelShiftTransform(isSupplementalOpen),
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[var(--remora-generation-results-bottom-reserve)] bg-[var(--remora-stage-background,var(--background))]"
            data-slot="generation-composer-dock-occlusion"
          />
          {composer}
        </div>
      </div>
      {wizardEntranceActive && onWizardEntranceComplete ? (
        <WizardEntranceOverlay
          logoRef={brandingImageRef}
          stageRef={stageRef}
          onComplete={onWizardEntranceComplete}
        />
      ) : null}
    </div>
  );
}

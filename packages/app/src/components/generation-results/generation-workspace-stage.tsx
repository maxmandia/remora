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

export type GenerationWorkspaceStagePlacement = "centered" | "docked";

export type GenerationWorkspaceStageProps = {
  branding?: {
    alt: string;
    src: string;
  };
  className?: string;
  composer: ReactNode;
  isSupplementalOpen: boolean;
  placement: GenerationWorkspaceStagePlacement;
  results?: ReactNode;
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
  className,
  composer,
  isSupplementalOpen,
  placement,
  results,
}: GenerationWorkspaceStageProps) {
  const composerLayoutRef = useRef<HTMLDivElement | null>(null);
  const [composerMeasuredHeight, setComposerMeasuredHeight] = useState(0);
  const contentWidth = isSupplementalOpen
    ? "var(--remora-generation-content-stack-panel-aware-width)"
    : "var(--remora-generation-content-base-width)";
  const style = {
    ...generationWorkspaceStageStyle,
    "--remora-generation-content-width": contentWidth,
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
      className={cn(
        "relative isolate h-full min-h-[28rem] w-full overflow-hidden",
        className,
      )}
      data-placement={placement}
      data-testid="generation-composer-stage"
      style={style}
    >
      {results}
      {branding ? (
        <img
          alt={placement === "centered" ? branding.alt : ""}
          aria-hidden={placement === "centered" ? undefined : "true"}
          className="pointer-events-none absolute left-1/2 z-[1] h-auto w-[min(20.5rem,calc(100%_-_3rem))] -translate-x-1/2 transition-[top,translate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,translate] select-none data-[placement=centered]:top-[calc(50%_-_10.5rem)] data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset)_-_var(--remora-generation-composer-block-height)_+_1rem)] motion-reduce:transition-none"
          data-placement={placement}
          draggable={false}
          src={branding.src}
        />
      ) : null}
      <div
        className="absolute left-1/2 z-[3] w-[var(--remora-generation-content-width)] -translate-x-1/2 transition-[top,translate] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[top,translate] data-[placement=centered]:top-1/2 data-[placement=centered]:translate-y-[-8%] data-[placement=docked]:top-[calc(100%_-_var(--remora-generation-composer-bottom-inset))] data-[placement=docked]:-translate-y-full motion-reduce:transition-none"
        data-placement={placement}
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
          {placement === "docked" ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[var(--remora-generation-results-bottom-reserve)] bg-[var(--remora-stage-background,var(--background))]"
              data-slot="generation-composer-dock-occlusion"
            />
          ) : null}
          {composer}
        </div>
      </div>
    </div>
  );
}

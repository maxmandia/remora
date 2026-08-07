import { FilmIcon, MegaphoneIcon, PaletteIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import {
  creativeCategoryDetails,
  type CreativeCategory,
} from "../explore/creative-category.ts";

const SPROCKET_SLOT_COUNT = 24;
const SPROCKET_SLOT_WIDTH_PERCENT = 100 / SPROCKET_SLOT_COUNT;
const SPROCKET_HOLE_WIDTH_PERCENT = SPROCKET_SLOT_WIDTH_PERCENT * (10 / 24);
const PREVIEW_EXIT_DURATION_MS = 200;

type FilmRailEdge = "bottom" | "top";

type FilmRailDetail = {
  // Slot boundaries (0..SPROCKET_SLOT_COUNT) holding a white exposure square
  // between two sprocket holes, like light-struck frames on developed negatives.
  exposureSlots: number[];
  frameNumbers: { slot: number; value: string }[];
  scratches: { widthPercent: number; xPercent: number; y: number }[];
};

const filmRailDetail: Record<FilmRailEdge, FilmRailDetail> = {
  top: {
    exposureSlots: [5, 13, 21],
    frameNumbers: [],
    scratches: [
      { widthPercent: 3, xPercent: 31, y: 2 },
      { widthPercent: 1.8, xPercent: 74.5, y: 11 },
    ],
  },
  bottom: {
    exposureSlots: [2, 9, 17],
    frameNumbers: [
      { slot: 4, value: "47" },
      { slot: 12, value: "48" },
      { slot: 20, value: "49" },
    ],
    scratches: [{ widthPercent: 2.6, xPercent: 61, y: 11.5 }],
  },
};

function toRailPercent(value: number) {
  return `${value.toFixed(3)}%`;
}

function GenerationCreativeCategoryCtas({
  onSelectCategory,
}: {
  onSelectCategory: (category: CreativeCategory) => void;
}) {
  return (
    <div
      aria-label="Creative categories"
      className="relative isolate mx-auto w-full max-w-[36rem] overflow-hidden rounded-none border-0 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface-strong),white_3%)_0%,color-mix(in_srgb,var(--surface-strong),#0c0a06_42%)_100%)] px-[6px] py-[14px] shadow-none"
      role="group"
    >
      <FilmSprocketRail edge="top" />
      <FilmSprocketRail edge="bottom" />

      <div className="relative z-10 grid min-w-0 grid-cols-3 gap-1">
        <CreativeCategoryCta
          category="film"
          label="Film"
          subtitle="Explore stories"
          icon={<FilmIcon className="mb-[1px] size-3 text-blue-500" />}
          videoUrl={creativeCategoryDetails.film.videoUrl}
          onSelect={onSelectCategory}
        />
        <CreativeCategoryCta
          category="ads"
          label="Ads"
          subtitle="Explore campaigns"
          icon={<MegaphoneIcon className="mb-[1px] size-3 text-green-500" />}
          videoUrl={creativeCategoryDetails.ads.videoUrl}
          onSelect={onSelectCategory}
        />
        <CreativeCategoryCta
          category="art"
          label="Art"
          subtitle="Explore visuals"
          icon={<PaletteIcon className="mb-[1px] size-3 text-purple-500" />}
          videoUrl={creativeCategoryDetails.art.videoUrl}
          onSelect={onSelectCategory}
        />
      </div>
    </div>
  );
}

type FilmSprocketRailProps = {
  edge: "bottom" | "top";
};

function FilmSprocketRail({ edge }: FilmSprocketRailProps) {
  const { exposureSlots, frameNumbers, scratches } = filmRailDetail[edge];

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute left-[6px] z-20 h-[14px] w-[calc(100%-12px)] data-[edge=bottom]:bottom-0 data-[edge=top]:top-0"
      data-edge={edge}
      data-slot="film-sprocket-rail"
    >
      {Array.from({ length: SPROCKET_SLOT_COUNT }, (_, slot) => (
        <rect
          key={slot}
          fill="var(--remora-stage-background, var(--background))"
          height={6}
          rx={1.5}
          width={toRailPercent(SPROCKET_HOLE_WIDTH_PERCENT)}
          x={toRailPercent(
            slot * SPROCKET_SLOT_WIDTH_PERCENT +
              (SPROCKET_SLOT_WIDTH_PERCENT - SPROCKET_HOLE_WIDTH_PERCENT) / 2,
          )}
          y={4}
        />
      ))}

      {exposureSlots.map((slot) => (
        <rect
          key={slot}
          fill="white"
          fillOpacity={0.3}
          height={6}
          rx={1.5}
          width={toRailPercent(SPROCKET_HOLE_WIDTH_PERCENT)}
          x={toRailPercent(
            slot * SPROCKET_SLOT_WIDTH_PERCENT -
              SPROCKET_HOLE_WIDTH_PERCENT / 2,
          )}
          y={4}
        />
      ))}

      {scratches.map((scratch) => (
        <rect
          key={scratch.xPercent}
          fill="white"
          fillOpacity={0.05}
          height={1}
          width={toRailPercent(scratch.widthPercent)}
          x={toRailPercent(scratch.xPercent)}
          y={scratch.y}
        />
      ))}

      {frameNumbers.map(({ slot, value }) => (
        <text
          key={slot}
          className="fill-amber-50/45 font-mono text-[6.5px] tracking-[0.08em]"
          textAnchor="middle"
          x={toRailPercent(slot * SPROCKET_SLOT_WIDTH_PERCENT)}
          y={9.5}
        >
          {value}
        </text>
      ))}
    </svg>
  );
}

type CreativeCategoryCtaProps = {
  category: CreativeCategory;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  videoUrl: string;
  onSelect: (category: CreativeCategory) => void;
};

function CreativeCategoryCta({
  category,
  label,
  subtitle,
  icon,
  videoUrl,
  onSelect,
}: CreativeCategoryCtaProps) {
  const subtitleId = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseHoveredRef = useRef(false);
  const playbackAttemptRef = useRef(0);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  function clearExitTimer() {
    if (exitTimerRef.current === null) {
      return;
    }

    clearTimeout(exitTimerRef.current);
    exitTimerRef.current = null;
  }

  function pauseAndResetPreview() {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    video.pause();
    video.currentTime = 0;
  }

  useEffect(() => {
    return () => {
      playbackAttemptRef.current += 1;
      clearExitTimer();
      pauseAndResetPreview();
    };
  }, []);

  function handlePointerEnter(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse") {
      return;
    }

    isMouseHoveredRef.current = true;
    clearExitTimer();
    setIsPreviewVisible(false);

    const video = videoRef.current;

    if (!video) {
      return;
    }

    const playbackAttempt = playbackAttemptRef.current + 1;

    playbackAttemptRef.current = playbackAttempt;
    pauseAndResetPreview();
    void video.play().catch(() => {
      if (playbackAttemptRef.current === playbackAttempt) {
        setIsPreviewVisible(false);
      }
    });
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || !isMouseHoveredRef.current) {
      return;
    }

    isMouseHoveredRef.current = false;
    playbackAttemptRef.current += 1;
    setIsPreviewVisible(false);
    clearExitTimer();
    exitTimerRef.current = setTimeout(() => {
      pauseAndResetPreview();
      exitTimerRef.current = null;
    }, PREVIEW_EXIT_DURATION_MS);
  }

  return (
    <button
      aria-describedby={subtitleId}
      aria-label={label}
      className="bg-surface-strong relative isolate flex min-h-[4rem] min-w-0 cursor-pointer flex-col items-start justify-center gap-[3px] overflow-hidden rounded-none border border-transparent px-[clamp(0.75rem,2.5cqi,1.25rem)] py-4 text-left backdrop-blur-xl backdrop-saturate-125 transition-[background-color,transform] duration-200 ease-out outline-none hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)] focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
      onClick={() => onSelect(category)}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      type="button"
    >
      <video
        ref={videoRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 size-full object-cover opacity-0 transition-opacity duration-200 ease-out data-[state=visible]:opacity-10"
        data-slot="creative-category-preview"
        data-state={isPreviewVisible ? "visible" : "hidden"}
        loop
        muted
        onError={() => {
          playbackAttemptRef.current += 1;
          setIsPreviewVisible(false);
          clearExitTimer();
          pauseAndResetPreview();
        }}
        onPlaying={() => {
          if (isMouseHoveredRef.current) {
            setIsPreviewVisible(true);
          }
        }}
        playsInline
        preload="auto"
        src={videoUrl}
        tabIndex={-1}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] bg-amber-400/10 opacity-0 mix-blend-color transition-opacity duration-200 ease-out data-[state=visible]:opacity-100"
        data-slot="creative-category-preview-filter"
        data-state={isPreviewVisible ? "visible" : "hidden"}
      />

      <div
        className="relative z-10 flex min-w-0 flex-col items-start gap-[3px]"
        data-slot="creative-category-content"
      >
        <div className="flex items-center gap-1">
          {icon}
          <span className="text-foreground/90 block max-w-full truncate text-[clamp(0.75rem,2.4cqi,0.95rem)] leading-[1.15] font-normal tracking-[-0.01em]">
            {label}
          </span>
        </div>

        <span
          className="text-foreground/55 block max-w-full truncate text-[clamp(0.75rem,2.4cqi,0.95rem)] leading-[1.2] font-light tracking-[-0.005em]"
          id={subtitleId}
        >
          {subtitle}
        </span>
      </div>
    </button>
  );
}

export { GenerationCreativeCategoryCtas };

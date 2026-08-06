import { FilmIcon, MegaphoneIcon, PaletteIcon } from "lucide-react";
import { useId } from "react";

const SPROCKET_SLOT_COUNT = 24;
const SPROCKET_SLOT_WIDTH_PERCENT = 100 / SPROCKET_SLOT_COUNT;
const SPROCKET_HOLE_WIDTH_PERCENT = SPROCKET_SLOT_WIDTH_PERCENT * (10 / 24);

type FilmRailEdge = "bottom" | "top";

type FilmRailDetail = {
  // Slot boundaries (0..SPROCKET_SLOT_COUNT) holding a magenta exposure square
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

function GenerationCreativeCategoryCtas() {
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
          label="Film"
          subtitle="Explore stories"
          icon={<FilmIcon className="mb-[1px] size-3 text-blue-500" />}
        />
        <CreativeCategoryCta
          label="Ads"
          subtitle="Explore campaigns"
          icon={<MegaphoneIcon className="mb-[1px] size-3 text-green-500" />}
        />
        <CreativeCategoryCta
          label="Art"
          subtitle="Explore visuals"
          icon={<PaletteIcon className="mb-[1px] size-3 text-purple-500" />}
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
          fill="#b83280"
          fillOpacity={0.45}
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
  label: string;
  subtitle: string;
  icon: React.ReactNode;
};

function CreativeCategoryCta({
  label,
  subtitle,
  icon,
}: CreativeCategoryCtaProps) {
  const subtitleId = useId();

  return (
    <button
      aria-describedby={subtitleId}
      aria-label={label}
      className="bg-surface-strong relative isolate flex min-h-[4rem] min-w-0 cursor-pointer flex-col items-start justify-center gap-[3px] overflow-hidden rounded-none border border-transparent px-[clamp(0.75rem,2.5cqi,1.25rem)] py-4 text-left backdrop-blur-xl backdrop-saturate-125 transition-[background-color,transform] duration-200 ease-out outline-none hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)] focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-inset active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
      type="button"
    >
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-foreground/90 relative z-10 block max-w-full truncate text-[clamp(0.75rem,2.4cqi,0.95rem)] leading-[1.15] font-normal tracking-[-0.01em]">
          {label}
        </span>
      </div>

      <span
        className="text-foreground/55 relative z-10 block max-w-full truncate text-[clamp(0.75rem,2.4cqi,0.95rem)] leading-[1.2] font-light tracking-[-0.005em]"
        id={subtitleId}
      >
        {subtitle}
      </span>
    </button>
  );
}

export { GenerationCreativeCategoryCtas };

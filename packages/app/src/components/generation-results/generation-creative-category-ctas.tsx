import { FilmIcon, MegaphoneIcon, PaletteIcon } from "lucide-react";
import { useId } from "react";

function GenerationCreativeCategoryCtas() {
  return (
    <div
      aria-label="Creative categories"
      className="mx-auto grid w-full max-w-[36rem] grid-cols-3 gap-2"
      role="group"
    >
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
      className="bg-surface-strong relative isolate flex min-h-[4rem] min-w-0 cursor-pointer flex-col items-start justify-center gap-[3px] overflow-hidden rounded-lg border border-white/[0.12] px-[clamp(0.75rem,2.5cqi,1.25rem)] py-4 text-left shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(0_0_0/0.18),0_8px_24px_rgb(0_0_0/0.22)] backdrop-blur-xl backdrop-saturate-125 transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out outline-none before:pointer-events-none before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-[linear-gradient(180deg,rgb(255_255_255/0.055)_0%,rgb(255_255_255/0.02)_42%,rgb(0_0_0/0.04)_100%)] before:content-[''] after:pointer-events-none after:absolute after:inset-x-4 after:top-0 after:h-px after:bg-[linear-gradient(90deg,transparent,rgb(255_255_255/0.3),transparent)] after:content-[''] hover:border-white/[0.18] hover:bg-[color-mix(in_srgb,var(--surface-strong),var(--surface-strong-foreground)_4%)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.18),inset_0_-1px_0_rgb(0_0_0/0.16),0_10px_28px_rgb(0_0_0/0.26)] focus-visible:border-white/[0.28] focus-visible:ring-2 focus-visible:ring-white/30 active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0"
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

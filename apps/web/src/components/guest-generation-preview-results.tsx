import {
  DotFieldSkeleton,
  GenerationSubmittedInput,
  type GenerationSettingsValue,
} from "@remora/app/generation";

export function GuestGenerationPreviewResults({
  modelDisplayName,
  prompt,
  settings,
}: {
  modelDisplayName: string;
  prompt: string;
  settings: GenerationSettingsValue;
}) {
  return (
    <section
      aria-label="Guest generation preview"
      className="absolute inset-0 z-[2] flex min-h-[inherit] flex-col overflow-x-hidden overflow-y-auto pt-[clamp(2rem,6vh,3rem)]"
      data-slot="guest-generation-preview-results"
    >
      <div className="mx-auto flex min-h-0 w-[var(--remora-generation-content-width)] flex-1 flex-col">
        <div className="-mt-[var(--remora-preview-stack-overflow-inset)] flex flex-col gap-10 pt-[var(--remora-preview-stack-overflow-inset)]">
          <article className="flex w-full flex-nowrap items-start gap-6">
            <DotFieldSkeleton
              aria-label="Preparing guest generation"
              className="size-40 shrink-0"
            />
            <GenerationSubmittedInput
              modelDisplayName={modelDisplayName}
              prompt={prompt}
              settings={settings}
            />
          </article>
          <div
            aria-hidden="true"
            className="h-[var(--remora-generation-results-bottom-reserve)] shrink-0"
          />
        </div>
      </div>
    </section>
  );
}

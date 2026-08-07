import { ArrowLeftIcon } from "lucide-react";

import { type CreativeCategory } from "./creative-category.ts";

type ExplorePageProps = {
  category?: CreativeCategory;
  onBack: () => void;
  onSelectCategory: (category: CreativeCategory) => void;
  onStartCreating: () => void;
};

function ExplorePage({
  category,
  onBack,
  onSelectCategory,
  onStartCreating,
}: ExplorePageProps) {
  return (
    <main className="bg-background text-foreground relative h-full min-h-full overflow-auto">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_srgb,var(--foreground),transparent_93%),transparent_45%)]"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-[90rem] flex-col px-5 py-5 sm:px-8 sm:py-7 lg:px-12">
        <header className="flex items-center justify-between gap-4">
          <button
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -ml-2 inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors outline-none hover:cursor-pointer focus-visible:ring-2"
            onClick={onBack}
            type="button"
          >
            <ArrowLeftIcon className="size-4" />
            Back to create
          </button>
        </header>
      </div>
    </main>
  );
}

export { ExplorePage, type ExplorePageProps };

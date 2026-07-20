import {
  publishedModelPages,
  type ModelPageMetadata,
} from "../lib/seo/model-pages";
import { SiteFooter } from "./site-footer";

const selectionCapturedAt = "July 16, 2026";

export function ModelsPage({
  models = publishedModelPages,
}: {
  models?: ModelPageMetadata[];
}) {
  const imageModels = models
    .filter((model) => model.modality === "image")
    .sort((left, right) => left.title.localeCompare(right.title));
  const videoModels = models
    .filter((model) => model.modality === "video")
    .sort((left, right) => left.title.localeCompare(right.title));

  return (
    <main className="flex min-h-svh flex-col bg-[#101111] px-5 py-6 text-[#f7f3eb] sm:px-8 lg:px-10">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between border-b border-white/10 pb-6">
        <a
          href="/"
          aria-label="Remora home"
          className="rounded-sm focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          <img
            src="/remora-wordmark.svg"
            alt="Remora"
            className="h-auto w-27 select-none"
            draggable={false}
          />
        </a>
        <a
          href="/"
          className="rounded-sm text-sm text-[#a7a59f] transition-colors hover:text-[#f7f3eb] focus-visible:text-[#f7f3eb] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:ring-offset-4 focus-visible:ring-offset-[#101111] focus-visible:outline-none"
        >
          Back to home
        </a>
      </header>

      <section className="mx-auto w-full max-w-7xl flex-1 py-14 sm:py-20">
        <header className="max-w-3xl">
          <p className="mb-4 text-xs font-medium tracking-[0.18em] text-[#8f8e89] uppercase">
            Model directory
          </p>
          <h1 className="text-4xl font-medium tracking-[-0.03em] text-balance sm:text-5xl">
            Generative media models
          </h1>
          <p className="mt-5 text-base leading-7 font-light text-[#aaa8a2] sm:text-lg">
            A practical reference for image and video generation models, their
            variants, and the controls that distinguish them.
          </p>
        </header>

        <nav
          aria-label="Model directory sections"
          className="mt-10 flex flex-wrap gap-3"
        >
          <a
            href="#image-models"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#d3d0c9] transition-colors hover:border-white/20 hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:outline-none"
          >
            Image models{" "}
            <span className="text-[#777570]">{imageModels.length}</span>
          </a>
          <a
            href="#video-models"
            className="rounded-full border border-white/10 px-4 py-2 text-sm text-[#d3d0c9] transition-colors hover:border-white/20 hover:bg-white/[0.035] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:outline-none"
          >
            Video models{" "}
            <span className="text-[#777570]">{videoModels.length}</span>
          </a>
        </nav>

        <p className="mt-7 max-w-3xl text-xs leading-5 text-[#777570]">
          Selection informed by the Artificial Analysis{" "}
          <a
            href="https://artificialanalysis.ai/image/leaderboard/text-to-image"
            className="underline decoration-white/30 underline-offset-4 transition-colors hover:text-[#f7f3eb] hover:decoration-white"
          >
            text-to-image
          </a>{" "}
          and{" "}
          <a
            href="https://artificialanalysis.ai/video/leaderboard/text-to-video"
            className="underline decoration-white/30 underline-offset-4 transition-colors hover:text-[#f7f3eb] hover:decoration-white"
          >
            text-to-video
          </a>{" "}
          leaderboards, captured {selectionCapturedAt}. Model facts are sourced
          independently from their developers.
        </p>

        <ModelDirectorySection
          id="image-models"
          title="Image models"
          models={imageModels}
        />
        <ModelDirectorySection
          id="video-models"
          title="Video models"
          models={videoModels}
        />
      </section>

      <SiteFooter />
    </main>
  );
}

function ModelDirectorySection({
  id,
  models,
  title,
}: {
  id: string;
  models: ModelPageMetadata[];
  title: string;
}) {
  return (
    <section id={id} className="scroll-mt-8 pt-16 sm:pt-20">
      <div className="flex items-end justify-between gap-5 border-b border-white/10 pb-5">
        <h2 className="text-2xl font-medium tracking-[-0.025em] sm:text-3xl">
          {title}
        </h2>
        <p className="text-sm text-[#777570]">
          {models.length} {models.length === 1 ? "model" : "models"}
        </p>
      </div>

      {models.length ? (
        <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {models.map((model) => (
            <li key={model.slug}>
              <a
                href={`/models/${model.slug}`}
                className="group flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.025] p-6 transition-colors hover:border-white/20 hover:bg-white/[0.045] focus-visible:ring-2 focus-visible:ring-[#8da0dc] focus-visible:outline-none"
              >
                <div className="flex items-center justify-between gap-4 text-xs tracking-[0.12em] text-[#8f8e89] uppercase">
                  <span>{model.developer}</span>
                  <span>{model.variant}</span>
                </div>
                <h3 className="mt-8 text-xl font-medium tracking-[-0.02em] text-[#f7f3eb]">
                  {model.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 font-light text-[#aaa8a2]">
                  {model.description}
                </p>
                <span className="mt-7 text-sm text-[#e5e1d9] transition-transform group-hover:translate-x-1">
                  Explore model <span aria-hidden="true">→</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-sm text-[#777570]">No published models yet.</p>
      )}
    </section>
  );
}

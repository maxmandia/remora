import { MacosDownloadButton } from "./macos-download-button";

export function ModelDownloadCta({
  downloadUrl,
  variant,
}: {
  downloadUrl?: string;
  variant: "compact" | "full";
}) {
  if (variant === "compact") {
    return (
      <section
        aria-labelledby="compact-model-download-cta"
        className="mt-8 rounded-xl border border-[#8da0dc]/20 bg-[#8da0dc]/[0.06] px-5 py-5 sm:mt-10 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-6 sm:py-6"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-medium tracking-[0.16em] text-[#9da9d0] uppercase">
            Remora for macOS
          </p>
          <h2
            id="compact-model-download-cta"
            className="mt-2 text-xl font-medium tracking-[-0.02em] sm:text-2xl"
          >
            Create with Remora on macOS
          </h2>
          <p className="mt-2 text-sm leading-6 font-light text-[#aaa8a2]">
            Bring image and video generation into one focused desktop workspace.
          </p>
        </div>
        <div className="mt-5 shrink-0 sm:mt-0">
          <MacosDownloadButton downloadUrl={downloadUrl} />
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="full-model-download-cta"
      className="mt-14 rounded-2xl border border-white/10 bg-[#171919] px-6 py-8 sm:px-9 sm:py-10"
    >
      <p className="text-xs font-medium tracking-[0.16em] text-[#8f8e89] uppercase">
        Remora for macOS
      </p>
      <h2
        id="full-model-download-cta"
        className="mt-4 text-2xl font-medium tracking-[-0.025em] sm:text-3xl"
      >
        Create generative media with Remora
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 font-light text-[#aaa8a2] sm:text-base sm:leading-7">
        Bring image and video generation into one focused desktop workspace
        designed for fast iteration, clear controls, and dependable project
        organization.
      </p>
      <div className="mt-7">
        <MacosDownloadButton downloadUrl={downloadUrl} />
      </div>
    </section>
  );
}

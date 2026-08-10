import { Button } from "@remora/ui";
import { ArrowRightIcon } from "lucide-react";

import {
  exploreArtworks,
  type ExploreArtworkDetails,
  type ExploreArtworkKey,
} from "../../lib/explore/explore.ts";

export type ExploreArtGalleryProps = {
  onTryPrompt: (key: ExploreArtworkKey) => void;
};

export function ExploreArtGallery({ onTryPrompt }: ExploreArtGalleryProps) {
  return (
    <section
      aria-labelledby="explore-art-gallery-title"
      className="mx-auto w-full max-w-[76rem] px-[var(--explore-scene-edge)] pt-[clamp(5rem,12vh,9rem)] pb-[clamp(10rem,18vh,15rem)]"
      data-slot="explore-art-gallery"
    >
      <h1 className="sr-only" id="explore-art-gallery-title">
        Art gallery
      </h1>

      <div className="columns-1 gap-x-[clamp(5rem,10vw,9rem)] lg:columns-2">
        {exploreArtworks.map((artwork, artworkIndex) => (
          <figure
            className="relative mb-[clamp(8rem,16vw,14rem)] break-inside-avoid md:data-[scale=intimate]:mx-auto md:data-[scale=intimate]:w-[76%] md:data-[scale=quiet]:ml-auto md:data-[scale=quiet]:w-[86%]"
            data-scale={
              artworkIndex % 4 === 1
                ? "intimate"
                : artworkIndex % 4 === 3
                  ? "quiet"
                  : "statement"
            }
            data-slot="explore-artwork"
            key={artwork.key}
          >
            <ExploreArtFrame artwork={artwork} eager={artworkIndex < 2} />

            <figcaption className="mt-5 ml-auto w-[min(100%,11rem)] border-t border-[#272018]/35 pt-2 text-[#272018]">
              <div className="flex items-center justify-between gap-2">
                <p className="font-serif text-[0.72rem] leading-tight tracking-[0.01em]">
                  {artwork.title}
                </p>
                <Button
                  aria-label={`Try prompt: ${artwork.title}`}
                  className="h-6 px-2 text-[#272018] hover:bg-[#272018]/8 hover:text-[#272018]"
                  onClick={() => onTryPrompt(artwork.key)}
                  variant="ghost"
                >
                  <ArrowRightIcon className="size-3" />
                </Button>
              </div>
              <p className="mt-1.5 text-[0.58rem] leading-[1.45] font-light text-[#272018]/58">
                {artwork.description}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export type ExploreArtFrameProps = {
  artwork: ExploreArtworkDetails;
  eager?: boolean;
};

export function ExploreArtFrame({
  artwork,
  eager = false,
}: ExploreArtFrameProps) {
  return (
    <div
      className="group [container-type:inline-size] relative w-full"
      data-slot="explore-art-frame"
    >
      <div className="relative isolate bg-[radial-gradient(circle_at_30%_25%,rgb(244_211_119/0.2)_0_5%,transparent_6%),conic-gradient(from_45deg_at_50%_50%,#3c2609_0deg,#a67927_34deg,#e0bd64_45deg,#5c3a0b_88deg,#3c2609_90deg,#9d7022_124deg,#d8b157_135deg,#563608_178deg,#3c2609_180deg,#a67927_214deg,#e0bd64_225deg,#5c3a0b_268deg,#3c2609_270deg,#9d7022_304deg,#d8b157_315deg,#563608_358deg,#3c2609_360deg)] [background-size:0.8rem_0.8rem,100%_100%] p-[clamp(0.7rem,3.1cqi,1.45rem)] shadow-[-0.15rem_0.2rem_0.1rem_rgb(49_35_17/0.28),-0.7rem_1.2rem_1.15rem_-0.3rem_rgb(43_33_22/0.42),0_1.8rem_2.6rem_-1.2rem_rgb(43_33_22/0.34),inset_0_0_0_1px_rgb(255_225_142/0.42),inset_0_0.18rem_0.16rem_rgb(255_232_158/0.28),inset_0_-0.25rem_0.24rem_rgb(47_27_5/0.66)] ring-1 ring-[#3d2709] transition-[filter] duration-500 ease-out group-hover:filter-[drop-shadow(-0.2rem_0.55rem_0.25rem_rgb(48_36_23/0.18))] before:pointer-events-none before:absolute before:inset-[clamp(0.24rem,1cqi,0.5rem)] before:border before:border-[#f3d583]/35 before:shadow-[inset_0_0_0_1px_rgb(55_34_7/0.6)] before:content-[''] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(105deg,transparent_0%,rgb(255_238_174/0.12)_18%,transparent_34%,transparent_66%,rgb(49_28_4/0.13)_100%)] after:content-['']">
        <div className="relative bg-[linear-gradient(145deg,#67410d,#d4aa51_35%,#765015_64%,#d9af55)] p-[var(--explore-frame-bead-rail)] shadow-[0_0_0_1px_rgb(53_32_5/0.78),inset_0_0_0_1px_rgb(255_228_143/0.48),inset_0_0.2rem_0.28rem_rgb(43_25_4/0.38)] [--explore-frame-bead-rail:clamp(0.28rem,1.3cqi,0.62rem)] [--explore-frame-bead-step:clamp(0.38rem,1.7cqi,0.78rem)]">
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bg-[radial-gradient(circle_at_center,#f5d680_0_15%,#ba8530_18%_31%,#5c390b_34%_48%,transparent_51%)] data-[side=bottom]:right-[var(--explore-frame-bead-rail)] data-[side=bottom]:bottom-0 data-[side=bottom]:left-[var(--explore-frame-bead-rail)] data-[side=bottom]:h-[var(--explore-frame-bead-rail)] data-[side=bottom]:[background-size:var(--explore-frame-bead-step)_100%] data-[side=bottom]:[background-position:left_center] data-[side=bottom]:[background-repeat:round_no-repeat] data-[side=left]:top-[var(--explore-frame-bead-rail)] data-[side=left]:bottom-[var(--explore-frame-bead-rail)] data-[side=left]:left-0 data-[side=left]:w-[var(--explore-frame-bead-rail)] data-[side=left]:[background-size:100%_var(--explore-frame-bead-step)] data-[side=left]:[background-position:center_top] data-[side=left]:[background-repeat:no-repeat_round] data-[side=right]:top-[var(--explore-frame-bead-rail)] data-[side=right]:right-0 data-[side=right]:bottom-[var(--explore-frame-bead-rail)] data-[side=right]:w-[var(--explore-frame-bead-rail)] data-[side=right]:[background-size:100%_var(--explore-frame-bead-step)] data-[side=right]:[background-position:center_top] data-[side=right]:[background-repeat:no-repeat_round] data-[side=top]:top-0 data-[side=top]:right-[var(--explore-frame-bead-rail)] data-[side=top]:left-[var(--explore-frame-bead-rail)] data-[side=top]:h-[var(--explore-frame-bead-rail)] data-[side=top]:[background-size:var(--explore-frame-bead-step)_100%] data-[side=top]:[background-position:left_center] data-[side=top]:[background-repeat:round_no-repeat]"
              data-side={side}
              key={side}
            />
          ))}

          <div className="relative z-[1] bg-[conic-gradient(from_45deg_at_50%_50%,#25190b_0deg,#6c4a1d_43deg,#a87b36_45deg,#33210b_89deg,#25190b_90deg,#684719_133deg,#9b7131_135deg,#30200b_179deg,#25190b_180deg,#6c4a1d_223deg,#a87b36_225deg,#33210b_269deg,#25190b_270deg,#684719_313deg,#9b7131_315deg,#30200b_359deg)] p-[clamp(0.42rem,2cqi,0.95rem)] shadow-[inset_0.24rem_0.24rem_0.3rem_rgb(19_11_3/0.72),inset_-0.16rem_-0.16rem_0.18rem_rgb(237_204_122/0.18),0_0_0_1px_rgb(49_30_6/0.85)]">
            <div className="bg-[linear-gradient(135deg,#e4c470_0%,#7f5818_19%,#d7ad50_42%,#4d310a_64%,#bd8d34_83%,#edcf7d_100%)] p-[clamp(0.18rem,0.85cqi,0.42rem)] shadow-[0_0_0_1px_rgb(51_31_6/0.8),inset_0.12rem_0.12rem_0.13rem_rgb(255_235_166/0.34),inset_-0.12rem_-0.12rem_0.14rem_rgb(42_24_3/0.58)]">
              <div className="bg-[#24180a] p-[clamp(0.14rem,0.55cqi,0.28rem)] shadow-[inset_0.12rem_0.16rem_0.22rem_rgb(8_5_2/0.9),0_0_0_1px_rgb(239_204_116/0.28)]">
                <div
                  className="relative overflow-hidden bg-[#16120d]"
                  style={{ aspectRatio: artwork.aspectRatio }}
                >
                  <img
                    alt={artwork.alt}
                    className="size-full object-cover contrast-[1.035] saturate-[0.94] transition-transform duration-700 ease-out group-hover:scale-[1.012]"
                    decoding="async"
                    draggable="false"
                    loading={eager ? "eager" : "lazy"}
                    src={artwork.imageUrl}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,rgb(255_255_255/0.13)_0%,transparent_18%,transparent_68%,rgb(255_244_209/0.055)_100%)] mix-blend-screen shadow-[inset_0_0_1.2rem_rgb(5_3_1/0.38)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

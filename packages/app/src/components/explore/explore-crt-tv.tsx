import { useEffect, useRef, useState } from "react";

import exploreCrtModelUrl from "../../assets/crtv.glb?url";
import exploreCrtTvFallbackUrl from "../../assets/explore-crt-tv.webp";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion.ts";

import {
  creativeCategoryDetails,
  type CreativeCategory,
} from "../../lib/explore/explore.ts";
import type { ExploreCrtRuntime } from "../../lib/explore/explore-crt-tv-renderer.ts";

export type ExploreCrtTvProps = {
  category?: CreativeCategory;
  videoKey?: number | string;
  videoUrl: string;
};

type ExploreCrtAssetUrls = {
  fallback: string;
  model: string;
};

export function ExploreCrtTv({
  category = "film",
  videoKey,
  videoUrl,
}: ExploreCrtTvProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<ExploreCrtRuntime | null>(null);
  const videoUrlRef = useRef(videoUrl);
  const reducedMotionRef = useRef(prefersReducedMotion);
  const [assetUrls, setAssetUrls] = useState<ExploreCrtAssetUrls | null>(null);
  const [renderState, setRenderState] = useState<
    "fallback" | "loading" | "ready"
  >("loading");
  const categoryDetails = creativeCategoryDetails[category];

  // The shared package resolves assets differently during web SSR and in the
  // browser. Applying the URLs after hydration keeps both initial trees stable.
  useEffect(() => {
    setAssetUrls({
      fallback: exploreCrtTvFallbackUrl,
      model: exploreCrtModelUrl,
    });
  }, []);

  useEffect(() => {
    reducedMotionRef.current = prefersReducedMotion;
    runtimeRef.current?.setReducedMotion(prefersReducedMotion);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!assetUrls || !canvas) {
      return;
    }

    if (
      typeof window.WebGLRenderingContext === "undefined" &&
      typeof window.WebGL2RenderingContext === "undefined"
    ) {
      setRenderState("fallback");
      return;
    }

    let disposed = false;
    let runtime: ExploreCrtRuntime | null = null;

    setRenderState("loading");

    void import("../../lib/explore/explore-crt-tv-renderer.ts")
      .then(({ createExploreCrtRuntime }) => {
        if (disposed) {
          return;
        }

        runtime = createExploreCrtRuntime({
          canvas,
          modelUrl: assetUrls.model,
          onError: () => setRenderState("fallback"),
          onReady: () => setRenderState("ready"),
          reducedMotion: reducedMotionRef.current,
          videoUrl: videoUrlRef.current,
        });
        runtimeRef.current = runtime;
      })
      .catch(() => {
        if (!disposed) {
          setRenderState("fallback");
        }
      });

    return () => {
      disposed = true;
      runtime?.dispose();

      if (runtimeRef.current === runtime) {
        runtimeRef.current = null;
      }
    };
  }, [assetUrls]);

  // Keyed on the tape identity as well as the URL so switching between tapes
  // that share a source still restarts playback from the beginning.
  useEffect(() => {
    videoUrlRef.current = videoUrl;
    runtimeRef.current?.setVideoSource(videoUrl);
  }, [videoKey, videoUrl]);

  return (
    <div
      className="relative aspect-square w-full max-w-none"
      data-category={category}
      data-slot="explore-crt-tv"
    >
      <canvas
        aria-label={`${categoryDetails.label} creative inspiration`}
        className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-300 ${
          renderState === "ready" ? "opacity-100" : "opacity-0"
        }`}
        data-render-state={renderState}
        data-slot="explore-crt-canvas"
        data-video-url={videoUrl}
        ref={canvasRef}
        role="img"
      />

      {assetUrls ? (
        <img
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 size-full transition-opacity duration-300 select-none ${
            renderState === "ready" ? "opacity-0" : "opacity-100"
          }`}
          decoding="async"
          draggable={false}
          fetchPriority="high"
          src={assetUrls.fallback}
        />
      ) : null}
    </div>
  );
}

import { useEffect, useState } from "react";

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

function getPrefersReducedMotion() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia?.(reducedMotionMediaQuery).matches ?? false;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getPrefersReducedMotion,
  );

  useEffect(() => {
    const motionQuery = window.matchMedia?.(reducedMotionMediaQuery);

    if (!motionQuery) {
      return;
    }

    function syncReducedMotion() {
      setPrefersReducedMotion(motionQuery?.matches ?? false);
    }

    syncReducedMotion();
    motionQuery.addEventListener("change", syncReducedMotion);

    return () => motionQuery.removeEventListener("change", syncReducedMotion);
  }, []);

  return prefersReducedMotion;
}

export { usePrefersReducedMotion };

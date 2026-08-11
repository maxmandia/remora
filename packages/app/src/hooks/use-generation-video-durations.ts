import { useEffect, useMemo, useRef, useState } from "react";

import type { GenerationAttachmentMediaItem } from "../lib/generation/attachment-media.ts";
import { getGenerationAttachmentMediaDurationSec } from "../lib/generation/attachment-media.ts";

type VideoDurationState = {
  files: File[];
  durationSecByFile: ReadonlyMap<File, number | null>;
  status: "loading" | "ready";
};

type VideoDurationProbe = {
  cancel: () => void;
  result: Promise<number | null>;
};

const emptyDurationSecByFile = new Map<File, number | null>();

export function useGenerationVideoDurations(
  items: readonly GenerationAttachmentMediaItem[],
) {
  const nextFiles = items.flatMap((item) =>
    item.source === "local" ? [item.file] : [],
  );
  const stableFilesRef = useRef(nextFiles);

  if (!haveSameFiles(stableFilesRef.current, nextFiles)) {
    stableFilesRef.current = nextFiles;
  }

  const files = stableFilesRef.current;
  const [state, setState] = useState<VideoDurationState>({
    files: [],
    durationSecByFile: emptyDurationSecByFile,
    status: "ready",
  });
  const stateMatchesFiles = haveSameFiles(state.files, files);

  useEffect(() => {
    if (files.length === 0) {
      setState({
        files: [],
        durationSecByFile: emptyDurationSecByFile,
        status: "ready",
      });
      return;
    }

    let active = true;
    const probes = files.map(createVideoDurationProbe);

    setState({
      files,
      durationSecByFile: emptyDurationSecByFile,
      status: "loading",
    });

    void Promise.all(probes.map((probe) => probe.result)).then((durations) => {
      if (!active) {
        return;
      }

      setState({
        files,
        durationSecByFile: new Map(
          files.map((file, index) => [file, durations[index] ?? null]),
        ),
        status: "ready",
      });
    });

    return () => {
      active = false;

      for (const probe of probes) {
        probe.cancel();
      }
    };
  }, [files]);

  const durationSecByFile = stateMatchesFiles
    ? state.durationSecByFile
    : emptyDurationSecByFile;

  const durationSecByItem = useMemo(
    () =>
      new Map(
        items.map((item) => [
          item,
          item.source === "local"
            ? (durationSecByFile.get(item.file) ?? null)
            : getGenerationAttachmentMediaDurationSec(item),
        ]),
      ),
    [durationSecByFile, items],
  );

  return {
    durationSecByItem,
    isPending:
      files.length > 0 && (!stateMatchesFiles || state.status === "loading"),
  };
}

function createVideoDurationProbe(file: File): VideoDurationProbe {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return createUnavailableVideoDurationProbe();
  }

  const video = document.createElement("video");
  let objectUrl: string;

  try {
    objectUrl = URL.createObjectURL(file);
  } catch {
    return createUnavailableVideoDurationProbe();
  }

  let settled = false;
  let resolveResult: (durationSec: number | null) => void = () => undefined;

  const cleanup = () => {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute("src");

    if (typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(objectUrl);
    }
  };
  const settle = (durationSec: number | null) => {
    if (settled) {
      return;
    }

    settled = true;
    cleanup();
    resolveResult(durationSec);
  };
  const result = new Promise<number | null>((resolve) => {
    resolveResult = resolve;
  });

  video.preload = "metadata";
  video.onloadedmetadata = () => {
    settle(
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : null,
    );
  };
  video.onerror = () => {
    settle(null);
  };
  video.src = objectUrl;

  return {
    cancel: () => {
      settle(null);
    },
    result,
  };
}

function createUnavailableVideoDurationProbe(): VideoDurationProbe {
  return {
    cancel: () => undefined,
    result: Promise.resolve(null),
  };
}

function haveSameFiles(left: readonly File[], right: readonly File[]) {
  return (
    left.length === right.length &&
    left.every((file, index) => file === right[index])
  );
}

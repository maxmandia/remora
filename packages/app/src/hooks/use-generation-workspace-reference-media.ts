import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

import {
  createEmptyGenerationAttachmentMediaValue,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import type { GenerationWorkspacePreset } from "../lib/generation/generation-workspace-search.ts";

export type GenerationWorkspaceReferenceMediaState = {
  errorMessage: string | null;
  retry: () => void;
  status: "idle" | "loading" | "ready" | "error";
};

type ReferenceMediaLoadState = {
  errorMessage: string | null;
  scopeKey: string | null;
  status: GenerationWorkspaceReferenceMediaState["status"];
};

type ReferenceMediaKind = "image" | "video";

export function useGenerationWorkspaceReferenceMedia({
  enabled,
  preset,
  setValue,
}: {
  enabled: boolean;
  preset: GenerationWorkspacePreset | null;
  setValue: Dispatch<SetStateAction<GenerationAttachmentMediaValue>>;
}): GenerationWorkspaceReferenceMediaState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ReferenceMediaLoadState>({
    errorMessage: null,
    scopeKey: null,
    status: "idle",
  });
  const appliedValueRef = useRef<GenerationAttachmentMediaValue | null>(null);
  const scopeKey = useMemo(
    () => getReferenceMediaScopeKey(enabled ? preset : null),
    [enabled, preset],
  );
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  useEffect(() => {
    if (!scopeKey || !preset?.referenceMedia) {
      setState({ errorMessage: null, scopeKey: null, status: "idle" });
      return;
    }

    const controller = new AbortController();

    setState({ errorMessage: null, scopeKey, status: "loading" });

    void loadGenerationWorkspaceReferenceMedia({
      referenceMedia: preset.referenceMedia,
      signal: controller.signal,
    })
      .then((loadedValue) => {
        if (controller.signal.aborted) {
          return;
        }

        const previouslyAppliedValue = appliedValueRef.current;

        setValue((currentValue) => {
          const valueWithoutPreviousPreset = removeGenerationAttachmentMedia(
            currentValue,
            previouslyAppliedValue,
          );

          return prependGenerationAttachmentMedia(
            loadedValue,
            valueWithoutPreviousPreset,
          );
        });
        appliedValueRef.current = loadedValue;
        setState({ errorMessage: null, scopeKey, status: "ready" });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          return;
        }

        setState({
          errorMessage:
            error instanceof Error
              ? error.message
              : "Could not load the Explore reference files.",
          scopeKey,
          status: "error",
        });
      });

    return () => controller.abort();
  }, [attempt, preset, scopeKey, setValue]);

  if (!scopeKey) {
    return { errorMessage: null, retry, status: "idle" };
  }

  if (state.scopeKey !== scopeKey) {
    return { errorMessage: null, retry, status: "loading" };
  }

  return { errorMessage: state.errorMessage, retry, status: state.status };
}

export async function loadGenerationWorkspaceReferenceMedia({
  fetcher = fetch,
  referenceMedia,
  signal,
}: {
  fetcher?: typeof fetch;
  referenceMedia: NonNullable<GenerationWorkspacePreset["referenceMedia"]>;
  signal?: AbortSignal;
}): Promise<GenerationAttachmentMediaValue> {
  const [images, videos] = await Promise.all([
    loadReferenceMediaFiles({
      fetcher,
      kind: "image",
      signal,
      urls: referenceMedia.images ?? [],
    }),
    loadReferenceMediaFiles({
      fetcher,
      kind: "video",
      signal,
      urls: referenceMedia.videos ?? [],
    }),
  ]);

  return {
    ...createEmptyGenerationAttachmentMediaValue(),
    images,
    videos,
  };
}

async function loadReferenceMediaFiles({
  fetcher,
  kind,
  signal,
  urls,
}: {
  fetcher: typeof fetch;
  kind: ReferenceMediaKind;
  signal?: AbortSignal;
  urls: readonly string[];
}) {
  return Promise.all(
    urls.map(async (url, index) => {
      const response = await fetcher(url, { signal });

      if (!response.ok) {
        throw new Error(
          `Could not load ${kind} ${index + 1} (${response.status}).`,
        );
      }

      const blob = await response.blob();
      const expectedMimePrefix = `${kind}/`;

      if (!blob.type.startsWith(expectedMimePrefix)) {
        throw new Error(`Explore ${kind} ${index + 1} has an invalid format.`);
      }

      return {
        file: new File([blob], getReferenceMediaFileName(url, kind, index), {
          lastModified: 0,
          type: blob.type,
        }),
        role: "reference" as const,
      };
    }),
  );
}

function getReferenceMediaScopeKey(preset: GenerationWorkspacePreset | null) {
  if (!preset?.referenceMedia) {
    return null;
  }

  const urls = [
    ...(preset.referenceMedia.images ?? []),
    ...(preset.referenceMedia.videos ?? []),
  ];

  return urls.length > 0 ? `${preset.modelId}:${urls.join("|")}` : null;
}

function getReferenceMediaFileName(
  url: string,
  kind: ReferenceMediaKind,
  index: number,
) {
  try {
    const pathname = new URL(url).pathname;
    const fileName = pathname.slice(pathname.lastIndexOf("/") + 1);

    if (fileName) {
      return decodeURIComponent(fileName);
    }
  } catch {
    // The fetch error is more actionable than a URL parsing error. Use a
    // deterministic filename if a custom fetcher accepts a non-standard URL.
  }

  return `${kind}${index + 1}`;
}

function prependGenerationAttachmentMedia(
  presetValue: GenerationAttachmentMediaValue,
  currentValue: GenerationAttachmentMediaValue,
): GenerationAttachmentMediaValue {
  return {
    images: [...presetValue.images, ...currentValue.images],
    videos: [...presetValue.videos, ...currentValue.videos],
    audios: [...presetValue.audios, ...currentValue.audios],
  };
}

function removeGenerationAttachmentMedia(
  currentValue: GenerationAttachmentMediaValue,
  valueToRemove: GenerationAttachmentMediaValue | null,
): GenerationAttachmentMediaValue {
  if (!valueToRemove) {
    return currentValue;
  }

  return {
    images: currentValue.images.filter(
      (item) => !valueToRemove.images.includes(item),
    ),
    videos: currentValue.videos.filter(
      (item) => !valueToRemove.videos.includes(item),
    ),
    audios: currentValue.audios.filter(
      (item) => !valueToRemove.audios.includes(item),
    ),
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

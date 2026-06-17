import { useEffect, useState } from "react";

import {
  createHeicPreviewObjectUrl,
  isHeicImageFile,
} from "../lib/image.ts";

type ImagePreviewState =
  | { status: "loading" }
  | { status: "ready"; objectUrl: string }
  | { status: "failed"; reason: "heicConversion" | "objectUrlUnavailable" };

export function useImagePreviewObjectUrl(file: File) {
  const [preview, setPreview] = useState<ImagePreviewState>({
    status: "loading",
  });

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") {
      setPreview({ status: "failed", reason: "objectUrlUnavailable" });
      return;
    }

    let active = true;
    let nextObjectUrl: string | null = null;

    setPreview({ status: "loading" });

    if (!isHeicImageFile(file)) {
      nextObjectUrl = URL.createObjectURL(file);
      setPreview({ status: "ready", objectUrl: nextObjectUrl });

      return () => {
        revokeObjectUrl(nextObjectUrl);
      };
    }

    void createHeicPreviewObjectUrl(file)
      .then((convertedObjectUrl) => {
        if (!active) {
          revokeObjectUrl(convertedObjectUrl);
          return;
        }

        nextObjectUrl = convertedObjectUrl;
        setPreview({ status: "ready", objectUrl: convertedObjectUrl });
      })
      .catch(() => {
        if (active) {
          setPreview({ status: "failed", reason: "heicConversion" });
        }
      });

    return () => {
      active = false;
      revokeObjectUrl(nextObjectUrl);
    };
  }, [file]);

  return preview;
}

function revokeObjectUrl(objectUrl: string | null) {
  if (objectUrl && typeof URL.revokeObjectURL === "function") {
    URL.revokeObjectURL(objectUrl);
  }
}

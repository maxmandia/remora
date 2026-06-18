import type { PublishedGenerationModelSummary } from "@remora/backend/types";
import {
  Button,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@remora/ui";
import { AudioLinesIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useImagePreviewObjectUrl } from "../../hooks/use-image-preview-object-url.ts";
import {
  describeReferenceMediaFileIssue,
  getGenerationReferenceMediaFieldSpecs,
  referenceMediaFieldIds,
  validateReferenceMediaFile,
  type GenerationReferenceMediaValue,
  type ReferenceMediaFieldId,
  type ReferenceMediaFieldSpec,
  type ReferenceMediaFileIssue,
} from "../../lib/generation/reference-media.ts";

type ReferenceMediaKind = "image" | "video" | "audio";

type ReferenceMediaPreviewItem = {
  fieldId: ReferenceMediaFieldId;
  file: File;
  index: number;
  kind: ReferenceMediaKind;
  issues: ReferenceMediaFileIssue[];
};

export function ReferenceMediaPreview({
  selectedModel,
  value,
  onValueChange,
}: {
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationReferenceMediaValue;
  onValueChange: (value: GenerationReferenceMediaValue) => void;
}) {
  const fieldSpecs = useMemo(
    () =>
      selectedModel ? getGenerationReferenceMediaFieldSpecs(selectedModel) : [],
    [selectedModel],
  );
  const items = useMemo(
    () => getReferenceMediaPreviewItems(value, fieldSpecs),
    [value, fieldSpecs],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 -translate-y-16 overflow-visible px-3"
      data-slot="reference-media-preview"
    >
      <div
        className="pointer-events-none h-full [scrollbar-width:none] overflow-x-auto overflow-y-hidden pt-2 [&::-webkit-scrollbar]:hidden"
        data-slot="reference-media-preview-scroll"
      >
        <ul
          aria-label="Reference media preview"
          className="pointer-events-none flex h-full list-none items-start gap-2 pb-2"
        >
          {items.map((item) => (
            <ReferenceMediaPreviewTile
              key={`${item.fieldId}:${item.index}:${item.file.name}:${item.file.size}:${item.file.lastModified}`}
              item={item}
              onRemove={() => {
                onValueChange(removeReferenceMediaItem(value, item));
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function ReferenceMediaPreviewTile({
  item,
  onRemove,
}: {
  item: ReferenceMediaPreviewItem;
  onRemove: () => void;
}) {
  const fileName = item.file.name || "Untitled media";

  return (
    <li
      className="group/reference-media pointer-events-auto relative size-20 shrink-0 overflow-hidden rounded-md border shadow-[0_8px_24px_rgb(0_0_0/0.28)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform focus-within:-translate-y-2 hover:-translate-y-2 motion-reduce:transition-none"
      data-media-kind={item.kind}
      data-slot="reference-media-preview-item"
    >
      <ReferenceMediaPreviewContent item={item} />
      {item.issues.length > 0 ? (
        <ReferenceMediaPreviewWarning issues={item.issues} />
      ) : null}
      <Button
        aria-label={`Remove reference ${item.kind}: ${fileName}`}
        className="pointer-events-none absolute top-1 right-1 z-10 size-5 rounded-md bg-black/55 text-white opacity-0 shadow-sm transition-opacity group-focus-within/reference-media:pointer-events-auto group-focus-within/reference-media:opacity-100 group-hover/reference-media:pointer-events-auto group-hover/reference-media:opacity-100 hover:bg-black/75 focus-visible:pointer-events-auto focus-visible:opacity-100"
        size="icon-xs"
        type="button"
        variant="ghost"
        onClick={onRemove}
      >
        <XIcon className="size-3" />
      </Button>
    </li>
  );
}

function ReferenceMediaPreviewWarning({
  issues,
}: {
  issues: ReferenceMediaFileIssue[];
}) {
  const label = issues.map(describeReferenceMediaFileIssue).join(" ");

  return (
    <Tooltip delay={0}>
      <TooltipTrigger
        render={
          <span
            aria-label={label}
            className="pointer-events-auto absolute top-1 left-1 z-10 flex size-5 items-center justify-center rounded-md bg-black/55 text-white shadow-sm transition-colors hover:bg-black/75"
            data-slot="reference-media-preview-warning"
            role="img"
          >
            <TriangleAlertIcon aria-hidden="true" className="size-3" />
          </span>
        }
      />
      <TooltipContent>
        <ul className="list-none space-y-0.5">
          {issues.map((issue) => (
            <li key={issue.kind}>{describeReferenceMediaFileIssue(issue)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function ReferenceMediaPreviewContent({
  item,
}: {
  item: ReferenceMediaPreviewItem;
}) {
  const fileName = item.file.name || "Untitled media";

  switch (item.kind) {
    case "image":
      return (
        <ImageReferenceMediaPreview file={item.file} fileName={fileName} />
      );
    case "video":
      return (
        <VideoReferenceMediaPreview file={item.file} fileName={fileName} />
      );
    case "audio":
      return <AudioReferenceMediaPreview fileName={fileName} />;
  }
}

function ImageReferenceMediaPreview({
  file,
  fileName,
}: {
  file: File;
  fileName: string;
}) {
  const preview = useImagePreviewObjectUrl(file);
  const label = `Reference image: ${fileName}`;

  if (preview.status === "loading") {
    return <ReferenceMediaPreviewPlaceholder label={label} />;
  }

  if (preview.status === "failed") {
    if (preview.reason === "heicConversion") {
      return (
        <ReferenceMediaPreviewUnavailable
          label={label}
          tooltip="This HEIC file is still attached, but Remora could not prepare a local preview."
        />
      );
    }

    return <ReferenceMediaPreviewPlaceholder label={label} />;
  }

  return (
    <img
      alt={label}
      className="size-full object-cover"
      draggable={false}
      src={preview.objectUrl}
    />
  );
}

function VideoReferenceMediaPreview({
  file,
  fileName,
}: {
  file: File;
  fileName: string;
}) {
  const objectUrl = useObjectUrl(file);
  const label = `Reference video: ${fileName}`;

  if (!objectUrl) {
    return <ReferenceMediaPreviewPlaceholder label={label} />;
  }

  return (
    <video
      aria-label={label}
      className="size-full object-cover"
      muted
      playsInline
      preload="metadata"
      src={objectUrl}
    />
  );
}

function AudioReferenceMediaPreview({ fileName }: { fileName: string }) {
  return (
    <div
      aria-label={`Reference audio: ${fileName}`}
      className="flex size-full flex-col items-center justify-center gap-1.5 bg-[linear-gradient(135deg,rgb(36_36_30/0.95),rgb(50_46_39/0.95))] px-2 text-center"
      role="img"
    >
      <AudioLinesIcon aria-hidden="true" className="size-5 text-white/85" />
      <span className="max-w-full truncate text-[0.68rem] leading-tight text-white/80">
        {fileName}
      </span>
    </div>
  );
}

function ReferenceMediaPreviewPlaceholder({ label }: { label: string }) {
  return (
    <Skeleton
      aria-label={label}
      className="size-full rounded-none"
      role="img"
    />
  );
}

function ReferenceMediaPreviewUnavailable({
  label,
  tooltip,
}: {
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip delay={0}>
      <TooltipTrigger
        render={
          <div
            aria-label={label}
            className="flex size-full items-center justify-center bg-[rgb(36_36_30/0.95)]"
            role="img"
          >
            <TriangleAlertIcon
              aria-hidden="true"
              className="size-4 text-white/50"
            />
          </div>
        }
      />
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function useObjectUrl(file: File) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof URL.createObjectURL !== "function") {
      setObjectUrl(null);
      return;
    }

    const nextObjectUrl = URL.createObjectURL(file);
    setObjectUrl(nextObjectUrl);

    return () => {
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(nextObjectUrl);
      }
    };
  }, [file]);

  return objectUrl;
}

function getReferenceMediaPreviewItems(
  value: GenerationReferenceMediaValue,
  fieldSpecs: ReferenceMediaFieldSpec[],
): ReferenceMediaPreviewItem[] {
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );

  return referenceMediaFieldIds.flatMap((fieldId) =>
    value[fieldId].map((file, index) => {
      const fieldSpec = fieldSpecById.get(fieldId);

      return {
        fieldId,
        file,
        index,
        kind: getReferenceMediaKind(fieldId),
        issues: fieldSpec
          ? validateReferenceMediaFile(fieldSpec, file)
          : [{ kind: "unsupportedField" }],
      };
    }),
  );
}

function removeReferenceMediaItem(
  value: GenerationReferenceMediaValue,
  item: ReferenceMediaPreviewItem,
): GenerationReferenceMediaValue {
  return {
    ...value,
    [item.fieldId]: value[item.fieldId].filter(
      (_, index) => index !== item.index,
    ),
  };
}

function getReferenceMediaKind(
  fieldId: ReferenceMediaFieldId,
): ReferenceMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}

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
  attachmentMediaFieldIds,
  describeAttachmentMediaFileIssue,
  getAttachmentMediaRoleShortLabel,
  getGenerationAttachmentMediaFieldSpecs,
  validateAttachmentMediaFile,
  validateAttachmentMediaSelection,
  type AttachmentMediaFieldId,
  type AttachmentMediaFieldSpec,
  type AttachmentMediaFileIssue,
  type GenerationAttachmentMediaItem,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";

type AttachmentMediaKind = "image" | "video" | "audio";

type AttachmentMediaPreviewItem = {
  fieldId: AttachmentMediaFieldId;
  index: number;
  item: GenerationAttachmentMediaItem;
  kind: AttachmentMediaKind;
  issues: AttachmentMediaFileIssue[];
};

export function AttachmentMediaPreview({
  selectedModel,
  value,
  onValueChange,
}: {
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationAttachmentMediaValue;
  onValueChange: (value: GenerationAttachmentMediaValue) => void;
}) {
  const fieldSpecs = useMemo(
    () =>
      selectedModel
        ? getGenerationAttachmentMediaFieldSpecs(selectedModel)
        : [],
    [selectedModel],
  );
  const items = useMemo(
    () => getAttachmentMediaPreviewItems(value, fieldSpecs, selectedModel),
    [value, fieldSpecs, selectedModel],
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-24 -translate-y-16 overflow-visible px-3"
      data-slot="attachment-media-preview"
    >
      <div
        className="pointer-events-none h-full [scrollbar-width:none] overflow-x-auto overflow-y-hidden pt-2 [&::-webkit-scrollbar]:hidden"
        data-slot="attachment-media-preview-scroll"
      >
        <ul
          aria-label="Attachments preview"
          className="pointer-events-none flex h-full list-none items-start gap-2 pb-2"
        >
          {items.map((item) => (
            <AttachmentMediaPreviewTile
              key={`${item.fieldId}:${item.index}:${item.item.role}:${item.item.file.name}:${item.item.file.size}:${item.item.file.lastModified}`}
              item={item}
              onRemove={() => {
                onValueChange(removeAttachmentMediaItem(value, item));
              }}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function AttachmentMediaPreviewTile({
  item,
  onRemove,
}: {
  item: AttachmentMediaPreviewItem;
  onRemove: () => void;
}) {
  const fileName = item.item.file.name || "Untitled media";
  const roleShortLabel = getAttachmentMediaRoleShortLabel(item.item.role);

  return (
    <li
      className="group/attachment-media pointer-events-auto relative size-20 shrink-0 overflow-hidden rounded-md border shadow-[0_8px_24px_rgb(0_0_0/0.28)] transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform focus-within:-translate-y-2 hover:-translate-y-2 motion-reduce:transition-none"
      data-media-kind={item.kind}
      data-media-role={item.item.role}
      data-slot="attachment-media-preview-item"
    >
      <AttachmentMediaPreviewContent item={item} />
      {roleShortLabel ? (
        <span className="pointer-events-none absolute bottom-1 left-1 z-10 rounded-md bg-black/55 px-1.5 py-0.5 text-[0.62rem] leading-none font-medium text-white shadow-sm">
          {roleShortLabel}
        </span>
      ) : null}
      {item.issues.length > 0 ? (
        <AttachmentMediaPreviewWarning issues={item.issues} />
      ) : null}
      <Button
        aria-label={getRemoveAttachmentMediaLabel(item, fileName)}
        className="pointer-events-none absolute top-1 right-1 z-10 size-5 rounded-md bg-black/55 text-white opacity-0 shadow-sm transition-opacity group-focus-within/attachment-media:pointer-events-auto group-focus-within/attachment-media:opacity-100 group-hover/attachment-media:pointer-events-auto group-hover/attachment-media:opacity-100 hover:bg-black/75 focus-visible:pointer-events-auto focus-visible:opacity-100"
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

function AttachmentMediaPreviewWarning({
  issues,
}: {
  issues: AttachmentMediaFileIssue[];
}) {
  const label = issues.map(describeAttachmentMediaFileIssue).join(" ");

  return (
    <Tooltip delay={0}>
      <TooltipTrigger
        render={
          <span
            aria-label={label}
            className="pointer-events-auto absolute top-1 left-1 z-10 flex size-5 items-center justify-center rounded-md bg-black/55 text-white shadow-sm transition-colors hover:bg-black/75"
            data-slot="attachment-media-preview-warning"
            role="img"
          >
            <TriangleAlertIcon aria-hidden="true" className="size-3" />
          </span>
        }
      />
      <TooltipContent>
        <ul className="list-none space-y-0.5">
          {issues.map((issue) => (
            <li key={issue.kind}>{describeAttachmentMediaFileIssue(issue)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

function AttachmentMediaPreviewContent({
  item,
}: {
  item: AttachmentMediaPreviewItem;
}) {
  const fileName = item.item.file.name || "Untitled media";

  switch (item.kind) {
    case "image":
      return (
        <ImageAttachmentMediaPreview
          file={item.item.file}
          fileName={fileName}
          role={item.item.role}
        />
      );
    case "video":
      return (
        <VideoAttachmentMediaPreview
          file={item.item.file}
          fileName={fileName}
        />
      );
    case "audio":
      return <AudioAttachmentMediaPreview fileName={fileName} />;
  }
}

function ImageAttachmentMediaPreview({
  file,
  fileName,
  role,
}: {
  file: File;
  fileName: string;
  role: GenerationAttachmentMediaItem["role"];
}) {
  const preview = useImagePreviewObjectUrl(file);
  const label = getAttachmentMediaImageLabel(role, fileName);

  if (preview.status === "loading") {
    return <AttachmentMediaPreviewPlaceholder label={label} />;
  }

  if (preview.status === "failed") {
    if (preview.reason === "heicConversion") {
      return (
        <AttachmentMediaPreviewUnavailable
          label={label}
          tooltip="This HEIC file is still attached, but Remora could not prepare a local preview."
        />
      );
    }

    return <AttachmentMediaPreviewPlaceholder label={label} />;
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

function VideoAttachmentMediaPreview({
  file,
  fileName,
}: {
  file: File;
  fileName: string;
}) {
  const objectUrl = useObjectUrl(file);
  const label = `Attachment video: ${fileName}`;

  if (!objectUrl) {
    return <AttachmentMediaPreviewPlaceholder label={label} />;
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

function AudioAttachmentMediaPreview({ fileName }: { fileName: string }) {
  return (
    <div
      aria-label={`Attachment audio: ${fileName}`}
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

function AttachmentMediaPreviewPlaceholder({ label }: { label: string }) {
  return (
    <Skeleton
      aria-label={label}
      className="size-full rounded-none"
      role="img"
    />
  );
}

function AttachmentMediaPreviewUnavailable({
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

function getAttachmentMediaPreviewItems(
  value: GenerationAttachmentMediaValue,
  fieldSpecs: AttachmentMediaFieldSpec[],
  selectedModel: PublishedGenerationModelSummary | null,
): AttachmentMediaPreviewItem[] {
  const fieldSpecById = new Map(
    fieldSpecs.map((fieldSpec) => [fieldSpec.id, fieldSpec]),
  );

  return attachmentMediaFieldIds.flatMap((fieldId) =>
    value[fieldId].map((item, index) => {
      const fieldSpec = fieldSpecById.get(fieldId);

      return {
        fieldId,
        index,
        item,
        kind: getAttachmentMediaKind(fieldId),
        issues: fieldSpec
          ? [
              ...validateAttachmentMediaFile(fieldSpec, item.file),
              ...(selectedModel
                ? validateAttachmentMediaSelection(
                    fieldId,
                    value,
                    selectedModel,
                  )
                : []),
            ]
          : [{ kind: "unsupportedField" }],
      };
    }),
  );
}

function removeAttachmentMediaItem(
  value: GenerationAttachmentMediaValue,
  item: AttachmentMediaPreviewItem,
): GenerationAttachmentMediaValue {
  return {
    ...value,
    [item.fieldId]: value[item.fieldId].filter(
      (_, index) => index !== item.index,
    ),
  };
}

function getAttachmentMediaImageLabel(
  role: GenerationAttachmentMediaItem["role"],
  fileName: string,
) {
  switch (role) {
    case "firstFrame":
      return `First frame image: ${fileName}`;
    case "lastFrame":
      return `Last frame image: ${fileName}`;
    case "reference":
      return `Attachment image: ${fileName}`;
  }
}

function getRemoveAttachmentMediaLabel(
  item: AttachmentMediaPreviewItem,
  fileName: string,
) {
  switch (item.item.role) {
    case "firstFrame":
      return `Remove first frame ${item.kind}: ${fileName}`;
    case "lastFrame":
      return `Remove last frame ${item.kind}: ${fileName}`;
    case "reference":
      return `Remove attachment ${item.kind}: ${fileName}`;
  }
}

function getAttachmentMediaKind(
  fieldId: AttachmentMediaFieldId,
): AttachmentMediaKind {
  switch (fieldId) {
    case "images":
      return "image";
    case "videos":
      return "video";
    case "audios":
      return "audio";
  }
}

import {
  orderedGenerationSettingIds,
  type GenerationSettingsFieldId,
} from "../../lib/generation/generation-settings.ts";
import { Badge, cn } from "@remora/ui";
import { assertNever } from "@remora/utils";
import {
  Clock8Icon,
  CuboidIcon,
  Grid3X3Icon,
  Layers2Icon,
  MonitorIcon,
  NotepadTextIcon,
  RatioIcon,
  Volume2Icon,
  WallpaperIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type SubmittedGenerationSettingsValue = {
  requestedGenerations: number;
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  generateAudio?: boolean;
  draft?: boolean;
  textureLevel?: string;
  faceLimit?: number | null;
  geometryQuality?: string | null;
};

export function SubmittedGenerationSettings({
  className,
  modelDisplayName,
  showQuality = false,
  settings,
}: {
  className?: string;
  modelDisplayName: string;
  showQuality?: boolean;
  settings: SubmittedGenerationSettingsValue;
}) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      data-slot="submitted-generation-settings"
    >
      <Badge data-slot="submitted-generation-model" variant="surface">
        {modelDisplayName}
      </Badge>
      {orderedGenerationSettingIds.map((fieldId) => {
        const value = settings[fieldId];

        return value === undefined ||
          (value === null && fieldId !== "faceLimit") ||
          (fieldId === "draft" && !showQuality) ? null : (
          <SubmittedGenerationSetting
            key={fieldId}
            fieldId={fieldId}
            value={value}
          />
        );
      })}
    </div>
  );
}

function SubmittedGenerationSetting({
  fieldId,
  value,
}: {
  fieldId: GenerationSettingsFieldId;
  value: string | number | boolean | null;
}) {
  switch (fieldId) {
    case "requestedGenerations":
      return (
        <SubmittedGenerationSettingPill
          icon={<Layers2Icon />}
          text={String(value)}
        />
      );
    case "draft":
      return (
        <SubmittedGenerationSettingPill
          icon={<NotepadTextIcon />}
          text={value === true ? "Draft" : "Full quality"}
        />
      );
    case "resolution":
      return (
        <SubmittedGenerationSettingPill
          icon={<MonitorIcon />}
          text={String(value)}
        />
      );
    case "aspectRatio":
      return (
        <SubmittedGenerationSettingPill
          icon={<RatioIcon />}
          text={String(value)}
        />
      );
    case "duration":
      return (
        <SubmittedGenerationSettingPill
          icon={<Clock8Icon />}
          text={String(value)}
        />
      );
    case "generateAudio":
      return (
        <SubmittedGenerationSettingPill
          icon={<Volume2Icon />}
          text={String(value)}
        />
      );
    case "textureLevel":
      return (
        <SubmittedGenerationSettingPill
          icon={<WallpaperIcon />}
          text={`${String(value)} texture`}
        />
      );
    case "faceLimit":
      return (
        <SubmittedGenerationSettingPill
          icon={<Grid3X3Icon />}
          text={value === null ? "Adaptive faces" : `${String(value)} faces`}
        />
      );
    case "geometryQuality":
      return (
        <SubmittedGenerationSettingPill
          icon={<CuboidIcon />}
          text={`${String(value)} geometry`}
        />
      );
    default:
      return assertNever(fieldId);
  }
}

function SubmittedGenerationSettingPill({
  text,
  icon,
}: {
  text: string;
  icon: ReactNode;
}) {
  return (
    <Badge variant="surface">
      {icon}
      {text}
    </Badge>
  );
}

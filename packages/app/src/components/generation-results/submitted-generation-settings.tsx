import {
  orderedGenerationSettingIds,
  type GenerationSettingsFieldId,
} from "../../lib/generation/generation-settings.ts";
import { Badge, cn } from "@remora/ui";
import { assertNever } from "@remora/utils";
import {
  Clock8Icon,
  Layers2Icon,
  MonitorIcon,
  NotepadTextIcon,
  RatioIcon,
  Volume2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

export type SubmittedGenerationSettingsValue = {
  requestedGenerations: number;
  resolution: string;
  aspectRatio: string;
  duration?: number;
  generateAudio?: boolean;
  draft?: boolean;
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
  value: string | number | boolean;
}) {
  switch (fieldId) {
    case "requestedGenerations":
      return (
        <SubmittedGenerationSettingPill
          icon={<Layers2Icon />}
          text={value.toString()}
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
          text={value.toString()}
        />
      );
    case "aspectRatio":
      return (
        <SubmittedGenerationSettingPill
          icon={<RatioIcon />}
          text={value.toString()}
        />
      );
    case "duration":
      return (
        <SubmittedGenerationSettingPill
          icon={<Clock8Icon />}
          text={value.toString()}
        />
      );
    case "generateAudio":
      return (
        <SubmittedGenerationSettingPill
          icon={<Volume2Icon />}
          text={value.toString()}
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

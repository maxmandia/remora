import type { GenerationThreadSubmission } from "@remora/backend/types";
import { Badge, cn } from "@remora/ui";
import { assertNever } from "@remora/utils";
import {
  Clock8Icon,
  Layers2Icon,
  MonitorIcon,
  RatioIcon,
  Volume2Icon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  orderedGenerationSettingIds,
  type GenerationSettingsFieldId,
} from "../../lib/generation/index.ts";

export type SubmittedGenerationSettingsValue = Pick<
  GenerationThreadSubmission["submittedInput"] &
    Pick<GenerationThreadSubmission, "requestedGenerations">,
  GenerationSettingsFieldId
>;

export function SubmittedGenerationSettings({
  className,
  modelDisplayName,
  settings,
}: {
  className?: string;
  modelDisplayName: string;
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
      {orderedGenerationSettingIds.map((fieldId) => (
        <SubmittedGenerationSetting
          key={fieldId}
          fieldId={fieldId}
          value={settings[fieldId]}
        />
      ))}
    </div>
  );
}

function SubmittedGenerationSetting({
  fieldId,
  value,
}: {
  fieldId: GenerationSettingsFieldId;
  value: SubmittedGenerationSettingsValue[GenerationSettingsFieldId];
}) {
  switch (fieldId) {
    case "requestedGenerations":
      return (
        <SubmittedGenerationSettingPill
          icon={<Layers2Icon />}
          text={value.toString()}
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

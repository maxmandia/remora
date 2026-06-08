import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
import type { ReactNode } from "react";
import { assertNever, toPrimitiveSelectItems } from "@remora/utils";
import {
  SelectItem,
  SelectContent,
  SelectValue,
  SelectTrigger,
  Select,
} from "@remora/ui";
import {
  Clock8Icon,
  RatioIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import {
  orderedGenerationSettingIds,
  type GenerationSettingsFieldId,
  type GenerationSettingsValue,
} from "../lib/generation/index.ts";

type GenerationSettingsFieldSpec = VideoFieldSpec & {
  id: GenerationSettingsFieldId;
};

export function GenerationSettings({
  selectedModel,
  value,
  onValueChange,
}: {
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationSettingsValue | null;
  onValueChange: (value: GenerationSettingsValue) => void;
}) {
  if (!selectedModel || !value) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {orderedGenerationSettingIds.map((fieldId) => {
        const fieldSpec = selectedModel.spec.fields.find(
          (field): field is GenerationSettingsFieldSpec => field.id === fieldId,
        );

        return fieldSpec ? (
          <GenerationSettingsSwitch
            key={`${selectedModel.id}:${fieldSpec.id}`}
            fieldSpec={fieldSpec}
            settingsValue={value}
            onSettingsValueChange={onValueChange}
          />
        ) : null;
      })}
    </div>
  );
}

function GenerationSettingsSwitch({
  fieldSpec,
  settingsValue,
  onSettingsValueChange,
}: {
  fieldSpec: GenerationSettingsFieldSpec;
  settingsValue: GenerationSettingsValue;
  onSettingsValueChange: (value: GenerationSettingsValue) => void;
}) {
  switch (fieldSpec.id) {
    case "aspectRatio":
      return (
        <AspectRatioSettings
          fieldSpec={fieldSpec}
          value={settingsValue.aspectRatio}
          onValueChange={(aspectRatio) =>
            onSettingsValueChange({ ...settingsValue, aspectRatio })
          }
        />
      );
    case "duration":
      return (
        <DurationSettings
          fieldSpec={fieldSpec}
          value={settingsValue.duration}
          onValueChange={(duration) =>
            onSettingsValueChange({ ...settingsValue, duration })
          }
        />
      );
    case "generateAudio":
      return (
        <GenerateAudioSettings
          fieldSpec={fieldSpec}
          value={settingsValue.generateAudio}
          onValueChange={(generateAudio) =>
            onSettingsValueChange({ ...settingsValue, generateAudio })
          }
        />
      );
    default:
      return assertNever(fieldSpec.id);
  }
}

function AspectRatioSettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: VideoFieldSpec;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      value={value}
      onValueChange={onValueChange}
      icon={<RatioIcon />}
    />
  );
}

function DurationSettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: VideoFieldSpec;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      value={value}
      onValueChange={onValueChange}
      icon={<Clock8Icon />}
    />
  );
}

function GenerateAudioSettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: VideoFieldSpec;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      value={value}
      onValueChange={onValueChange}
      icon={(value) => (value === false ? <VolumeOffIcon /> : <Volume2Icon />)}
    />
  );
}

function PrimitiveFieldSelect<Value extends string | number | boolean>({
  fieldSpec,
  value,
  onValueChange,
  icon,
}: {
  fieldSpec: VideoFieldSpec;
  value: Value;
  onValueChange: (value: Value) => void;
  icon: ReactNode | ((value: Value) => ReactNode);
}) {
  const items = toPrimitiveSelectItems(fieldSpec.options).map(
    ({ label, value }) => ({
      label,
      rawValue: value,
      value: String(value),
    }),
  );
  const triggerIcon = typeof icon === "function" ? icon(value) : icon;

  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        const item = items.find((option) => option.value === nextValue);

        if (item) {
          onValueChange(item.rawValue as Value);
        }
      }}
      items={items}
    >
      <SelectTrigger variant="ghost" icon={triggerIcon}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={String(item.value)} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

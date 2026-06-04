import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
import type { ReactNode } from "react";
import { useState } from "react";
import { isPrimitiveSelectValue, toPrimitiveSelectItems } from "@remora/utils";
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

const orderedGenerationSettingIds = [
  "aspectRatio",
  "duration",
  "generateAudio",
] as const satisfies readonly VideoFieldSpec["id"][];

export function GenerationSettings({
  selectedModel,
}: {
  selectedModel: PublishedGenerationModelSummary | null;
}) {
  if (!selectedModel) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {orderedGenerationSettingIds.map((fieldId) => {
        const fieldSpec = selectedModel.spec.fields.find(
          (field) => field.id === fieldId,
        );

        return fieldSpec ? (
          <GenerationSettingsSwitch
            key={`${selectedModel.id}:${fieldSpec.id}`}
            fieldSpec={fieldSpec}
          />
        ) : null;
      })}
    </div>
  );
}

function GenerationSettingsSwitch({
  fieldSpec,
}: {
  fieldSpec: VideoFieldSpec;
}) {
  switch (fieldSpec.id) {
    case "aspectRatio":
      return <AspectRatioSettings fieldSpec={fieldSpec} />;
    case "duration":
      return <DurationSettings fieldSpec={fieldSpec} />;
    case "generateAudio":
      return <GenerateAudioSettings fieldSpec={fieldSpec} />;
    default:
      return null;
  }
}

function AspectRatioSettings({ fieldSpec }: { fieldSpec: VideoFieldSpec }) {
  return <PrimitiveFieldSelect fieldSpec={fieldSpec} icon={<RatioIcon />} />;
}

function DurationSettings({ fieldSpec }: { fieldSpec: VideoFieldSpec }) {
  return <PrimitiveFieldSelect fieldSpec={fieldSpec} icon={<Clock8Icon />} />;
}

function GenerateAudioSettings({ fieldSpec }: { fieldSpec: VideoFieldSpec }) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      icon={(value) => (value === "false" ? <VolumeOffIcon /> : <Volume2Icon />)}
    />
  );
}

function PrimitiveFieldSelect({
  fieldSpec,
  icon,
}: {
  fieldSpec: VideoFieldSpec;
  icon: ReactNode | ((value: string | undefined) => ReactNode);
}) {
  const items = toPrimitiveSelectItems(fieldSpec.options).map(
    ({ label, value }) => ({
      label,
      value: String(value),
    }),
  );
  const defaultValue = isPrimitiveSelectValue(fieldSpec.defaultValue)
    ? String(fieldSpec.defaultValue)
    : undefined;
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const triggerIcon =
    typeof icon === "function" ? icon(selectedValue) : icon;

  return (
    <Select
      value={selectedValue}
      onValueChange={(value) => setSelectedValue(value ?? undefined)}
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

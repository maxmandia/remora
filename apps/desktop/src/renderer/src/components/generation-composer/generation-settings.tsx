import type {
  PublishedGenerationModelSummary,
  VideoFieldSpec,
} from "@remora/backend/types";
import {
  maxRequestedGenerations,
  minRequestedGenerations,
} from "@remora/backend/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@remora/ui";
import { assertNever, toPrimitiveSelectItems } from "@remora/utils";
import {
  Clock8Icon,
  Layers2Icon,
  RatioIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  orderedGenerationSettingIds,
  type GenerationModelSettingsFieldId,
  type GenerationSettingsFieldId,
  type GenerationSettingsValue,
} from "../../lib/generation/index.ts";
import {
  getGenerationReferenceMediaFieldSpecs,
  type GenerationReferenceMediaValue,
} from "../../lib/generation/reference-media.ts";
import { ReferenceMediaButton } from "./reference-media-button.tsx";

type GenerationSettingsFieldSpec = VideoFieldSpec & {
  id: GenerationModelSettingsFieldId;
};

export function GenerationSettings({
  referenceMediaValue,
  selectedModel,
  value,
  onReferenceMediaValueChange,
  onValueChange,
}: {
  referenceMediaValue: GenerationReferenceMediaValue;
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationSettingsValue | null;
  onReferenceMediaValueChange: (value: GenerationReferenceMediaValue) => void;
  onValueChange: (value: GenerationSettingsValue) => void;
}) {
  if (!selectedModel || !value) {
    return null;
  }

  const referenceMediaFieldSpecs =
    getGenerationReferenceMediaFieldSpecs(selectedModel);

  return (
    <div className="flex items-center gap-2">
      {referenceMediaFieldSpecs.length > 0 && (
        <ReferenceMediaButton
          fieldSpecs={referenceMediaFieldSpecs}
          value={referenceMediaValue}
          onValueChange={onReferenceMediaValueChange}
        />
      )}
      {orderedGenerationSettingIds.map((fieldId) => (
        <GenerationSettingsSwitch
          key={`${selectedModel.id}:${fieldId}`}
          fieldId={fieldId}
          selectedModel={selectedModel}
          settingsValue={value}
          onSettingsValueChange={onValueChange}
        />
      ))}
    </div>
  );
}

function GenerationSettingsSwitch({
  fieldId,
  selectedModel,
  settingsValue,
  onSettingsValueChange,
}: {
  fieldId: GenerationSettingsFieldId;
  selectedModel: PublishedGenerationModelSummary;
  settingsValue: GenerationSettingsValue;
  onSettingsValueChange: (value: GenerationSettingsValue) => void;
}) {
  switch (fieldId) {
    case "requestedGenerations":
      return (
        <RequestedGenerationsSettings
          value={settingsValue.requestedGenerations}
          onValueChange={(requestedGenerations) =>
            onSettingsValueChange({ ...settingsValue, requestedGenerations })
          }
        />
      );
    case "aspectRatio": {
      const fieldSpec = getGenerationSettingsFieldSpec(selectedModel, fieldId);

      if (!fieldSpec) {
        return null;
      }

      return (
        <AspectRatioSettings
          fieldSpec={fieldSpec}
          value={settingsValue.aspectRatio}
          onValueChange={(aspectRatio) =>
            onSettingsValueChange({ ...settingsValue, aspectRatio })
          }
        />
      );
    }
    case "duration": {
      const fieldSpec = getGenerationSettingsFieldSpec(selectedModel, fieldId);

      if (!fieldSpec) {
        return null;
      }

      return (
        <DurationSettings
          fieldSpec={fieldSpec}
          value={settingsValue.duration}
          onValueChange={(duration) =>
            onSettingsValueChange({ ...settingsValue, duration })
          }
        />
      );
    }
    case "generateAudio": {
      const fieldSpec = getGenerationSettingsFieldSpec(selectedModel, fieldId);

      if (!fieldSpec) {
        return null;
      }

      return (
        <GenerateAudioSettings
          fieldSpec={fieldSpec}
          value={settingsValue.generateAudio}
          onValueChange={(generateAudio) =>
            onSettingsValueChange({ ...settingsValue, generateAudio })
          }
        />
      );
    }
    default:
      return assertNever(fieldId);
  }
}

function RequestedGenerationsSettings({
  value,
  onValueChange,
}: {
  value: number;
  onValueChange: (value: number) => void;
}) {
  const items = Array.from(
    { length: maxRequestedGenerations - minRequestedGenerations + 1 },
    (_, index) => {
      const rawValue = minRequestedGenerations + index;

      return {
        label: String(rawValue),
        rawValue,
        value: String(rawValue),
      };
    },
  );

  return (
    <Select
      value={String(value)}
      onValueChange={(nextValue) => {
        const item = items.find((option) => option.value === nextValue);

        if (item) {
          onValueChange(item.rawValue);
        }
      }}
      items={items}
    >
      <SelectTrigger
        aria-label="Requested generations"
        variant="ghost"
        icon={<Layers2Icon />}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false}>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
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

function getGenerationSettingsFieldSpec(
  selectedModel: PublishedGenerationModelSummary,
  fieldId: GenerationModelSettingsFieldId,
) {
  return (
    selectedModel.spec.fields.find(
      (field): field is GenerationSettingsFieldSpec => field.id === fieldId,
    ) ?? null
  );
}

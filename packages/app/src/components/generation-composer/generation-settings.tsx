import type {
  GenerationFieldSpec,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import {
  maxRequestedGenerations,
  minRequestedGenerations,
} from "@remora/domain/generation-submission/dto";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  cn,
} from "@remora/ui";
import { assertNever, toPrimitiveSelectItems } from "@remora/utils";
import {
  Clock8Icon,
  LoaderCircleIcon,
  Layers2Icon,
  MonitorIcon,
  NotepadTextIcon,
  RatioIcon,
  RotateCcwIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { GenerationWorkspaceReferenceMediaState } from "../../hooks/use-generation-workspace-reference-media.ts";
import {
  orderedGenerationSettingIds,
  type GenerationModelSettingsFieldId,
  type GenerationSettingsFieldId,
  type GenerationSettingsValue,
} from "../../lib/generation/generation-settings.ts";
import {
  getGenerationAttachmentMediaFieldSpecs,
  type AttachmentMediaVideoDurationSummary,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { AttachmentMediaButton } from "./attachment-media-button.tsx";

type GenerationSettingsFieldSpec = GenerationFieldSpec & {
  id: GenerationModelSettingsFieldId;
};

export function GenerationSettings({
  attachmentMediaValue,
  referenceMediaState,
  selectedModel,
  value,
  videoDurationSummary,
  onAttachmentMediaValueChange,
  onValueChange,
}: {
  attachmentMediaValue: GenerationAttachmentMediaValue;
  referenceMediaState?: GenerationWorkspaceReferenceMediaState;
  selectedModel: PublishedGenerationModelSummary | null;
  value: GenerationSettingsValue | null;
  videoDurationSummary?: AttachmentMediaVideoDurationSummary | null;
  onAttachmentMediaValueChange: (value: GenerationAttachmentMediaValue) => void;
  onValueChange: (value: GenerationSettingsValue) => void;
}) {
  if (!selectedModel || !value || selectedModel.type !== value.modelType) {
    return null;
  }

  const attachmentMediaFieldSpecs =
    getGenerationAttachmentMediaFieldSpecs(selectedModel);

  return (
    <div className="flex items-center gap-2">
      {referenceMediaState?.status === "loading" ? (
        <div
          aria-live="polite"
          className="text-secondary-foreground flex h-8 items-center gap-1.5 px-2 text-xs whitespace-nowrap"
          role="status"
        >
          <LoaderCircleIcon className="size-3.5 animate-spin" />
          Loading references
        </div>
      ) : null}
      {referenceMediaState?.status === "error" ? (
        <Button
          aria-label={`Retry loading Explore references. ${referenceMediaState.errorMessage ?? ""}`.trim()}
          className="text-destructive"
          size="sm"
          title={referenceMediaState.errorMessage ?? undefined}
          type="button"
          variant="ghost"
          onClick={referenceMediaState.retry}
        >
          <RotateCcwIcon />
          Retry references
        </Button>
      ) : null}
      {videoDurationSummary ? (
        <ReferenceVideoDuration summary={videoDurationSummary} />
      ) : null}
      {attachmentMediaFieldSpecs.length > 0 && (
        <AttachmentMediaButton
          disabled={referenceMediaState?.status === "loading"}
          fieldSpecs={attachmentMediaFieldSpecs}
          value={attachmentMediaValue}
          onValueChange={onAttachmentMediaValueChange}
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

function ReferenceVideoDuration({
  summary,
}: {
  summary: AttachmentMediaVideoDurationSummary;
}) {
  const currentDuration =
    summary.status === "loading"
      ? "Detecting"
      : summary.status === "unavailable"
        ? "Unavailable"
        : `${summary.totalDurationSec?.toFixed(1)}s`;
  const warning = summary.isOverLimit
    ? " — exceeds limit"
    : summary.status === "unavailable"
      ? " — duration unavailable"
      : "";
  const label = `Reference video: ${currentDuration} / ${summary.maxTotalDurationSec}s${warning}`;
  const hasIssue = summary.status === "unavailable" || summary.isOverLimit;

  return (
    <div
      aria-label={label}
      aria-live="polite"
      className={cn(
        "flex h-8 items-center px-2 text-xs whitespace-nowrap",
        hasIssue ? "text-destructive" : "text-secondary-foreground",
      )}
      data-over-limit={summary.isOverLimit ? "true" : undefined}
      role="status"
    >
      {label}
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
    case "draft": {
      if (settingsValue.modelType !== "video") {
        return null;
      }

      const fieldSpec = getGenerationSettingsFieldSpec(selectedModel, fieldId);
      const hasDraftOption = fieldSpec?.options?.some(
        (option) => option.value === true,
      );

      if (!fieldSpec || !hasDraftOption || settingsValue.draft === undefined) {
        return null;
      }

      return (
        <DraftQualitySettings
          fieldSpec={fieldSpec}
          value={settingsValue.draft}
          onValueChange={(draft) =>
            onSettingsValueChange({ ...settingsValue, draft })
          }
        />
      );
    }
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
    case "resolution": {
      const fieldSpec = getGenerationSettingsFieldSpec(selectedModel, fieldId);

      if (!fieldSpec) {
        return null;
      }

      return (
        <ResolutionSettings
          fieldSpec={fieldSpec}
          value={settingsValue.resolution}
          onValueChange={(resolution) =>
            onSettingsValueChange({ ...settingsValue, resolution })
          }
        />
      );
    }
    case "duration": {
      if (settingsValue.modelType !== "video") {
        return null;
      }

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
      if (settingsValue.modelType !== "video") {
        return null;
      }

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
      <GenerationSettingSelectTrigger
        label="Number of generations"
        icon={<Layers2Icon />}
      >
        <SelectValue />
      </GenerationSettingSelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} side="top">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ResolutionSettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: GenerationFieldSpec;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      label="Resolution"
      value={value}
      onValueChange={onValueChange}
      icon={<MonitorIcon />}
    />
  );
}

function AspectRatioSettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: GenerationFieldSpec;
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      label="Aspect ratio"
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
  fieldSpec: GenerationFieldSpec;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      label="Duration"
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
  fieldSpec: GenerationFieldSpec;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      label="Audio"
      value={value}
      onValueChange={onValueChange}
      icon={(value) => (value === false ? <VolumeOffIcon /> : <Volume2Icon />)}
    />
  );
}

function DraftQualitySettings({
  fieldSpec,
  value,
  onValueChange,
}: {
  fieldSpec: GenerationFieldSpec;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <PrimitiveFieldSelect
      fieldSpec={fieldSpec}
      label="Quality"
      value={value}
      onValueChange={onValueChange}
      icon={<NotepadTextIcon />}
    />
  );
}

function PrimitiveFieldSelect<Value extends string | number | boolean>({
  fieldSpec,
  label,
  value,
  onValueChange,
  icon,
}: {
  fieldSpec: GenerationFieldSpec;
  label: string;
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
      <GenerationSettingSelectTrigger label={label} icon={triggerIcon}>
        <SelectValue />
      </GenerationSettingSelectTrigger>
      <SelectContent align="start" alignItemWithTrigger={false} side="top">
        {items.map((item) => (
          <SelectItem key={String(item.value)} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GenerationSettingSelectTrigger({
  children,
  icon,
  label,
}: {
  children: ReactNode;
  icon: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        data-slot="select-trigger"
        render={
          <SelectTrigger aria-label={label} variant="ghost" icon={icon}>
            {children}
          </SelectTrigger>
        }
      />
      <TooltipContent data-surface="card">{label}</TooltipContent>
    </Tooltip>
  );
}

function getGenerationSettingsFieldSpec(
  selectedModel: PublishedGenerationModelSummary,
  fieldId: GenerationModelSettingsFieldId,
) {
  const fieldSpec = selectedModel.spec.fields.find(
    (field): field is GenerationSettingsFieldSpec => field.id === fieldId,
  );

  return fieldSpec?.componentKind === "hidden" ? null : (fieldSpec ?? null);
}

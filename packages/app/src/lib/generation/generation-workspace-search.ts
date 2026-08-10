import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";

import {
  getExploreVhsTape,
  isExploreVhsTapeKey,
  type ExploreVhsTapeDetails,
  type ExploreVhsTapeKey,
} from "../explore/explore.ts";
import {
  getDefaultGenerationSettings,
  isGenerationSettingsValidForModel,
  type GenerationSettingsValue,
} from "./generation-settings.ts";

export type GenerationWorkspaceSearch = {
  exploreRef?: ExploreVhsTapeKey;
  projectId?: string;
};

export type GenerationWorkspacePreset = Pick<
  ExploreVhsTapeDetails,
  "duration" | "modelId" | "prompt" | "referenceMedia" | "resolution"
>;

export function parseGenerationWorkspaceSearch(
  search: Record<string, unknown>,
): GenerationWorkspaceSearch {
  const parsed: GenerationWorkspaceSearch = {};

  if (typeof search.projectId === "string" && search.projectId.length > 0) {
    parsed.projectId = search.projectId;
  }

  if (
    typeof search.exploreRef === "string" &&
    isExploreVhsTapeKey(search.exploreRef)
  ) {
    parsed.exploreRef = search.exploreRef;
  }

  return parsed;
}

export function resolveGenerationWorkspacePrompt(
  search: GenerationWorkspaceSearch,
) {
  return resolveGenerationWorkspacePreset(search)?.prompt ?? "";
}

export function resolveGenerationWorkspacePreset(
  search: GenerationWorkspaceSearch,
): GenerationWorkspacePreset | null {
  return search.exploreRef ? getExploreVhsTape(search.exploreRef) : null;
}

export function getGenerationWorkspacePresetSettings(
  selectedModel: PublishedGenerationModelSummary | null,
  preset: GenerationWorkspacePreset | null,
): GenerationSettingsValue | null {
  if (!selectedModel || !preset || selectedModel.id !== preset.modelId) {
    return null;
  }

  const defaultSettings = getDefaultGenerationSettings(selectedModel);

  if (!defaultSettings || defaultSettings.modelType !== "video") {
    return null;
  }

  const settings = {
    ...defaultSettings,
    duration: preset.duration,
    resolution: preset.resolution,
  };

  return isGenerationSettingsValidForModel(selectedModel, settings)
    ? settings
    : null;
}

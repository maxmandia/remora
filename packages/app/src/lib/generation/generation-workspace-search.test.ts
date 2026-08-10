import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it } from "vitest";

import { exploreAdsVhsTapes, exploreVhsTapes } from "../explore/explore.ts";
import {
  parseGenerationWorkspaceSearch,
  getGenerationWorkspacePresetSettings,
  resolveGenerationWorkspacePrompt,
  resolveGenerationWorkspacePreset,
} from "./generation-workspace-search.ts";

describe("parseGenerationWorkspaceSearch", () => {
  it("preserves a non-empty project ID", () => {
    expect(
      parseGenerationWorkspaceSearch({
        projectId: "project_1",
        unsupported: "value",
      }),
    ).toEqual({ projectId: "project_1" });
  });

  it("preserves known Explore refs and resolves their canonical prompts", () => {
    const tape = exploreVhsTapes[0];
    const search = parseGenerationWorkspaceSearch({
      projectId: "project_1",
      exploreRef: tape.key,
    });

    expect(search).toEqual({
      projectId: "project_1",
      exploreRef: tape.key,
    });
    expect(resolveGenerationWorkspacePrompt(search)).toBe(tape.prompt);
    expect(resolveGenerationWorkspacePreset(search)).toMatchObject({
      duration: -1,
      modelId: "seedance-2.0-video",
      prompt: tape.prompt,
      resolution: "1080p",
    });
  });

  it("gives every Explore tape the Seedance generation preset", () => {
    for (const tape of [...exploreVhsTapes, ...exploreAdsVhsTapes]) {
      expect(tape).toMatchObject({
        duration: -1,
        modelId: "seedance-2.0-video",
        resolution: "1080p",
      });
    }
  });

  it("applies an Explore preset over the model defaults", () => {
    const preset = resolveGenerationWorkspacePreset({
      exploreRef: exploreVhsTapes[0].key,
    });

    expect(
      getGenerationWorkspacePresetSettings(createSeedanceModel(), preset),
    ).toEqual({
      aspectRatio: "adaptive",
      duration: -1,
      generateAudio: true,
      modelType: "video",
      requestedGenerations: 1,
      resolution: "1080p",
    });
  });

  it.each([
    { exploreRef: "" },
    { exploreRef: "unknown-tape" },
    { exploreRef: null },
    { exploreRef: 1 },
  ])("omits an invalid Explore ref from %o", (search) => {
    expect(parseGenerationWorkspaceSearch(search)).toEqual({});
    expect(
      resolveGenerationWorkspacePrompt(parseGenerationWorkspaceSearch(search)),
    ).toBe("");
    expect(
      resolveGenerationWorkspacePreset(parseGenerationWorkspaceSearch(search)),
    ).toBeNull();
  });

  it.each([{}, { projectId: "" }, { projectId: null }, { projectId: 1 }])(
    "omits an invalid project ID from %o",
    (search) => {
      expect(parseGenerationWorkspaceSearch(search)).toEqual({});
    },
  );
});

function createSeedanceModel(): PublishedGenerationModelSummary {
  return {
    id: "seedance-2.0-video",
    type: "video",
    spec: {
      fields: [
        {
          id: "resolution",
          valueKind: "string",
          defaultValue: "720p",
          options: [
            { label: "720p", value: "720p" },
            { label: "1080p", value: "1080p" },
          ],
        },
        {
          id: "aspectRatio",
          valueKind: "string",
          defaultValue: "adaptive",
          options: [{ label: "Adaptive", value: "adaptive" }],
        },
        {
          id: "duration",
          valueKind: "integer",
          defaultValue: 5,
          options: [
            { label: "Adaptive", value: -1 },
            { label: "5s", value: 5 },
          ],
        },
        {
          id: "generateAudio",
          valueKind: "boolean",
          defaultValue: true,
          options: [
            { label: "On", value: true },
            { label: "Off", value: false },
          ],
        },
      ],
    },
  } as unknown as PublishedGenerationModelSummary;
}

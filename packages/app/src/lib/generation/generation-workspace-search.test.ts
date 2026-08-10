import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it } from "vitest";

import {
  exploreAdsVhsTapes,
  exploreVhsTapes,
  type ExploreVhsTapeDetails,
} from "../explore/explore.ts";
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

  it("keeps Film and legacy Ads tapes on Seedance 2.0", () => {
    const legacyAdsTitles = new Set([
      "Slow Mornings",
      "Crack Something Bright",
      "Three Drops",
      "Night Run",
    ]);

    for (const tape of [
      ...exploreVhsTapes,
      ...exploreAdsVhsTapes.filter(({ title }) => legacyAdsTitles.has(title)),
    ]) {
      expect(tape).toMatchObject({
        duration: -1,
        modelId: "seedance-2.0-video",
        resolution: "1080p",
      });
    }
  });

  it("uses per-prompt Seedance 2.5 settings for official 2.5 Ads", () => {
    const expectedDurationByTitle = new Map([
      ["Summer Pours Out", 30],
      ["Fresh on Seedance", 30],
      ["First Brew", 30],
      ["Windows Through Worlds", 30],
      ["Room to Settle", 30],
      ["Hello, Everywhere", 20],
    ]);

    for (const [title, duration] of expectedDurationByTitle) {
      expect(
        exploreAdsVhsTapes.find((tape) => tape.title === title),
      ).toMatchObject({
        duration,
        modelId: "seedance-2.5-video",
        resolution: "720p",
      });
    }
  });

  it("preserves the R2 reference order used by prompt tokens", () => {
    const freshPreset: ExploreVhsTapeDetails | undefined =
      exploreAdsVhsTapes.find((tape) => tape.title === "Fresh on Seedance");

    expect(freshPreset?.referenceMedia).toEqual({
      images: [
        "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/ads/references/e31cb569/image1.png",
      ],
      videos: Array.from(
        { length: 6 },
        (_, index) =>
          `https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev/explore/ads/references/e31cb569/video${index + 1}.mp4`,
      ),
    });

    const referenceCountsByTitle = new Map([
      ["Summer Pours Out", { images: 1, videos: 0 }],
      ["Fresh on Seedance", { images: 1, videos: 6 }],
      ["First Brew", { images: 6, videos: 0 }],
      ["Windows Through Worlds", { images: 5, videos: 0 }],
      ["Hello, Everywhere", { images: 1, videos: 0 }],
    ]);

    for (const [title, counts] of referenceCountsByTitle) {
      const tape: ExploreVhsTapeDetails | undefined = exploreAdsVhsTapes.find(
        (candidate) => candidate.title === title,
      );

      expect(tape?.referenceMedia?.images ?? []).toHaveLength(counts.images);
      expect(tape?.referenceMedia?.videos ?? []).toHaveLength(counts.videos);
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

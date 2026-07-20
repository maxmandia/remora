/** @vitest-environment jsdom */

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it } from "vitest";

import type { GenerationSettingsValue } from "../generation/index.ts";
import type { GenerationAttachmentMediaValue } from "../generation/attachment-media.ts";
import { toEstimateGenerationCostInput } from "./generation-cost-estimate.ts";

describe("toEstimateGenerationCostInput", () => {
  it("serializes model, settings, attachment roles, and video duration", () => {
    const attachmentMediaValue = createAttachmentMediaValue();
    const videoFile = attachmentMediaValue.videos[0]?.file;

    expect(videoFile).toBeDefined();
    expect(
      toEstimateGenerationCostInput({
        attachmentMediaValue,
        generationSettings: createGenerationSettings(),
        selectedModel: createModel(),
        videoDurationSecByFile: new Map([[videoFile!, 2.5]]),
      }),
    ).toEqual({
      modelId: "seedance-2.0-video",
      modelSpecId: "seedance-2.0-video-v1",
      aspectRatio: "16:9",
      resolution: "720p",
      duration: 5,
      generateAudio: true,
      requestedGenerations: 2,
      attachmentMedia: {
        images: [{ role: "firstFrame" }, { role: "lastFrame" }],
        videos: [{ role: "reference", durationSec: 2.5 }],
      },
    });
  });

  it("omits video duration when local metadata probing fails", () => {
    const attachmentMediaValue = createAttachmentMediaValue();

    expect(
      toEstimateGenerationCostInput({
        attachmentMediaValue,
        generationSettings: createGenerationSettings(),
        selectedModel: createModel(),
        videoDurationSecByFile: new Map([
          [attachmentMediaValue.videos[0]!.file, null],
        ]),
      }).attachmentMedia?.videos,
    ).toEqual([{ role: "reference" }]);
  });
});

function createGenerationSettings(): GenerationSettingsValue {
  return {
    aspectRatio: "16:9",
    resolution: "720p",
    duration: 5,
    generateAudio: true,
    requestedGenerations: 2,
  };
}

function createAttachmentMediaValue(): GenerationAttachmentMediaValue {
  return {
    images: [
      {
        file: new File(["image"], "first.png", { type: "image/png" }),
        role: "firstFrame",
      },
      {
        file: new File(["image"], "last.png", { type: "image/png" }),
        role: "lastFrame",
      },
    ],
    videos: [
      {
        file: new File(["video"], "motion.mp4", { type: "video/mp4" }),
        role: "reference",
      },
    ],
    audios: [],
  };
}

function createModel(): PublishedGenerationModelSummary {
  return {
    id: "seedance-2.0-video",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Seedance 2.0",
    type: "video",
    latestSpecId: "seedance-2.0-video-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "seedance-2.0-video",
      provider: "byteplus",
      providerModelId: "dreamina-seedance-2-0-260128",
      displayName: "Seedance 2.0",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/contents/generations/tasks",
      },
      modelParameter: {
        path: ["model"],
        source: "spec",
      },
      fields: [
        {
          id: "prompt",
          label: "Prompt",
          componentKind: "promptTextarea",
          valueKind: "string",
          required: true,
          advanced: false,
          omitWhenEmpty: false,
          omitWhenDefault: false,
          notes: [],
        },
      ],
      groups: [
        {
          id: "main",
          label: "Main",
          fieldIds: ["prompt"],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

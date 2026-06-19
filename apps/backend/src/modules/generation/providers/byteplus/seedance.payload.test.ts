import { describe, expect, it } from "vitest";

import {
  buildSeedanceVideoTaskRequest,
  SeedancePayloadError,
} from "./seedance.payload.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../../../model/types.ts";

describe("buildSeedanceVideoTaskRequest", () => {
  it("builds a model-driven text-to-video payload and omits default values", () => {
    expect(
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          prompt: "  A quiet studio workspace  ",
          aspectRatio: "16:9",
          duration: 8,
          generateAudio: true,
          returnLastFrame: true,
          callbackUrl: "https://remora.example/callback",
        },
      }),
    ).toEqual({
      model: "dreamina-seedance-2-0-260128",
      content: [
        {
          type: "text",
          text: "A quiet studio workspace",
        },
      ],
      ratio: "16:9",
      duration: 8,
      return_last_frame: true,
      callback_url: "https://remora.example/callback",
    });
  });

  it("builds Seedance Fast payloads with the Fast provider model id", () => {
    expect(
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceFastSpec(),
        input: {
          prompt: "A quiet studio workspace",
          aspectRatio: "16:9",
          duration: 8,
          generateAudio: false,
          resolution: "720p",
        },
      }),
    ).toEqual({
      model: "dreamina-seedance-2-0-fast-260128",
      content: [
        {
          type: "text",
          text: "A quiet studio workspace",
        },
      ],
      resolution: "720p",
      ratio: "16:9",
      duration: 8,
      generate_audio: false,
    });
  });

  it("rejects 1080p for Seedance Fast", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceFastSpec(),
        input: {
          prompt: "A bright workspace",
          resolution: "1080p",
        },
      }),
    ).toThrow("resolution must match a supported model option");
  });

  it("builds multimodal reference content with provider roles", () => {
    expect(
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          prompt: "Match the product look.",
          images: [
            {
              url: "https://assets.example/image.png",
              role: "reference_image",
            },
          ],
          videos: [
            {
              url: "https://assets.example/video.mp4",
            },
          ],
          audios: [
            {
              url: "https://assets.example/audio.mp3",
            },
          ],
          generateAudio: false,
        },
      }),
    ).toEqual({
      model: "dreamina-seedance-2-0-260128",
      content: [
        {
          type: "text",
          text: "Match the product look.",
        },
        {
          type: "image_url",
          image_url: { url: "https://assets.example/image.png" },
          role: "reference_image",
        },
        {
          type: "video_url",
          video_url: { url: "https://assets.example/video.mp4" },
          role: "reference_video",
        },
        {
          type: "audio_url",
          audio_url: { url: "https://assets.example/audio.mp3" },
          role: "reference_audio",
        },
      ],
      generate_audio: false,
    });
  });

  it("builds a draft-task payload", () => {
    expect(
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          draftTaskId: "cgt-draft",
          watermark: true,
          resolution: "720p",
        },
      }),
    ).toEqual({
      model: "dreamina-seedance-2-0-260128",
      content: [
        {
          type: "draft_task",
          draft_task: { id: "cgt-draft" },
        },
      ],
      watermark: true,
      resolution: "720p",
    });
  });

  it("rejects audio-only inputs", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          audios: [{ url: "https://assets.example/audio.mp3" }],
        },
      }),
    ).toThrow(SeedancePayloadError);
  });

  it("rejects unsupported service tiers", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          prompt: "A bright workspace",
          serviceTier: "flex",
        },
      }),
    ).toThrow("default online service tier");
  });

  it("validates model field ranges", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          prompt: "A bright workspace",
          duration: 16,
        },
      }),
    ).toThrow("duration must be less than or equal to 15");
  });
});

function createSeedanceSpec(): VideoModelSpec {
  return {
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
      path: "/api/v3/contents/generations/tasks",
    },
    modelParameter: {
      path: ["model"],
      source: "spec",
    },
    fields: [
      createField({
        id: "resolution",
        defaultValue: "720p",
        providerPath: ["resolution"],
        valueKind: "string",
        options: [
          { label: "480p", value: "480p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
      }),
      createField({
        id: "aspectRatio",
        defaultValue: "adaptive",
        providerPath: ["ratio"],
        valueKind: "string",
      }),
      createField({
        id: "duration",
        defaultValue: 5,
        providerPath: ["duration"],
        valueKind: "integer",
        min: -1,
        max: 15,
      }),
      createField({
        id: "generateAudio",
        defaultValue: true,
        omitWhenDefault: true,
        providerPath: ["generate_audio"],
        valueKind: "boolean",
      }),
      createField({
        id: "watermark",
        defaultValue: false,
        omitWhenDefault: true,
        providerPath: ["watermark"],
        valueKind: "boolean",
      }),
      createField({
        id: "returnLastFrame",
        defaultValue: false,
        omitWhenDefault: true,
        providerPath: ["return_last_frame"],
        valueKind: "boolean",
      }),
      createField({
        id: "callbackUrl",
        defaultValue: "",
        providerPath: ["callback_url"],
        valueKind: "string",
      }),
      createField({
        id: "serviceTier",
        defaultValue: "default",
        omitWhenDefault: true,
        providerPath: ["service_tier"],
        valueKind: "string",
      }),
    ],
    groups: [
      {
        id: "main",
        label: "Main",
        fieldIds: ["duration"],
        advanced: false,
      },
    ],
    transforms: [{ kind: "seedanceContentArray" }],
    validationRules: ["seedance20ContentRules"],
  };
}

function createSeedanceFastSpec(): VideoModelSpec {
  const spec = createSeedanceSpec();

  return {
    ...spec,
    id: "seedance-2.0-fast-video",
    providerModelId: "dreamina-seedance-2-0-fast-260128",
    displayName: "Seedance 2.0 Fast",
    fields: spec.fields.map((field) =>
      field.id === "resolution"
        ? {
            ...field,
            options: field.options?.filter((option) => option.value !== "1080p"),
          }
        : field,
    ) as VideoModelSpec["fields"],
  };
}

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
  return {
    id: "duration",
    label: "Duration",
    componentKind: "select",
    valueKind: "integer",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as VideoFieldSpec;
}

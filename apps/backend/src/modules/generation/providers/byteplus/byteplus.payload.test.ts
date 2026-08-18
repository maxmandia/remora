import { describe, expect, it } from "vitest";

import {
  buildSeedanceVideoTaskRequest,
  SeedancePayloadError,
  toSeedanceAttachmentMedia,
} from "./byteplus.payload.ts";

import type {
  GenerationFieldSpec,
  VideoModelSpec,
} from "../../../model/model.types.ts";

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

  it.each([
    { duration: 4, resolution: "480p" },
    { duration: 30, resolution: "720p" },
    { duration: 8, resolution: "1080p" },
  ])(
    "builds Seedance 2.5 $resolution payloads at $duration seconds",
    ({ duration, resolution }) => {
      expect(
        buildSeedanceVideoTaskRequest({
          spec: createSeedance25Spec(),
          input: {
            prompt: "A continuous cinematic scene",
            callbackUrl: "https://remora.example/seedance-2.5-callback",
            duration,
            resolution,
          },
        }),
      ).toMatchObject({
        model: "dreamina-seedance-2-5-260628",
        duration,
        resolution,
        callback_url: "https://remora.example/seedance-2.5-callback",
      });
    },
  );

  it("accepts Seedance 2.5 attachment counts from the model spec", () => {
    const request = buildSeedanceVideoTaskRequest({
      spec: createSeedance25Spec(),
      input: {
        images: Array.from({ length: 30 }, (_, index) => ({
          url: `https://assets.example/image-${index}.png`,
          role: "reference_image" as const,
        })),
        videos: Array.from({ length: 10 }, (_, index) => ({
          url: `https://assets.example/video-${index}.mp4`,
        })),
        audios: Array.from({ length: 10 }, (_, index) => ({
          url: `https://assets.example/audio-${index}.mp3`,
        })),
      },
    });

    expect(request.model).toBe("dreamina-seedance-2-5-260628");
    expect(request.content).toHaveLength(50);
  });

  it("rejects Seedance 2.5 attachment counts above the model spec limits", () => {
    const spec = createSeedance25Spec();

    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec,
        input: {
          images: Array.from({ length: 31 }, (_, index) => ({
            url: `https://assets.example/image-${index}.png`,
            role: "reference_image" as const,
          })),
        },
      }),
    ).toThrow("at most 30 reference images");

    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec,
        input: {
          videos: Array.from({ length: 11 }, (_, index) => ({
            url: `https://assets.example/video-${index}.mp4`,
          })),
        },
      }),
    ).toThrow("at most 10 reference videos");

    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec,
        input: {
          images: [
            {
              url: "https://assets.example/image.png",
              role: "reference_image",
            },
          ],
          audios: Array.from({ length: 11 }, (_, index) => ({
            url: `https://assets.example/audio-${index}.mp3`,
          })),
        },
      }),
    ).toThrow("at most 10 reference audio files");
  });

  it("preserves Seedance 2.0 attachment limits", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          images: Array.from({ length: 10 }, (_, index) => ({
            url: `https://assets.example/image-${index}.png`,
            role: "reference_image" as const,
          })),
        },
      }),
    ).toThrow("at most 9 reference images");
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

  it("rejects 4k for Seedance Fast", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceFastSpec(),
        input: {
          prompt: "A bright workspace",
          resolution: "4k",
        },
      }),
    ).toThrow("resolution must match a supported model option");
  });

  it("builds 4k payloads for standard Seedance", () => {
    expect(
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          prompt: "A bright workspace",
          resolution: "4k",
        },
      }),
    ).toEqual({
      model: "dreamina-seedance-2-0-260128",
      content: [
        {
          type: "text",
          text: "A bright workspace",
        },
      ],
      resolution: "4k",
    });
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

  it("maps canonical attachment media roles to Seedance provider roles", () => {
    expect(
      toSeedanceAttachmentMedia([
        {
          fieldId: "images",
          role: "firstFrame",
          url: "https://assets.example/first.png",
          contentType: "image/png",
          contentLength: 1_024,
        },
        {
          fieldId: "images",
          role: "lastFrame",
          url: "https://assets.example/last.png",
          contentType: "image/png",
          contentLength: 2_048,
        },
        {
          fieldId: "videos",
          role: "reference",
          url: "https://assets.example/reference.mp4",
          contentType: "video/mp4",
          contentLength: 4_096,
        },
        {
          fieldId: "audios",
          role: "reference",
          url: "https://assets.example/reference.mp3",
          contentType: "audio/mpeg",
          contentLength: 512,
        },
      ]),
    ).toEqual({
      images: [
        {
          url: "https://assets.example/first.png",
          role: "first_frame",
        },
        {
          url: "https://assets.example/last.png",
          role: "last_frame",
        },
      ],
      videos: [
        {
          url: "https://assets.example/reference.mp4",
          role: "reference_video",
        },
      ],
      audios: [
        {
          url: "https://assets.example/reference.mp3",
          role: "reference_audio",
        },
      ],
    });
  });

  it("rejects first or last frame images mixed with reference attachments", () => {
    expect(() =>
      buildSeedanceVideoTaskRequest({
        spec: createSeedanceSpec(),
        input: {
          images: [
            {
              url: "https://assets.example/first.png",
              role: "first_frame",
            },
          ],
          videos: [
            {
              url: "https://assets.example/reference.mp4",
            },
          ],
        },
      }),
    ).toThrow("reference attachments cannot be combined");
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
        id: "images",
        arrayMax: 9,
        defaultValue: [],
        componentKind: "mediaList",
        valueKind: "array",
      }),
      createField({
        id: "videos",
        arrayMax: 3,
        defaultValue: [],
        componentKind: "mediaList",
        valueKind: "array",
      }),
      createField({
        id: "audios",
        arrayMax: 3,
        defaultValue: [],
        componentKind: "mediaList",
        valueKind: "array",
      }),
      createField({
        id: "resolution",
        defaultValue: "720p",
        providerPath: ["resolution"],
        valueKind: "string",
        options: [
          { label: "480p", value: "480p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
          { label: "4k", value: "4k" },
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
            options: field.options?.filter(
              (option) => option.value !== "1080p" && option.value !== "4k",
            ),
          }
        : field,
    ) as VideoModelSpec["fields"],
  };
}

function createSeedance25Spec(): VideoModelSpec {
  const spec = createSeedanceSpec();

  return {
    ...spec,
    id: "seedance-2.5-video",
    providerModelId: "dreamina-seedance-2-5-260628",
    displayName: "Seedance 2.5",
    fields: spec.fields.map((field) => {
      switch (field.id) {
        case "images":
          return { ...field, arrayMax: 30 };
        case "videos":
        case "audios":
          return { ...field, arrayMax: 10 };
        case "resolution":
          return {
            ...field,
            options: field.options?.filter(
              (option) =>
                option.value === "480p" ||
                option.value === "720p" ||
                option.value === "1080p",
            ),
          };
        case "duration":
          return { ...field, max: 30 };
        default:
          return field;
      }
    }) as VideoModelSpec["fields"],
  };
}

function createField(
  overrides: Partial<GenerationFieldSpec>,
): GenerationFieldSpec {
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
  } as GenerationFieldSpec;
}

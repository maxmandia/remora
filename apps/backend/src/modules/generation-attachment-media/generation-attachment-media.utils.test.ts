import { describe, expect, it } from "vitest";

import type { GenerationModelSpec } from "../model/model.types.ts";
import type {
  GenerationAttachmentMediaInputItem,
  StoredGenerationAttachmentMedia,
} from "./generation-attachment-media.types.ts";
import { validateAttachmentMediaSelectionAgainstSpec } from "./generation-attachment-media.utils.ts";

describe("validateAttachmentMediaSelectionAgainstSpec", () => {
  it("requires exactly one Tripo reference image", () => {
    const spec = createTripoImageReferenceSpec();
    const firstImage = createImageMedia("image_1");
    const secondImage = createImageMedia("image_2");

    expect(() =>
      validateAttachmentMediaSelectionAgainstSpec({
        input: { images: [], videos: [], audios: [] },
        resolvedMedia: [],
        spec,
      }),
    ).toThrow("must include at least 1 file");
    expect(() =>
      validateAttachmentMediaSelectionAgainstSpec({
        input: {
          images: [firstImage, secondImage].map(({ id }) => ({
            id,
            role: "reference",
          })),
          videos: [],
          audios: [],
        },
        resolvedMedia: [firstImage, secondImage],
        spec,
      }),
    ).toThrow("must include at most 1 files");
  });

  it("accepts 30 seconds and rejects a greater combined video duration", () => {
    const spec = createVideoReferenceSpec(30);
    const acceptedMedia = [10, 10, 10].map((durationSec, index) =>
      createVideoMedia(`video_${index + 1}`, durationSec),
    );

    expect(() =>
      validateAttachmentMediaSelectionAgainstSpec({
        input: createInput(acceptedMedia),
        resolvedMedia: acceptedMedia,
        spec,
      }),
    ).not.toThrow();

    const rejectedMedia = [10, 10, 10.01].map((durationSec, index) =>
      createVideoMedia(`video_${index + 1}`, durationSec),
    );

    expect(() =>
      validateAttachmentMediaSelectionAgainstSpec({
        input: createInput(rejectedMedia),
        resolvedMedia: rejectedMedia,
        spec,
      }),
    ).toThrow("total duration must be at most 30 seconds");
  });
});

function createInput(media: StoredGenerationAttachmentMedia[]) {
  return {
    images: [],
    videos: media.map(
      ({ id }): GenerationAttachmentMediaInputItem => ({
        id,
        role: "reference",
      }),
    ),
    audios: [],
  };
}

function createVideoReferenceSpec(
  maxTotalDurationSec: number,
): GenerationModelSpec {
  return {
    fields: [
      {
        id: "videos",
        label: "Videos",
        componentKind: "mediaList",
        valueKind: "array",
        required: false,
        advanced: false,
        defaultValue: [],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        arrayMax: 10,
        mediaRoleCapabilities: ["reference"],
        mediaConstraints: {
          mimeTypes: ["video/mp4"],
          extensions: [".mp4"],
          maxDurationSec: 15,
          maxTotalDurationSec,
        },
        notes: [],
      },
    ],
    validationRules: [],
  } as unknown as GenerationModelSpec;
}

function createTripoImageReferenceSpec(): GenerationModelSpec {
  return {
    fields: [
      {
        id: "images",
        label: "Reference image",
        componentKind: "mediaList",
        valueKind: "array",
        required: true,
        advanced: false,
        defaultValue: [],
        omitWhenEmpty: true,
        omitWhenDefault: false,
        arrayMin: 1,
        arrayMax: 1,
        mediaRoleCapabilities: ["reference"],
        mediaConstraints: {
          mimeTypes: ["image/jpeg", "image/png", "image/webp"],
          extensions: [".jpeg", ".jpg", ".png", ".webp"],
          maxFileSizeBytes: 20 * 1024 * 1024,
        },
        notes: [],
      },
    ],
    validationRules: [],
  } as unknown as GenerationModelSpec;
}

function createVideoMedia(
  id: string,
  durationSec: number,
): StoredGenerationAttachmentMedia {
  return {
    id,
    userId: "user_1",
    kind: "video",
    originalFileName: `${id}.mp4`,
    bucket: "generation",
    objectKey: `${id}.mp4`,
    contentType: "video/mp4",
    contentLength: 100,
    etag: null,
    checksumSha256: null,
    metadata: {
      widthPx: 1280,
      heightPx: 720,
      durationSec,
      fps: 24,
    },
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  };
}

function createImageMedia(id: string): StoredGenerationAttachmentMedia {
  return {
    id,
    userId: "user_1",
    kind: "image",
    originalFileName: `${id}.png`,
    bucket: "generation",
    objectKey: `${id}.png`,
    contentType: "image/png",
    contentLength: 100,
    etag: null,
    checksumSha256: null,
    metadata: {
      widthPx: 1024,
      heightPx: 1024,
      durationSec: null,
      fps: null,
    },
    createdAt: new Date("2026-08-10T00:00:00.000Z"),
    updatedAt: new Date("2026-08-10T00:00:00.000Z"),
  };
}

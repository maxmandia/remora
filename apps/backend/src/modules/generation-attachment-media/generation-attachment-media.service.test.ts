import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationAttachmentMediaService } from "./generation-attachment-media.service.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";
import type {
  GenerationAttachmentMediaFieldId,
  StoredGenerationAttachmentMedia,
} from "./generation-attachment-media.types.ts";

vi.mock("../storage/object-storage.service.ts", () => ({
  ObjectStorageService: class {
    static joinObjectKey(...segments: string[]) {
      return segments
        .map((segment) => segment.replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .join("/");
    }
  },
  objectStorageService: {
    createSignedGetUrlWithExpiration: vi.fn(),
    uploadObject: vi.fn(),
  },
}));

vi.mock("./generation-attachment-media.repository.ts", () => ({
  generationAttachmentMediaRepository: {},
}));

type ServiceArgs = ConstructorParameters<
  typeof GenerationAttachmentMediaService
>;

function createService(overrides: {
  repository?: Partial<ServiceArgs[0]>;
  storage?: Partial<ServiceArgs[1]>;
  probe?: Partial<ServiceArgs[2]>;
}) {
  return new GenerationAttachmentMediaService(
    overrides.repository as ServiceArgs[0],
    overrides.storage as ServiceArgs[1],
    overrides.probe as ServiceArgs[2],
  );
}

describe("generation attachment media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates uploaded attachment media before storing it", async () => {
    const insertGenerationAttachmentMedia = vi.fn(async (media) => ({
      ...media,
      createdAt: new Date("2026-06-05T00:01:00.000Z"),
      updatedAt: new Date("2026-06-05T00:01:00.000Z"),
    }));
    const uploadObject = vi.fn(
      async ({ contentLength, contentType, objectKey }) => ({
        bucket: "remora-dev-attachment-media",
        objectKey,
        contentType,
        contentLength,
        etag: '"reference-etag"',
        checksumSha256: "reference-sha256",
      }),
    );
    const probe = vi.fn(async () => ({
      widthPx: 1024,
      heightPx: 576,
      durationSec: null,
      fps: null,
    }));
    const service = createService({
      repository: { insertGenerationAttachmentMedia },
      storage: { uploadObject, createSignedGetUrlWithExpiration: vi.fn() },
      probe: { probe },
    });

    await expect(
      service.uploadGenerationAttachmentMedia({
        userId: "user_1",
        kind: "image",
        originalFileName: "reference.png",
        contentType: "image/png",
        contentLength: null,
        body: Readable.from([Buffer.from("image")]),
      }),
    ).resolves.toMatchObject({
      id: expect.any(String),
      kind: "image",
      originalFileName: "reference.png",
      contentType: "image/png",
      contentLength: 5,
      metadata: {
        widthPx: 1024,
        heightPx: 576,
        durationSec: null,
        fps: null,
      },
    });
    expect(uploadObject).toHaveBeenCalledWith(
      expect.objectContaining({
        contentLength: 5,
        contentType: "image/png",
        objectKey: expect.stringMatching(
          /^generation-attachment-media\/users\/user_1\/image\/[a-f0-9-]+\.png$/,
        ),
      }),
    );
    expect(insertGenerationAttachmentMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        kind: "image",
      }),
    );
  });

  it("rejects uploaded attachment media when metadata cannot be inspected", async () => {
    const insertGenerationAttachmentMedia = vi.fn();
    const uploadObject = vi.fn();
    const probe = vi.fn(async () => {
      throw new Error("ffprobe failed");
    });
    const service = createService({
      repository: { insertGenerationAttachmentMedia },
      storage: { uploadObject, createSignedGetUrlWithExpiration: vi.fn() },
      probe: { probe },
    });

    await expect(
      service.uploadGenerationAttachmentMedia({
        userId: "user_1",
        kind: "image",
        originalFileName: "broken.png",
        contentType: "image/png",
        contentLength: null,
        body: Readable.from([Buffer.from("not an image")]),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "kind",
      message: "attachment media could not be inspected",
    });
    expect(uploadObject).not.toHaveBeenCalled();
    expect(insertGenerationAttachmentMedia).not.toHaveBeenCalled();
  });

  it("resolves and orders submitted attachment media against the model spec", async () => {
    const media = createStoredAttachmentMedia({ id: "reference_image_1" });
    const listGenerationAttachmentMediaByIdsForUser = vi.fn(async () => [media]);
    const service = createService({
      repository: { listGenerationAttachmentMediaByIdsForUser },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_image_1"] },
        spec: createSeedanceSpecWithAttachmentMedia(),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "reference_image_1",
        fieldId: "images",
        position: 0,
      }),
    ]);
    expect(listGenerationAttachmentMediaByIdsForUser).toHaveBeenCalledWith({
      userId: "user_1",
      ids: ["reference_image_1"],
    });
  });

  it("returns no attachment media when nothing is submitted", async () => {
    const listGenerationAttachmentMediaByIdsForUser = vi.fn();
    const service = createService({
      repository: { listGenerationAttachmentMediaByIdsForUser },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: undefined,
        spec: createSeedanceSpecWithAttachmentMedia(),
      }),
    ).resolves.toEqual([]);
    expect(listGenerationAttachmentMediaByIdsForUser).not.toHaveBeenCalled();
  });

  it("rejects submitted attachment media that violates the model constraints", async () => {
    const media = createStoredAttachmentMedia({ id: "reference_image_1" });
    const service = createService({
      repository: {
        listGenerationAttachmentMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_image_1", "reference_image_1"] },
        spec: createSeedanceSpecWithAttachmentMedia(),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "images",
    });
  });

  it("rejects submitted attachment media assigned to the wrong field kind", async () => {
    const media = createStoredAttachmentMedia({
      id: "reference_video_1",
      kind: "video",
      originalFileName: "motion.mp4",
      contentType: "video/mp4",
      metadata: {
        widthPx: 1024,
        heightPx: 576,
        durationSec: 5,
        fps: 24,
      },
    });
    const service = createService({
      repository: {
        listGenerationAttachmentMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_video_1"] },
        spec: createSeedanceSpecWithAttachmentMedia(),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "images",
    });
  });

  it("rejects Seedance audio attachments without an image or video attachment", async () => {
    const media = createStoredAttachmentMedia({
      id: "reference_audio_1",
      kind: "audio",
      originalFileName: "voice.mp3",
      contentType: "audio/mpeg",
      metadata: {
        widthPx: null,
        heightPx: null,
        durationSec: 5,
        fps: null,
      },
    });
    const service = createService({
      repository: {
        listGenerationAttachmentMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { audios: ["reference_audio_1"] },
        spec: createSeedanceSpecWithAttachmentMedia(),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "audios",
      message: "audio attachments require an image or video attachment",
    });
  });

  it("allows audio-only references for specs without Seedance content rules", async () => {
    const media = createStoredAttachmentMedia({
      id: "reference_audio_1",
      kind: "audio",
      originalFileName: "voice.mp3",
      contentType: "audio/mpeg",
      metadata: {
        widthPx: null,
        heightPx: null,
        durationSec: 5,
        fps: null,
      },
    });
    const service = createService({
      repository: {
        listGenerationAttachmentMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { audios: ["reference_audio_1"] },
        spec: createSeedanceSpecWithAttachmentMedia({ validationRules: [] }),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "reference_audio_1",
        fieldId: "audios",
        position: 0,
      }),
    ]);
  });

  it("signs attachment media attached to a submission", async () => {
    const listAttachmentMediaForSubmission = vi.fn(async () => [
      createAttachedAttachmentMedia({
        id: "reference_image_1",
        fieldId: "images",
        objectKey: "attachment-media/user_1/reference_image_1.png",
      }),
      createAttachedAttachmentMedia({
        id: "reference_video_1",
        kind: "video",
        fieldId: "videos",
        originalFileName: "motion.mp4",
        contentType: "video/mp4",
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: 5,
          fps: 24,
        },
        objectKey: "attachment-media/user_1/reference_video_1.mp4",
      }),
    ]);
    const createSignedGetUrlWithExpiration = vi.fn(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
    const service = createService({
      repository: { listAttachmentMediaForSubmission },
      storage: { createSignedGetUrlWithExpiration, uploadObject: vi.fn() },
    });

    await expect(
      service.prepareSignedAttachmentMediaForSubmission({
        submissionId: "submission_1",
      }),
    ).resolves.toEqual([
      {
        fieldId: "images",
        url: "https://signed.example/attachment-media/user_1/reference_image_1.png",
      },
      {
        fieldId: "videos",
        url: "https://signed.example/attachment-media/user_1/reference_video_1.mp4",
      },
    ]);
    expect(listAttachmentMediaForSubmission).toHaveBeenCalledWith(
      "submission_1",
    );
  });

  it("signs user-owned attachment media for display in field and position order", async () => {
    const listAttachmentMediaFromSubmission = vi.fn(async () => [
      createAttachedAttachmentMedia({
        id: "reference_video_1",
        kind: "video",
        fieldId: "videos",
        position: 0,
        originalFileName: "motion.mp4",
        contentType: "video/mp4",
        metadata: {
          widthPx: 1024,
          heightPx: 576,
          durationSec: 5,
          fps: 24,
        },
        objectKey: "attachment-media/user_1/reference_video_1.mp4",
      }),
      createAttachedAttachmentMedia({
        id: "reference_image_2",
        fieldId: "images",
        position: 1,
        originalFileName: "second.png",
        objectKey: "attachment-media/user_1/reference_image_2.png",
      }),
      createAttachedAttachmentMedia({
        id: "reference_image_1",
        fieldId: "images",
        position: 0,
        originalFileName: "first.png",
        objectKey: "attachment-media/user_1/reference_image_1.png",
      }),
      createAttachedAttachmentMedia({
        id: "reference_audio_1",
        kind: "audio",
        fieldId: "audios",
        position: 0,
        originalFileName: "sound.wav",
        contentType: "audio/wav",
        metadata: {
          widthPx: null,
          heightPx: null,
          durationSec: 3,
          fps: null,
        },
        objectKey: "attachment-media/user_1/reference_audio_1.wav",
      }),
    ]);
    const createSignedGetUrlWithExpiration = vi.fn(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
    const service = createService({
      repository: { listAttachmentMediaFromSubmission },
      storage: { createSignedGetUrlWithExpiration, uploadObject: vi.fn() },
    });

    const signedMedia = await service.listSignedAttachmentMediaFromSubmission({
      submissionId: "submission_1",
      userId: "user_1",
    });

    expect(
      signedMedia.map((media) => `${media.fieldId}:${media.id}`),
    ).toEqual([
      "images:reference_image_1",
      "images:reference_image_2",
      "videos:reference_video_1",
      "audios:reference_audio_1",
    ]);
    expect(signedMedia[0]).toMatchObject({
      id: "reference_image_1",
      kind: "image",
      originalFileName: "first.png",
      url: "https://signed.example/attachment-media/user_1/reference_image_1.png",
      urlExpiresAt: "2026-06-05T00:17:00.000Z",
    });
    expect(listAttachmentMediaFromSubmission).toHaveBeenCalledWith({
      submissionId: "submission_1",
      userId: "user_1",
    });
    expect(
      createSignedGetUrlWithExpiration.mock.calls.map(
        ([reference]) => reference.objectKey,
      ),
    ).toEqual([
      "attachment-media/user_1/reference_image_1.png",
      "attachment-media/user_1/reference_image_2.png",
      "attachment-media/user_1/reference_video_1.mp4",
      "attachment-media/user_1/reference_audio_1.wav",
    ]);
  });

  it("returns no signed display media for missing or inaccessible submissions", async () => {
    const listAttachmentMediaFromSubmission = vi.fn(async () => []);
    const createSignedGetUrlWithExpiration = vi.fn();
    const service = createService({
      repository: { listAttachmentMediaFromSubmission },
      storage: { createSignedGetUrlWithExpiration, uploadObject: vi.fn() },
    });

    await expect(
      service.listSignedAttachmentMediaFromSubmission({
        submissionId: "submission_1",
        userId: "user_1",
      }),
    ).resolves.toEqual([]);
    expect(createSignedGetUrlWithExpiration).not.toHaveBeenCalled();
  });
});

function createStoredAttachmentMedia(
  overrides: Partial<StoredGenerationAttachmentMedia> = {},
): StoredGenerationAttachmentMedia {
  return {
    id: "reference_image_1",
    userId: "user_1",
    kind: "image",
    originalFileName: "reference.png",
    bucket: "remora-dev-attachment-media",
    objectKey: "attachment-media/user_1/reference_image_1.png",
    contentType: "image/png",
    contentLength: 5,
    etag: '"reference-etag"',
    checksumSha256: "reference-sha256",
    metadata: {
      widthPx: 1024,
      heightPx: 576,
      durationSec: null,
      fps: null,
    },
    createdAt: new Date("2026-06-05T00:00:00.000Z"),
    updatedAt: new Date("2026-06-05T00:00:00.000Z"),
    ...overrides,
  };
}

function createAttachedAttachmentMedia(
  overrides: Partial<
    StoredGenerationAttachmentMedia & {
      fieldId: GenerationAttachmentMediaFieldId;
      position: number;
    }
  > = {},
): StoredGenerationAttachmentMedia & {
  fieldId: GenerationAttachmentMediaFieldId;
  position: number;
} {
  return {
    ...createStoredAttachmentMedia(overrides),
    fieldId: "images",
    position: 0,
    ...overrides,
  };
}

function createSeedanceSpecWithAttachmentMedia(
  overrides: Partial<Pick<VideoModelSpec, "validationRules">> = {},
): VideoModelSpec {
  const spec = createSeedanceSpec();

  return {
    ...spec,
    validationRules: overrides.validationRules ?? spec.validationRules,
    fields: [
      ...spec.fields,
      createField({
        id: "images",
        label: "Images",
        componentKind: "mediaList",
        valueKind: "array",
        defaultValue: [],
        arrayMax: 1,
        mediaRoleCapabilities: ["reference"],
        mediaConstraints: {
          mimeTypes: ["image/png"],
          extensions: [".png"],
          maxFileSizeBytes: 1024 * 1024,
          minDimensionPx: 512,
          maxDimensionPx: 2048,
          minAspectRatio: 1,
          maxAspectRatio: 2,
        },
      }),
      createField({
        id: "videos",
        label: "Videos",
        componentKind: "mediaList",
        valueKind: "array",
        defaultValue: [],
        arrayMax: 1,
        mediaRoleCapabilities: ["reference"],
        mediaConstraints: {
          mimeTypes: ["video/mp4"],
          extensions: [".mp4"],
          maxFileSizeBytes: 1024 * 1024,
          maxDurationSec: 10,
        },
      }),
      createField({
        id: "audios",
        label: "Audios",
        componentKind: "mediaList",
        valueKind: "array",
        defaultValue: [],
        arrayMax: 1,
        mediaRoleCapabilities: ["reference"],
        mediaConstraints: {
          mimeTypes: ["audio/mpeg"],
          extensions: [".mp3"],
          maxFileSizeBytes: 1024 * 1024,
          maxDurationSec: 10,
        },
      }),
    ],
  };
}

function createSeedanceSpec(
  overrides: Partial<VideoModelSpec> = {},
): VideoModelSpec {
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
      path: "/contents/generations/tasks",
    },
    modelParameter: {
      path: ["model"],
      source: "spec",
    },
    fields: [
      createField({
        id: "prompt",
        valueKind: "string",
        maxLength: 10,
      }),
    ],
    groups: [
      {
        id: "output",
        label: "Output",
        fieldIds: ["prompt"],
        advanced: false,
      },
    ],
    transforms: [{ kind: "seedanceContentArray" }],
    validationRules: ["seedance20ContentRules"],
    ...overrides,
  };
}

function createField(overrides: Partial<VideoFieldSpec>): VideoFieldSpec {
  return {
    id: "prompt",
    label: "Field",
    componentKind: "select",
    valueKind: "string",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as VideoFieldSpec;
}

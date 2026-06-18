import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GenerationReferenceMediaService } from "./generation-reference-media.service.ts";

import type { VideoFieldSpec, VideoModelSpec } from "../model/types.ts";
import type {
  GenerationReferenceMediaFieldId,
  StoredGenerationReferenceMedia,
} from "./generation-reference-media.types.ts";

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

vi.mock("./generation-reference-media.repository.ts", () => ({
  generationReferenceMediaRepository: {},
}));

type ServiceArgs = ConstructorParameters<
  typeof GenerationReferenceMediaService
>;

function createService(overrides: {
  repository?: Partial<ServiceArgs[0]>;
  storage?: Partial<ServiceArgs[1]>;
  probe?: Partial<ServiceArgs[2]>;
}) {
  return new GenerationReferenceMediaService(
    overrides.repository as ServiceArgs[0],
    overrides.storage as ServiceArgs[1],
    overrides.probe as ServiceArgs[2],
  );
}

describe("generation reference media service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates uploaded reference media before storing it", async () => {
    const insertGenerationReferenceMedia = vi.fn(async (media) => ({
      ...media,
      createdAt: new Date("2026-06-05T00:01:00.000Z"),
      updatedAt: new Date("2026-06-05T00:01:00.000Z"),
    }));
    const uploadObject = vi.fn(
      async ({ contentLength, contentType, objectKey }) => ({
        bucket: "remora-dev-reference-media",
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
      repository: { insertGenerationReferenceMedia },
      storage: { uploadObject, createSignedGetUrlWithExpiration: vi.fn() },
      probe: { probe },
    });

    await expect(
      service.uploadGenerationReferenceMedia({
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
          /^generation-reference-media\/users\/user_1\/image\/[a-f0-9-]+\.png$/,
        ),
      }),
    );
    expect(insertGenerationReferenceMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        kind: "image",
      }),
    );
  });

  it("rejects uploaded reference media when metadata cannot be inspected", async () => {
    const insertGenerationReferenceMedia = vi.fn();
    const uploadObject = vi.fn();
    const probe = vi.fn(async () => {
      throw new Error("ffprobe failed");
    });
    const service = createService({
      repository: { insertGenerationReferenceMedia },
      storage: { uploadObject, createSignedGetUrlWithExpiration: vi.fn() },
      probe: { probe },
    });

    await expect(
      service.uploadGenerationReferenceMedia({
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
      message: "reference media could not be inspected",
    });
    expect(uploadObject).not.toHaveBeenCalled();
    expect(insertGenerationReferenceMedia).not.toHaveBeenCalled();
  });

  it("resolves and orders submitted reference media against the model spec", async () => {
    const media = createStoredReferenceMedia({ id: "reference_image_1" });
    const listGenerationReferenceMediaByIdsForUser = vi.fn(async () => [media]);
    const service = createService({
      repository: { listGenerationReferenceMediaByIdsForUser },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_image_1"] },
        spec: createSeedanceSpecWithReferenceMedia(),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "reference_image_1",
        fieldId: "images",
        position: 0,
      }),
    ]);
    expect(listGenerationReferenceMediaByIdsForUser).toHaveBeenCalledWith({
      userId: "user_1",
      ids: ["reference_image_1"],
    });
  });

  it("returns no reference media when nothing is submitted", async () => {
    const listGenerationReferenceMediaByIdsForUser = vi.fn();
    const service = createService({
      repository: { listGenerationReferenceMediaByIdsForUser },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: undefined,
        spec: createSeedanceSpecWithReferenceMedia(),
      }),
    ).resolves.toEqual([]);
    expect(listGenerationReferenceMediaByIdsForUser).not.toHaveBeenCalled();
  });

  it("rejects submitted reference media that violates the model constraints", async () => {
    const media = createStoredReferenceMedia({ id: "reference_image_1" });
    const service = createService({
      repository: {
        listGenerationReferenceMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_image_1", "reference_image_1"] },
        spec: createSeedanceSpecWithReferenceMedia(),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "images",
    });
  });

  it("rejects submitted reference media assigned to the wrong field kind", async () => {
    const media = createStoredReferenceMedia({
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
        listGenerationReferenceMediaByIdsForUser: vi.fn(async () => [media]),
      },
    });

    await expect(
      service.resolveSelectionForSubmission({
        userId: "user_1",
        input: { images: ["reference_video_1"] },
        spec: createSeedanceSpecWithReferenceMedia(),
      }),
    ).rejects.toMatchObject({
      code: "INVALID_GENERATION_INPUT",
      field: "images",
    });
  });

  it("signs reference media attached to a submission", async () => {
    const listReferenceMediaForSubmission = vi.fn(async () => [
      createAttachedReferenceMedia({
        id: "reference_image_1",
        fieldId: "images",
        objectKey: "reference-media/user_1/reference_image_1.png",
      }),
      createAttachedReferenceMedia({
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
        objectKey: "reference-media/user_1/reference_video_1.mp4",
      }),
    ]);
    const createSignedGetUrlWithExpiration = vi.fn(
      async ({ objectKey }: { bucket: string; objectKey: string }) => ({
        url: `https://signed.example/${objectKey}`,
        expiresAt: "2026-06-05T00:17:00.000Z",
      }),
    );
    const service = createService({
      repository: { listReferenceMediaForSubmission },
      storage: { createSignedGetUrlWithExpiration, uploadObject: vi.fn() },
    });

    await expect(
      service.prepareSignedReferenceMediaForSubmission({
        submissionId: "submission_1",
      }),
    ).resolves.toEqual([
      {
        fieldId: "images",
        url: "https://signed.example/reference-media/user_1/reference_image_1.png",
      },
      {
        fieldId: "videos",
        url: "https://signed.example/reference-media/user_1/reference_video_1.mp4",
      },
    ]);
    expect(listReferenceMediaForSubmission).toHaveBeenCalledWith(
      "submission_1",
    );
  });
});

function createStoredReferenceMedia(
  overrides: Partial<StoredGenerationReferenceMedia> = {},
): StoredGenerationReferenceMedia {
  return {
    id: "reference_image_1",
    userId: "user_1",
    kind: "image",
    originalFileName: "reference.png",
    bucket: "remora-dev-reference-media",
    objectKey: "reference-media/user_1/reference_image_1.png",
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

function createAttachedReferenceMedia(
  overrides: Partial<
    StoredGenerationReferenceMedia & {
      fieldId: GenerationReferenceMediaFieldId;
      position: number;
    }
  > = {},
): StoredGenerationReferenceMedia & {
  fieldId: GenerationReferenceMediaFieldId;
  position: number;
} {
  return {
    ...createStoredReferenceMedia(overrides),
    fieldId: "images",
    position: 0,
    ...overrides,
  };
}

function createSeedanceSpecWithReferenceMedia(): VideoModelSpec {
  const spec = createSeedanceSpec();

  return {
    ...spec,
    fields: [
      ...spec.fields,
      createField({
        id: "images",
        label: "Images",
        componentKind: "mediaList",
        valueKind: "array",
        defaultValue: [],
        arrayMax: 1,
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
        mediaConstraints: {
          mimeTypes: ["video/mp4"],
          extensions: [".mp4"],
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
  };
}

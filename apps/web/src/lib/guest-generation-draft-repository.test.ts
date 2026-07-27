/** @vitest-environment jsdom */

import "fake-indexeddb/auto";

import type {
  CreateGuestGenerationDraftInput,
  GuestGenerationDraftAttachment,
  GuestGenerationDraftV1,
} from "./guest-generation-draft";
import {
  createGuestGenerationDraftRepository,
  currentGuestGenerationDraftKey,
  guestGenerationDraftDatabaseName,
  guestGenerationDraftObjectStoreName,
} from "./guest-generation-draft-repository";
import type {
  GenerationAttachmentMediaValue,
  GenerationSettingsValue,
} from "@remora/app/generation";
import type {
  GenerationAttachmentMediaFieldSpec,
  GenerationFieldSpec,
  GenerationModelType,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import { Blob as NodeBlob, File as NodeFile } from "node:buffer";
import { deleteDB, openDB } from "idb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const now = Date.UTC(2026, 6, 26, 12);
const IndexedDBCloneableBlob = NodeBlob as unknown as typeof Blob;
const IndexedDBCloneableFile = NodeFile as unknown as typeof File;

describe("GuestGenerationDraftRepository", () => {
  beforeEach(async () => {
    vi.stubGlobal("Blob", IndexedDBCloneableBlob);
    vi.stubGlobal("File", IndexedDBCloneableFile);
    await deleteDB(guestGenerationDraftDatabaseName);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each([
    {
      createInput: createImageInput,
      expectedFieldId: "images",
      expectedRole: "reference",
      label: "image",
      model: createImageModel(),
    },
    {
      createInput: createVideoInput,
      expectedFieldId: "videos",
      expectedRole: "reference",
      label: "video",
      model: createVideoModel(),
    },
  ])(
    "round-trips a complete $label draft and reconstructs its File",
    async ({ createInput, expectedFieldId, expectedRole, model }) => {
      const repository = createGuestGenerationDraftRepository({
        now: () => now,
      });
      const input = createInput(model);
      const originalFile = getOnlyFile(input.attachmentMedia);
      const originalBytes = await originalFile.arrayBuffer();

      expect(model.spec.id).not.toBe(model.latestSpecId);

      const saveResult = await repository.save(input);
      const readResult = await repository.read([model]);

      expect(saveResult).toMatchObject({
        status: "saved",
        draft: {
          expiresAt: now + 24 * 60 * 60 * 1000,
          modelId: model.id,
          modelSpecId: model.latestSpecId,
          promotionTicket: "promotion-ticket",
          prompt: input.prompt,
          schemaVersion: 1,
          settings: input.settings,
        },
      });
      expect(readResult.status).toBe("found");

      if (readResult.status !== "found") {
        throw new Error("Expected a stored guest draft.");
      }

      const attachment = readResult.draft.attachments[0]!;

      expect(attachment).toMatchObject({
        fieldId: expectedFieldId,
        metadata: {
          lastModified: originalFile.lastModified,
          name: originalFile.name,
          size: originalFile.size,
          type: originalFile.type,
        },
        role: expectedRole,
      });
      expect(attachment.file).toBeInstanceOf(File);
      expect(attachment.file).not.toBe(originalFile);
      expect(attachment.file.name).toBe(originalFile.name);
      expect(attachment.file.type).toBe(originalFile.type);
      expect(attachment.file.lastModified).toBe(originalFile.lastModified);
      expect(await attachment.file.arrayBuffer()).toEqual(originalBytes);
    },
  );

  it("atomically replaces and explicitly clears the current draft", async () => {
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    await repository.save(createImageInput(model));
    await repository.save({
      ...createImageInput(model),
      prompt: "Replacement prompt",
    });

    await expect(repository.read([model])).resolves.toMatchObject({
      status: "found",
      draft: { prompt: "Replacement prompt" },
    });
    await expect(repository.clear()).resolves.toEqual({ status: "cleared" });
    await expect(repository.clear()).resolves.toEqual({ status: "cleared" });
    await expect(repository.read([model])).resolves.toEqual({
      status: "empty",
    });
  });

  it("expires and removes a draft at the 24-hour boundary", async () => {
    let currentTime = now;
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => currentTime,
    });

    await repository.save(createImageInput(model));
    currentTime += 24 * 60 * 60 * 1000;

    await expect(repository.read([model])).resolves.toEqual({
      reason: "expired",
      status: "discarded",
    });
    await expect(repository.read([model])).resolves.toEqual({
      status: "empty",
    });
  });

  it("discards malformed and unsupported-version records", async () => {
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    await repository.clear();
    await writeRawDraft({ schemaVersion: 2 });

    await expect(repository.read([createImageModel()])).resolves.toEqual({
      reason: "malformed",
      status: "discarded",
    });
    await expect(readRawDraft()).resolves.toBeUndefined();
  });

  it("discards attachment records whose immutable metadata is corrupt", async () => {
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });
    const saveResult = await repository.save(createImageInput(model));

    if (saveResult.status !== "saved") {
      throw new Error("Expected the test draft to save.");
    }

    await writeRawDraft({
      ...saveResult.draft,
      attachments: saveResult.draft.attachments.map((attachment) => ({
        ...attachment,
        metadata: {
          ...attachment.metadata,
          size: attachment.metadata.size + 1,
        },
      })),
    });

    await expect(repository.read([model])).resolves.toEqual({
      reason: "malformed",
      status: "discarded",
    });
  });

  it.each([
    {
      label: "unexpected fields",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        unexpected: true,
      }),
    },
    {
      label: "negative timestamps",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        expiresAt: -1,
      }),
    },
    {
      label: "unsafe timestamps",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        expiresAt: Number.MAX_SAFE_INTEGER + 1,
      }),
    },
  ])("discards records with $label", async ({ mutate }) => {
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });
    const saveResult = await repository.save(createImageInput(model));

    if (saveResult.status !== "saved") {
      throw new Error("Expected the test draft to save.");
    }

    await writeRawDraft(mutate(saveResult.draft));

    await expect(repository.read([model])).resolves.toEqual({
      reason: "malformed",
      status: "discarded",
    });
  });

  it("discards drafts when the model is removed or its published spec changes", async () => {
    const model = createVideoModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    await repository.save(createVideoInput(model));
    await expect(repository.read([])).resolves.toEqual({
      reason: "incompatible",
      status: "discarded",
    });

    await repository.save(createVideoInput(model));
    await expect(
      repository.read([
        {
          ...model,
          latestSpecId: `${model.latestSpecId}-replacement`,
        },
      ]),
    ).resolves.toEqual({
      reason: "incompatible",
      status: "discarded",
    });
  });

  it.each([
    {
      label: "invalid settings",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        settings: { ...draft.settings, resolution: "unsupported" },
      }),
    },
    {
      label: "unsupported attachment roles",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        attachments: draft.attachments.map((attachment) => ({
          ...attachment,
          role: "firstFrame",
        })),
      }),
    },
    {
      label: "unsupported attachment formats",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        attachments: [
          createStoredAttachment(
            new File(["svg"], "reference.svg", {
              type: "image/svg+xml",
            }),
          ),
        ],
      }),
    },
    {
      label: "excessive attachment counts",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        attachments: Array.from({ length: 3 }, (_, index) =>
          createStoredAttachment(
            new File(["image"], `reference-${index}.png`, {
              type: "image/png",
            }),
          ),
        ),
      }),
    },
    {
      label: "excessive individual file sizes",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        attachments: [
          createStoredAttachment(
            new File(["x".repeat(65)], "reference.png", {
              type: "image/png",
            }),
          ),
        ],
      }),
    },
    {
      label: "excessive aggregate file sizes",
      mutate: (draft: GuestGenerationDraftV1) => ({
        ...draft,
        attachments: Array.from({ length: 2 }, (_, index) =>
          createStoredAttachment(
            new File(["x".repeat(49)], `reference-${index}.png`, {
              type: "image/png",
            }),
          ),
        ),
      }),
    },
  ])("discards persisted drafts with $label", async ({ mutate }) => {
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });
    const saveResult = await repository.save(createImageInput(model));

    if (saveResult.status !== "saved") {
      throw new Error("Expected the test draft to save.");
    }

    await writeRawDraft(mutate(saveResult.draft));

    await expect(repository.read([model])).resolves.toEqual({
      reason: "incompatible",
      status: "discarded",
    });
    await expect(readRawDraft()).resolves.toBeUndefined();
  });

  it.each([
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        prompt: "   ",
      }),
      label: "blank prompt",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        promotionTicket: "",
      }),
      label: "blank promotion ticket",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        settings: {
          ...input.settings,
          resolution: "unsupported",
        } as GenerationSettingsValue,
      }),
      label: "unsupported settings",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        attachmentMedia: {
          ...input.attachmentMedia,
          images: [
            {
              file: new File(["svg"], "reference.svg", {
                type: "image/svg+xml",
              }),
              role: "reference" as const,
            },
          ],
        },
      }),
      label: "unsupported attachment format",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        attachmentMedia: {
          ...input.attachmentMedia,
          images: [
            {
              file: new File(["x".repeat(65)], "reference.png", {
                type: "image/png",
              }),
              role: "reference" as const,
            },
          ],
        },
      }),
      label: "oversized attachment",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        attachmentMedia: {
          ...input.attachmentMedia,
          images: Array.from({ length: 3 }, (_, index) => ({
            file: new File(["image"], `reference-${index}.png`, {
              type: "image/png",
            }),
            role: "reference" as const,
          })),
        },
      }),
      label: "excessive attachment count",
    },
    {
      change: (input: CreateGuestGenerationDraftInput) => ({
        ...input,
        attachmentMedia: {
          ...input.attachmentMedia,
          images: input.attachmentMedia.images.map((item) => ({
            ...item,
            role: "firstFrame" as const,
          })),
        },
      }),
      label: "unsupported attachment role",
    },
  ])("rejects a snapshot with $label", async ({ change }) => {
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });
    const result = await repository.save(
      change(createImageInput(createImageModel())),
    );

    expect(result).toEqual({
      reason: "invalid-draft",
      status: "rejected",
    });
  });

  it("reports unavailable IndexedDB without mutating the caller draft", async () => {
    const model = createImageModel();
    const input = createImageInput(model);
    const attachmentMedia = input.attachmentMedia;
    const file = getOnlyFile(attachmentMedia);
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    vi.stubGlobal("indexedDB", undefined);

    await expect(repository.save(input)).resolves.toEqual({
      reason: "unavailable",
      status: "failed",
    });
    await expect(repository.read([model])).resolves.toEqual({
      reason: "unavailable",
      status: "failed",
    });
    await expect(repository.clear()).resolves.toEqual({
      reason: "unavailable",
      status: "failed",
    });
    expect(input.attachmentMedia).toBe(attachmentMedia);
    expect(getOnlyFile(input.attachmentMedia)).toBe(file);
    expect(input.prompt).toBe("Create a bright reef");
  });

  it("reports quota exhaustion without mutating or clearing the caller draft", async () => {
    const model = createImageModel();
    const input = createImageInput(model);
    const attachmentMedia = input.attachmentMedia;
    const file = getOnlyFile(attachmentMedia);
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("Storage quota exceeded.", "QuotaExceededError");
    });

    await expect(repository.save(input)).resolves.toEqual({
      reason: "quota-exceeded",
      status: "failed",
    });
    expect(input.attachmentMedia).toBe(attachmentMedia);
    expect(getOnlyFile(input.attachmentMedia)).toBe(file);
  });

  it("reports read transaction failures without surfacing a stale draft", async () => {
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    await repository.save(createImageInput(model));
    vi.spyOn(IDBObjectStore.prototype, "get").mockImplementation(() => {
      throw new Error("Read failed.");
    });

    await expect(repository.read([model])).resolves.toEqual({
      reason: "storage-error",
      status: "failed",
    });
  });

  it("reports browser security errors as unavailable storage", async () => {
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    vi.spyOn(indexedDB, "open").mockImplementation(() => {
      throw new DOMException("Storage access denied.", "SecurityError");
    });

    await expect(repository.clear()).resolves.toEqual({
      reason: "unavailable",
      status: "failed",
    });
  });

  it("performs persistence without network requests", async () => {
    const fetchMock = vi.fn();
    const model = createImageModel();
    const repository = createGuestGenerationDraftRepository({
      now: () => now,
    });

    vi.stubGlobal("fetch", fetchMock);

    await repository.save(createImageInput(model));
    await repository.read([model]);
    await repository.clear();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

async function writeRawDraft(value: unknown) {
  const database = await openDB(guestGenerationDraftDatabaseName, 1, {
    upgrade(database) {
      if (
        !database.objectStoreNames.contains(guestGenerationDraftObjectStoreName)
      ) {
        database.createObjectStore(guestGenerationDraftObjectStoreName);
      }
    },
  });

  try {
    await database.put(
      guestGenerationDraftObjectStoreName,
      value,
      currentGuestGenerationDraftKey,
    );
  } finally {
    database.close();
  }
}

async function readRawDraft() {
  const database = await openDB(guestGenerationDraftDatabaseName, 1);

  try {
    return await database.get(
      guestGenerationDraftObjectStoreName,
      currentGuestGenerationDraftKey,
    );
  } finally {
    database.close();
  }
}

function createImageInput(
  model: PublishedGenerationModelSummary,
): CreateGuestGenerationDraftInput {
  const file = new File(["image-bytes"], "reef.png", {
    lastModified: 1_721_996_400_000,
    type: "image/png",
  });

  return {
    attachmentMedia: {
      audios: [],
      images: [{ file, role: "reference" }],
      videos: [],
    },
    model,
    promotionTicket: "promotion-ticket",
    prompt: "Create a bright reef",
    settings: {
      aspectRatio: "1:1",
      modelType: "image",
      requestedGenerations: 2,
      resolution: "1K",
    },
  };
}

function createVideoInput(
  model: PublishedGenerationModelSummary,
): CreateGuestGenerationDraftInput {
  const file = new File(["video-bytes"], "reef.mp4", {
    lastModified: 1_721_996_500_000,
    type: "video/mp4",
  });

  return {
    attachmentMedia: {
      audios: [],
      images: [],
      videos: [{ file, role: "reference" }],
    },
    model,
    promotionTicket: "promotion-ticket",
    prompt: "Animate the reef",
    settings: {
      aspectRatio: "16:9",
      duration: 5,
      generateAudio: true,
      modelType: "video",
      requestedGenerations: 1,
      resolution: "720p",
    },
  };
}

function createImageModel() {
  return createModel({
    id: "test-image",
    specId: "test-image-v1",
    type: "image",
  });
}

function createVideoModel() {
  return createModel({
    id: "test-video",
    specId: "test-video-v1",
    type: "video",
  });
}

function createModel({
  id,
  specId,
  type,
}: {
  id: string;
  specId: string;
  type: GenerationModelType;
}): PublishedGenerationModelSummary {
  const fields: GenerationFieldSpec[] = [
    createField({
      id: "prompt",
      componentKind: "promptTextarea",
      valueKind: "string",
      maxLength: 1_000,
    }),
    createMediaField("images", ["reference"], ["image/png"], [".png"], 2),
    createField({
      id: "resolution",
      componentKind: "select",
      valueKind: "string",
      options:
        type === "image"
          ? [{ label: "1K", value: "1K" }]
          : [{ label: "720p", value: "720p" }],
    }),
    createField({
      id: "aspectRatio",
      componentKind: "select",
      valueKind: "string",
      options:
        type === "image"
          ? [{ label: "Square", value: "1:1" }]
          : [{ label: "Widescreen", value: "16:9" }],
    }),
  ];

  if (type === "video") {
    fields.splice(
      2,
      0,
      createMediaField("videos", ["reference"], ["video/mp4"], [".mp4"], 1),
      createMediaField("audios", ["reference"], ["audio/mpeg"], [".mp3"], 1),
    );
    fields.push(
      createField({
        id: "duration",
        componentKind: "select",
        valueKind: "integer",
        min: 4,
        max: 10,
        options: [{ label: "5 seconds", value: 5 }],
      }),
      createField({
        id: "generateAudio",
        componentKind: "toggle",
        valueKind: "boolean",
        options: [{ label: "On", value: true }],
      }),
    );
  }

  const nonEmptyFields = fields as [
    GenerationFieldSpec,
    ...GenerationFieldSpec[],
  ];

  return {
    displayName: id,
    id,
    latestSpecId: specId,
    latestSpecVersion: 1,
    providerId: "google",
    providerName: "Google",
    type,
    spec: {
      displayName: id,
      endpoint: { method: "POST", path: "/test" },
      fields: nonEmptyFields,
      groups: [
        {
          advanced: false,
          fieldIds: ["prompt"],
          id: "input",
          label: "Input",
        },
      ],
      id,
      modelParameter: { path: ["model"], source: "runtime" },
      provider: "google",
      providerModelId: null,
      schemaVersion: 1,
      sourceUrls: [],
      status: "published",
      transforms: [],
      type,
      validationRules: [],
    },
  };
}

function createField(
  overrides: Partial<GenerationFieldSpec>,
): GenerationFieldSpec {
  return {
    advanced: false,
    componentKind: "select",
    id: "resolution",
    label: String(overrides.id ?? "Field"),
    notes: [],
    omitWhenDefault: false,
    omitWhenEmpty: false,
    required: false,
    valueKind: "string",
    ...overrides,
  } as GenerationFieldSpec;
}

function createMediaField(
  id: "audios" | "images" | "videos",
  mediaRoleCapabilities: GenerationAttachmentMediaFieldSpec["mediaRoleCapabilities"],
  mimeTypes: string[],
  extensions: string[],
  arrayMax: number,
): GenerationAttachmentMediaFieldSpec {
  return {
    advanced: false,
    arrayMax,
    componentKind: "mediaList",
    id,
    label: id,
    mediaConstraints: {
      extensions,
      maxFileSizeBytes: 64,
      maxTotalFileSizeBytes: 96,
      mimeTypes,
    },
    mediaRoleCapabilities,
    notes: [],
    omitWhenDefault: false,
    omitWhenEmpty: true,
    required: false,
    valueKind: "array",
  };
}

function createStoredAttachment(file: File): GuestGenerationDraftAttachment {
  return {
    fieldId: "images",
    file,
    metadata: {
      lastModified: file.lastModified,
      name: file.name,
      size: file.size,
      type: file.type,
    },
    role: "reference",
  };
}

function getOnlyFile(value: GenerationAttachmentMediaValue) {
  const files = [...value.images, ...value.videos, ...value.audios].map(
    (item) => item.file,
  );

  if (files.length !== 1) {
    throw new Error("Expected one attachment file.");
  }

  return files[0]!;
}

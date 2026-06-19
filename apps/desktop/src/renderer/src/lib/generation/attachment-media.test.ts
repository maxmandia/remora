import type {
  MediaConstraints,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { describe, expect, it } from "vitest";

import {
  describeAttachmentMediaFileIssue,
  getGenerationAttachmentMediaFieldSpecs,
  getAttachmentMediaAccept,
  getAttachmentMediaFieldIdForFile,
  getAttachmentMediaRoleCapabilities,
  hasGenerationAttachmentMediaValidationIssues,
  matchesAttachmentMediaField,
  validateAttachmentMediaFile,
  validateAttachmentMediaSelection,
  type AttachmentMediaFieldId,
  type AttachmentMediaFieldSpec,
} from "./attachment-media.ts";

const imageConstraints: MediaConstraints = {
  mimeTypes: ["image/png", "image/heic"],
  extensions: [".png", ".heic"],
  maxFileSizeBytes: 10,
};

function createFieldSpec(
  id: AttachmentMediaFieldId,
  mediaConstraints?: MediaConstraints,
  mediaRoleCapabilities: AttachmentMediaFieldSpec["mediaRoleCapabilities"] = [
    "reference",
  ],
): AttachmentMediaFieldSpec {
  return {
    id,
    label: id,
    componentKind: "mediaList",
    valueKind: "array",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    arrayMax: 9,
    mediaRoleCapabilities,
    mediaConstraints,
    notes: [],
  };
}

describe("getAttachmentMediaAccept", () => {
  it("joins mime types and extensions from constraints", () => {
    expect(
      getAttachmentMediaAccept(createFieldSpec("images", imageConstraints)),
    ).toBe("image/png,image/heic,.png,.heic");
  });

  it("falls back to the per-kind wildcard without constraints", () => {
    expect(getAttachmentMediaAccept(createFieldSpec("images"))).toBe("image/*");
    expect(getAttachmentMediaAccept(createFieldSpec("videos"))).toBe("video/*");
    expect(getAttachmentMediaAccept(createFieldSpec("audios"))).toBe("audio/*");
  });
});

describe("getAttachmentMediaRoleCapabilities", () => {
  it("returns the role capabilities declared by the media field", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);

    expect(getAttachmentMediaRoleCapabilities(fieldSpec)).toEqual([
      "reference",
    ]);
  });
});

describe("getGenerationAttachmentMediaFieldSpecs", () => {
  it("returns Seedance image, video, and audio role capabilities", () => {
    const model = createModel([
      createFieldSpec("images", undefined, [
        "firstFrame",
        "lastFrame",
        "reference",
      ]),
      createFieldSpec("videos"),
      createFieldSpec("audios"),
    ]);

    expect(
      Object.fromEntries(
        getGenerationAttachmentMediaFieldSpecs(model).map((fieldSpec) => [
          fieldSpec.id,
          fieldSpec.mediaRoleCapabilities,
        ]),
      ),
    ).toEqual({
      images: ["firstFrame", "lastFrame", "reference"],
      videos: ["reference"],
      audios: ["reference"],
    });
  });
});

describe("matchesAttachmentMediaField", () => {
  it("matches by extension even when file.type is empty", () => {
    const heic = new File(["x"], "portrait.HEIC", { type: "" });

    expect(
      matchesAttachmentMediaField(
        createFieldSpec("images", imageConstraints),
        heic,
      ),
    ).toBe(true);
  });

  it("matches by mime type", () => {
    const png = new File(["x"], "blob", { type: "image/png" });

    expect(
      matchesAttachmentMediaField(
        createFieldSpec("images", imageConstraints),
        png,
      ),
    ).toBe(true);
  });

  it("rejects formats outside the constraints", () => {
    const svg = new File(["x"], "icon.svg", { type: "image/svg+xml" });

    expect(
      matchesAttachmentMediaField(
        createFieldSpec("images", imageConstraints),
        svg,
      ),
    ).toBe(false);
  });

  it("falls back to mime-prefix matching without constraints", () => {
    const png = new File(["x"], "blob.png", { type: "image/png" });
    const mp4 = new File(["x"], "clip.mp4", { type: "video/mp4" });

    expect(matchesAttachmentMediaField(createFieldSpec("images"), png)).toBe(
      true,
    );
    expect(matchesAttachmentMediaField(createFieldSpec("images"), mp4)).toBe(
      false,
    );
  });
});

describe("getAttachmentMediaFieldIdForFile", () => {
  const fieldSpecs = [
    createFieldSpec("images", imageConstraints),
    createFieldSpec("videos", {
      mimeTypes: ["video/mp4"],
      extensions: [".mp4"],
    }),
  ];

  it("routes a matching file to its field", () => {
    const heic = new File(["x"], "portrait.heic", { type: "" });

    expect(getAttachmentMediaFieldIdForFile(heic, fieldSpecs)).toBe("images");
  });

  it("returns null for an unsupported format", () => {
    const txt = new File(["x"], "notes.txt", { type: "text/plain" });

    expect(getAttachmentMediaFieldIdForFile(txt, fieldSpecs)).toBeNull();
  });

  it("falls back to mime prefix for fields without constraints", () => {
    const audio = new File(["x"], "voice.unknown", { type: "audio/mpeg" });

    expect(
      getAttachmentMediaFieldIdForFile(audio, [createFieldSpec("audios")]),
    ).toBe("audios");
  });
});

describe("validateAttachmentMediaFile", () => {
  it("reports oversize files", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["12345678901"], "big.png", { type: "image/png" });

    expect(validateAttachmentMediaFile(fieldSpec, file)).toEqual([
      { kind: "fileTooLarge", maxBytes: 10 },
    ]);
  });

  it("returns no issues for a file within the size limit", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["1234"], "small.png", { type: "image/png" });

    expect(validateAttachmentMediaFile(fieldSpec, file)).toEqual([]);
  });

  it("reports unsupported formats for files preserved after model changes", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["1234"], "clip.mp4", { type: "video/mp4" });

    expect(validateAttachmentMediaFile(fieldSpec, file)).toEqual([
      { kind: "unsupportedFormat" },
    ]);
  });

  it("returns no issues without constraints", () => {
    const file = new File(["1234"], "small.png", { type: "image/png" });

    expect(validateAttachmentMediaFile(createFieldSpec("images"), file)).toEqual(
      [],
    );
  });
});

describe("validateAttachmentMediaSelection", () => {
  it("reports audio attachments without an image or video attachment", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      validateAttachmentMediaSelection(
        "audios",
        {
          images: [],
          videos: [],
          audios: [audio],
        },
        createModel([createFieldSpec("audios")]),
      ),
    ).toEqual([{ kind: "audioRequiresVisualAttachment" }]);
  });

  it("allows audio attachments with an image or video attachment", () => {
    const image = new File(["image"], "reference.png", { type: "image/png" });
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      validateAttachmentMediaSelection(
        "audios",
        {
          images: [image],
          videos: [],
          audios: [audio],
        },
        createModel([createFieldSpec("images"), createFieldSpec("audios")]),
      ),
    ).toEqual([]);
  });

  it("allows audio-only references for models without Seedance content rules", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      validateAttachmentMediaSelection(
        "audios",
        {
          images: [],
          videos: [],
          audios: [audio],
        },
        createModel([createFieldSpec("audios")], []),
      ),
    ).toEqual([]);
  });
});

describe("hasGenerationAttachmentMediaValidationIssues", () => {
  it("reports media assigned to fields unsupported by the selected model", () => {
    expect(
      hasGenerationAttachmentMediaValidationIssues(
        createModel([createFieldSpec("videos")]),
        {
          images: [
            new File(["1234"], "reference.png", {
              type: "image/png",
            }),
          ],
          videos: [],
          audios: [],
        },
      ),
    ).toBe(true);
  });

  it("reports audio attachments without an image or video attachment", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      hasGenerationAttachmentMediaValidationIssues(
        createModel([createFieldSpec("audios")]),
        {
          images: [],
          videos: [],
          audios: [audio],
        },
      ),
    ).toBe(true);
  });

  it("allows audio attachments with an image or video attachment", () => {
    const image = new File(["image"], "reference.png", { type: "image/png" });
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      hasGenerationAttachmentMediaValidationIssues(
        createModel([createFieldSpec("images"), createFieldSpec("audios")]),
        {
          images: [image],
          videos: [],
          audios: [audio],
        },
      ),
    ).toBe(false);
  });

  it("allows audio-only references for models without Seedance content rules", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      hasGenerationAttachmentMediaValidationIssues(
        createModel([createFieldSpec("audios")], []),
        {
          images: [],
          videos: [],
          audios: [audio],
        },
      ),
    ).toBe(false);
  });
});

describe("describeAttachmentMediaFileIssue", () => {
  it("formats whole-megabyte limits", () => {
    expect(
      describeAttachmentMediaFileIssue({
        kind: "fileTooLarge",
        maxBytes: 31457280,
      }),
    ).toBe("File is too large (max 30 MB).");
  });

  it("formats fractional-megabyte limits to one decimal", () => {
    expect(
      describeAttachmentMediaFileIssue({
        kind: "fileTooLarge",
        maxBytes: 1572864,
      }),
    ).toBe("File is too large (max 1.5 MB).");
  });

  it("describes unsupported model fields", () => {
    expect(describeAttachmentMediaFileIssue({ kind: "unsupportedField" })).toBe(
      "This model does not support this attachment type.",
    );
  });

  it("describes audio attachments without visual attachments", () => {
    expect(
      describeAttachmentMediaFileIssue({
        kind: "audioRequiresVisualAttachment",
      }),
    ).toBe("Audio attachments need an image or video attachment.");
  });
});

function createModel(
  fields: [AttachmentMediaFieldSpec, ...AttachmentMediaFieldSpec[]],
  validationRules: PublishedGenerationModelSummary["spec"]["validationRules"] = [
    "seedance20ContentRules",
  ],
): PublishedGenerationModelSummary {
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
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds: ["prompt"],
          advanced: false,
        },
      ],
      transforms: [{ kind: "seedanceContentArray" }],
      validationRules,
    },
  };
}

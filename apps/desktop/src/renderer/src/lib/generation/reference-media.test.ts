import type {
  MediaConstraints,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";
import { describe, expect, it } from "vitest";

import {
  describeReferenceMediaFileIssue,
  getReferenceMediaAccept,
  getReferenceMediaFieldIdForFile,
  hasGenerationReferenceMediaValidationIssues,
  matchesReferenceMediaField,
  validateReferenceMediaFile,
  validateReferenceMediaSelection,
  type ReferenceMediaFieldId,
  type ReferenceMediaFieldSpec,
} from "./reference-media.ts";

const imageConstraints: MediaConstraints = {
  mimeTypes: ["image/png", "image/heic"],
  extensions: [".png", ".heic"],
  maxFileSizeBytes: 10,
};

function createFieldSpec(
  id: ReferenceMediaFieldId,
  mediaConstraints?: MediaConstraints,
): ReferenceMediaFieldSpec {
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
    mediaConstraints,
    notes: [],
  };
}

describe("getReferenceMediaAccept", () => {
  it("joins mime types and extensions from constraints", () => {
    expect(
      getReferenceMediaAccept(createFieldSpec("images", imageConstraints)),
    ).toBe("image/png,image/heic,.png,.heic");
  });

  it("falls back to the per-kind wildcard without constraints", () => {
    expect(getReferenceMediaAccept(createFieldSpec("images"))).toBe("image/*");
    expect(getReferenceMediaAccept(createFieldSpec("videos"))).toBe("video/*");
    expect(getReferenceMediaAccept(createFieldSpec("audios"))).toBe("audio/*");
  });
});

describe("matchesReferenceMediaField", () => {
  it("matches by extension even when file.type is empty", () => {
    const heic = new File(["x"], "portrait.HEIC", { type: "" });

    expect(
      matchesReferenceMediaField(
        createFieldSpec("images", imageConstraints),
        heic,
      ),
    ).toBe(true);
  });

  it("matches by mime type", () => {
    const png = new File(["x"], "blob", { type: "image/png" });

    expect(
      matchesReferenceMediaField(
        createFieldSpec("images", imageConstraints),
        png,
      ),
    ).toBe(true);
  });

  it("rejects formats outside the constraints", () => {
    const svg = new File(["x"], "icon.svg", { type: "image/svg+xml" });

    expect(
      matchesReferenceMediaField(
        createFieldSpec("images", imageConstraints),
        svg,
      ),
    ).toBe(false);
  });

  it("falls back to mime-prefix matching without constraints", () => {
    const png = new File(["x"], "blob.png", { type: "image/png" });
    const mp4 = new File(["x"], "clip.mp4", { type: "video/mp4" });

    expect(matchesReferenceMediaField(createFieldSpec("images"), png)).toBe(
      true,
    );
    expect(matchesReferenceMediaField(createFieldSpec("images"), mp4)).toBe(
      false,
    );
  });
});

describe("getReferenceMediaFieldIdForFile", () => {
  const fieldSpecs = [
    createFieldSpec("images", imageConstraints),
    createFieldSpec("videos", {
      mimeTypes: ["video/mp4"],
      extensions: [".mp4"],
    }),
  ];

  it("routes a matching file to its field", () => {
    const heic = new File(["x"], "portrait.heic", { type: "" });

    expect(getReferenceMediaFieldIdForFile(heic, fieldSpecs)).toBe("images");
  });

  it("returns null for an unsupported format", () => {
    const txt = new File(["x"], "notes.txt", { type: "text/plain" });

    expect(getReferenceMediaFieldIdForFile(txt, fieldSpecs)).toBeNull();
  });

  it("falls back to mime prefix for fields without constraints", () => {
    const audio = new File(["x"], "voice.unknown", { type: "audio/mpeg" });

    expect(
      getReferenceMediaFieldIdForFile(audio, [createFieldSpec("audios")]),
    ).toBe("audios");
  });
});

describe("validateReferenceMediaFile", () => {
  it("reports oversize files", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["12345678901"], "big.png", { type: "image/png" });

    expect(validateReferenceMediaFile(fieldSpec, file)).toEqual([
      { kind: "fileTooLarge", maxBytes: 10 },
    ]);
  });

  it("returns no issues for a file within the size limit", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["1234"], "small.png", { type: "image/png" });

    expect(validateReferenceMediaFile(fieldSpec, file)).toEqual([]);
  });

  it("reports unsupported formats for files preserved after model changes", () => {
    const fieldSpec = createFieldSpec("images", imageConstraints);
    const file = new File(["1234"], "clip.mp4", { type: "video/mp4" });

    expect(validateReferenceMediaFile(fieldSpec, file)).toEqual([
      { kind: "unsupportedFormat" },
    ]);
  });

  it("returns no issues without constraints", () => {
    const file = new File(["1234"], "small.png", { type: "image/png" });

    expect(validateReferenceMediaFile(createFieldSpec("images"), file)).toEqual(
      [],
    );
  });
});

describe("validateReferenceMediaSelection", () => {
  it("reports audio references without an image or video reference", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      validateReferenceMediaSelection(
        "audios",
        {
          images: [],
          videos: [],
          audios: [audio],
        },
        createModel([createFieldSpec("audios")]),
      ),
    ).toEqual([{ kind: "audioRequiresVisualReference" }]);
  });

  it("allows audio references with an image or video reference", () => {
    const image = new File(["image"], "reference.png", { type: "image/png" });
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      validateReferenceMediaSelection(
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
      validateReferenceMediaSelection(
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

describe("hasGenerationReferenceMediaValidationIssues", () => {
  it("reports media assigned to fields unsupported by the selected model", () => {
    expect(
      hasGenerationReferenceMediaValidationIssues(
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

  it("reports audio references without an image or video reference", () => {
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      hasGenerationReferenceMediaValidationIssues(
        createModel([createFieldSpec("audios")]),
        {
          images: [],
          videos: [],
          audios: [audio],
        },
      ),
    ).toBe(true);
  });

  it("allows audio references with an image or video reference", () => {
    const image = new File(["image"], "reference.png", { type: "image/png" });
    const audio = new File(["audio"], "voice.mp3", { type: "audio/mpeg" });

    expect(
      hasGenerationReferenceMediaValidationIssues(
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
      hasGenerationReferenceMediaValidationIssues(
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

describe("describeReferenceMediaFileIssue", () => {
  it("formats whole-megabyte limits", () => {
    expect(
      describeReferenceMediaFileIssue({
        kind: "fileTooLarge",
        maxBytes: 31457280,
      }),
    ).toBe("File is too large (max 30 MB).");
  });

  it("formats fractional-megabyte limits to one decimal", () => {
    expect(
      describeReferenceMediaFileIssue({
        kind: "fileTooLarge",
        maxBytes: 1572864,
      }),
    ).toBe("File is too large (max 1.5 MB).");
  });

  it("describes unsupported model fields", () => {
    expect(describeReferenceMediaFileIssue({ kind: "unsupportedField" })).toBe(
      "This model does not support this reference type.",
    );
  });

  it("describes audio references without visual references", () => {
    expect(
      describeReferenceMediaFileIssue({
        kind: "audioRequiresVisualReference",
      }),
    ).toBe("Audio references need an image or video reference.");
  });
});

function createModel(
  fields: [ReferenceMediaFieldSpec, ...ReferenceMediaFieldSpec[]],
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

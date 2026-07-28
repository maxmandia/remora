import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { describe, expect, it } from "vitest";

import {
  createEmptyGenerationAttachmentMediaValue,
  type AttachmentMediaFieldSpec,
} from "./attachment-media.ts";
import {
  getGeneratedImageAttachmentRoleChoices,
  getGeneratedImageFileName,
  type GeneratedImageDescriptor,
} from "./generated-image.ts";

const image: GeneratedImageDescriptor = {
  jobId: "job_1",
  url: "https://assets.example/image.png",
  contentLength: 5,
  contentType: "image/png",
};

describe("getGeneratedImageAttachmentRoleChoices", () => {
  it("returns supported image roles in canonical order", () => {
    expect(
      getGeneratedImageAttachmentRoleChoices({
        image,
        selectedModel: createModel(),
        value: createEmptyGenerationAttachmentMediaValue(),
      }),
    ).toEqual([
      { role: "reference", disabled: false },
      { role: "firstFrame", disabled: false },
      { role: "lastFrame", disabled: false },
    ]);
  });

  it("disables conflicting, full, and incompatible roles", () => {
    const reference = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const value = createEmptyGenerationAttachmentMediaValue();

    value.images.push({ file: reference, role: "reference" });

    expect(
      getGeneratedImageAttachmentRoleChoices({
        image,
        selectedModel: createModel({ arrayMax: 2 }),
        value,
      }),
    ).toEqual([
      { role: "reference", disabled: false },
      { role: "firstFrame", disabled: true },
      { role: "lastFrame", disabled: true },
    ]);
    expect(
      getGeneratedImageAttachmentRoleChoices({
        image: { ...image, contentType: "image/jpeg" },
        selectedModel: createModel(),
        value: createEmptyGenerationAttachmentMediaValue(),
      }),
    ).toEqual([
      { role: "reference", disabled: true },
      { role: "firstFrame", disabled: true },
      { role: "lastFrame", disabled: true },
    ]);
  });

  it("omits roles when the model has no image attachment field", () => {
    expect(
      getGeneratedImageAttachmentRoleChoices({
        image,
        selectedModel: createModel({ fieldId: "videos" }),
        value: createEmptyGenerationAttachmentMediaValue(),
      }),
    ).toEqual([]);
  });
});

describe("getGeneratedImageFileName", () => {
  it("uses a stable content-type-derived extension", () => {
    expect(
      getGeneratedImageFileName({
        contentType: "image/webp",
        jobId: "job_1",
      }),
    ).toBe("remora-image-job_1.webp");
  });
});

function createModel({
  arrayMax = 3,
  fieldId = "images",
}: {
  arrayMax?: number;
  fieldId?: "images" | "videos";
} = {}): PublishedGenerationModelSummary {
  const field = {
    id: fieldId,
    label: "Media",
    componentKind: "mediaList",
    valueKind: "array",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    arrayMax,
    mediaRoleCapabilities:
      fieldId === "images"
        ? (["reference", "firstFrame", "lastFrame"] as const)
        : (["reference"] as const),
    mediaConstraints: {
      mimeTypes: [fieldId === "images" ? "image/png" : "video/mp4"],
      extensions: [fieldId === "images" ? ".png" : ".mp4"],
      maxFileSizeBytes: 100,
      maxTotalFileSizeBytes: 100,
    },
    notes: [],
  } satisfies AttachmentMediaFieldSpec;

  return {
    id: "model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Model",
    type: "video",
    latestSpecId: "model-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "model",
      provider: "byteplus",
      providerModelId: "model",
      displayName: "Model",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: { method: "POST", path: "/tasks" },
      modelParameter: { path: ["model"], source: "spec" },
      fields: [field],
      groups: [
        {
          id: "attachments",
          label: "Attachments",
          fieldIds: [field.id],
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

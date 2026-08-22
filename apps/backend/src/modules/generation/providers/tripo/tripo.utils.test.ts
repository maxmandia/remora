import { describe, expect, it } from "vitest";

import type { GenerationFieldSpec, Model3dModelSpec } from "../../../model/model.types.ts";
import type { CreateModel3dTaskInput } from "../../generation.types.ts";
import {
  buildTripoModel3dTaskRequest,
  normalizeTripoModel3dTaskResult,
  parseTripoCreateModel3dTaskResponse,
  validateTripoOutputUrl,
} from "./tripo.utils.ts";

describe("Tripo provider utilities", () => {
  it.each([
    {
      name: "H3.1 text with no texture",
      spec: createSpec("v3.1-20260211", "text"),
      input: createInput({
        prompt: "  A hand-painted ceramic fox  ",
        textureLevel: "none",
        faceLimit: 1_500_000,
        geometryQuality: "standard",
      }),
      expected: {
        model: "v3.1-20260211",
        prompt: "A hand-painted ceramic fox",
        texture: false,
        pbr: false,
        face_limit: 1_500_000,
        geometry_quality: "standard",
      },
    },
    {
      name: "H3.1 image with detailed geometry and texture",
      spec: createSpec("v3.1-20260211", "image"),
      input: createInput(
        {
          prompt: "",
          textureLevel: "detailed",
          faceLimit: 2_000_000,
          geometryQuality: "detailed",
        },
        [createImage()],
      ),
      expected: {
        model: "v3.1-20260211",
        input: "https://assets.example/reference.webp",
        texture: true,
        pbr: true,
        texture_quality: "detailed",
        face_limit: 2_000_000,
        geometry_quality: "detailed",
      },
    },
    {
      name: "P1 text with standard texture",
      spec: createSpec("P1-20260311", "text"),
      input: createInput({
        prompt: "A low-poly robot",
        textureLevel: "standard",
        faceLimit: 50,
        geometryQuality: null,
      }),
      expected: {
        model: "P1-20260311",
        prompt: "A low-poly robot",
        texture: true,
        pbr: true,
        texture_quality: "standard",
        face_limit: 50,
      },
    },
    {
      name: "P1 image with adaptive faces",
      spec: createSpec("P1-20260311", "image"),
      input: createInput(
        {
          prompt: "",
          textureLevel: "none",
          faceLimit: null,
          geometryQuality: null,
        },
        [createImage("image/png")],
      ),
      expected: {
        model: "P1-20260311",
        input: "https://assets.example/reference.webp",
        texture: false,
        pbr: false,
      },
    },
  ])("maps $name to the exact request", ({ spec, input, expected }) => {
    expect(buildTripoModel3dTaskRequest({ spec, input })).toEqual(expected);
  });

  it.each([
    ["v3.1-20260211", "standard", 1_500_001],
    ["v3.1-20260211", "detailed", 2_000_001],
    ["P1-20260311", null, 49],
    ["P1-20260311", null, 20_001],
  ] as const)(
    "rejects the %s/%s face-limit boundary at %s",
    (model, geometryQuality, faceLimit) => {
      expect(() =>
        buildTripoModel3dTaskRequest({
          spec: createSpec(model, "text"),
          input: createInput({
            prompt: "A model",
            textureLevel: "standard",
            faceLimit,
            geometryQuality,
          }),
        }),
      ).toThrow("face limit");
    },
  );

  it.each([
    { attachments: [], message: "exactly one" },
    { attachments: [createImage(), createImage()], message: "exactly one" },
    {
      attachments: [createImage("image/gif")],
      message: "JPEG, PNG, or WebP",
    },
    {
      attachments: [createImage("image/png", 20 * 1024 * 1024 + 1)],
      message: "20 MB",
    },
  ])("validates image-to-3D attachments", ({ attachments, message }) => {
    expect(() =>
      buildTripoModel3dTaskRequest({
        spec: createSpec("P1-20260311", "image"),
        input: createInput(
          {
            prompt: "",
            textureLevel: "standard",
            faceLimit: null,
            geometryQuality: null,
          },
          attachments,
        ),
      }),
    ).toThrow(message);
  });

  it("parses creation responses", () => {
    expect(
      parseTripoCreateModel3dTaskResponse(
        { code: 0, data: { task_id: "task-1" } },
        "v3.1-20260211",
      ),
    ).toEqual({
      provider: "tripo",
      providerTaskId: "task-1",
      providerModelId: "v3.1-20260211",
      pollingUrl: null,
    });
  });

  it.each([
    ["queued", "queued"],
    ["running", "running"],
    ["success", "succeeded"],
    ["failed", "failed"],
    ["cancelled", "cancelled"],
  ] as const)("normalizes %s tasks to %s", (providerStatus, status) => {
    expect(
      normalizeTripoModel3dTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "v3.1-20260211",
        value: createTaskResponse(providerStatus),
      }),
    ).toMatchObject({
      provider: "tripo",
      providerTaskId: "task-1",
      status,
      creditsConsumed: 30,
    });
  });

  it("extracts durable-import URLs and reported credits", () => {
    expect(
      normalizeTripoModel3dTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "v3.1-20260211",
        value: createTaskResponse("success"),
      }),
    ).toMatchObject({
      status: "succeeded",
      modelUrl: "https://assets.example/result.glb",
      renderedImageUrl: "https://assets.example/preview.png",
      creditsConsumed: 30,
      providerError: null,
    });
  });

  it("preserves provider failure details", () => {
    expect(
      normalizeTripoModel3dTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "P1-20260311",
        value: createTaskResponse("failed"),
      }),
    ).toMatchObject({
      status: "failed",
      providerError: { code: "1009", message: "Generation failed" },
    });
  });

  it.each([
    { code: 0, data: {} },
    { code: 0, data: { task_id: "wrong", status: "running" } },
    { code: 0, data: { task_id: "task-1", status: "unknown" } },
    {
      code: 0,
      data: { task_id: "task-1", status: "success", output: {} },
    },
  ])("rejects malformed or mismatched task responses", (value) => {
    expect(() =>
      normalizeTripoModel3dTaskResult({
        expectedProviderTaskId: "task-1",
        providerModelId: "v3.1-20260211",
        value,
      }),
    ).toThrow();
  });

  it.each([
    "http://assets.example/result.glb",
    "https://user:pass@assets.example/result.glb",
    "https://assets.example/result.glb#fragment",
    "not-a-url",
  ])("rejects unsafe output URL %s", (url) => {
    expect(() => validateTripoOutputUrl(url)).toThrow("URL was invalid");
  });
});

function createTaskResponse(status: string) {
  return {
    code: 0,
    data: {
      task_id: "task-1",
      status,
      credits_consumed: 30,
      error_code: 1009,
      error_message: "Generation failed",
      created_at: "2026-03-11T00:00:00.000Z",
      completed_at: "2026-03-11T00:01:00.000Z",
      output: {
        model_url: "https://assets.example/result.glb",
        rendered_image_url: "https://assets.example/preview.png",
      },
    },
  };
}

function createImage(contentType = "image/webp", contentLength = 1_024) {
  return {
    fieldId: "images" as const,
    role: "reference" as const,
    url: "https://assets.example/reference.webp",
    contentType,
    contentLength,
  };
}

function createInput(
  submittedInput: CreateModel3dTaskInput["submittedInput"],
  attachmentMedia: CreateModel3dTaskInput["attachmentMedia"] = [],
): CreateModel3dTaskInput {
  return {
    jobId: "job-1",
    modelId: "tripo-model",
    modelSpecId: "tripo-model-v1",
    submittedInput,
    attachmentMedia,
  };
}

function createSpec(
  providerModelId: "v3.1-20260211" | "P1-20260311",
  mode: "text" | "image",
): Model3dModelSpec {
  const field = (
    input: Partial<GenerationFieldSpec> &
      Pick<
        GenerationFieldSpec,
        "id" | "label" | "componentKind" | "valueKind"
      >,
  ): GenerationFieldSpec =>
    ({
      required: false,
      advanced: false,
      omitWhenEmpty: true,
      omitWhenDefault: false,
      notes: [],
      ...input,
    }) as GenerationFieldSpec;
  const fields: GenerationFieldSpec[] = [
    mode === "text"
      ? field({
          id: "prompt",
          label: "Prompt",
          componentKind: "promptTextarea",
          valueKind: "string",
          required: true,
          defaultValue: "",
          maxLength: 1_024,
        })
      : field({
          id: "images",
          label: "Reference image",
          componentKind: "mediaList",
          valueKind: "array",
          required: true,
          arrayMin: 1,
          arrayMax: 1,
          mediaConstraints: {
            mimeTypes: ["image/jpeg", "image/png", "image/webp"],
            extensions: [".jpeg", ".jpg", ".png", ".webp"],
            maxFileSizeBytes: 20 * 1024 * 1024,
          },
          mediaRoleCapabilities: ["reference"],
        }),
    field({
      id: "textureLevel",
      label: "Texture",
      componentKind: "select",
      valueKind: "string",
      defaultValue: "standard",
      options: [
        { label: "None", value: "none" },
        { label: "Standard", value: "standard" },
        { label: "Detailed", value: "detailed" },
      ],
    }),
    field({
      id: "faceLimit",
      label: "Face limit",
      componentKind: "numberInput",
      valueKind: "integer",
      defaultValue: null,
      min: providerModelId === "P1-20260311" ? 50 : 1,
      max: providerModelId === "P1-20260311" ? 20_000 : 2_000_000,
    }),
  ];
  if (providerModelId === "v3.1-20260211") {
    fields.push(
      field({
        id: "geometryQuality",
        label: "Geometry",
        componentKind: "select",
        valueKind: "string",
        defaultValue: "standard",
        options: [
          { label: "Standard", value: "standard" },
          { label: "Detailed", value: "detailed" },
        ],
      }),
    );
  }

  return {
    schemaVersion: 1,
    id: "tripo-model-v1",
    provider: "tripo",
    providerModelId,
    displayName: "Tripo",
    type: "model3d",
    status: "published",
    sourceUrls: [],
    endpoint: {
      method: "POST",
      path:
        mode === "text"
          ? "/generation/text-to-model"
          : "/generation/image-to-model",
    },
    modelParameter: { path: ["model"], source: "spec" },
    fields: fields as [GenerationFieldSpec, ...GenerationFieldSpec[]],
    groups: [
      {
        id: "input",
        label: "Input",
        fieldIds: fields.map((item) => item.id) as [string, ...string[]],
        advanced: false,
      },
    ],
    transforms: [],
    validationRules: [],
  };
}

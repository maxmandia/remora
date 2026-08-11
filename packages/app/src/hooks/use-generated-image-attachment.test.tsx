// @vitest-environment jsdom

import type { PublishedGenerationModelSummary } from "@remora/domain/generation-model/dto";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";

import {
  createEmptyGenerationAttachmentMediaValue,
  type AttachmentMediaFieldSpec,
  type GenerationAttachmentMediaValue,
} from "../lib/generation/attachment-media.ts";
import type { GeneratedImageDescriptor } from "../lib/generation/generated-image.ts";
import { useGeneratedImageAttachment } from "./use-generated-image-attachment.ts";

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => "toast_1"),
  success: vi.fn(),
}));

vi.mock("@remora/ui", () => ({
  toast: toastMocks,
}));

const image: GeneratedImageDescriptor = {
  jobId: "job_1",
  url: "https://assets.example/image.png",
  contentLength: 5,
  contentType: "image/png",
};

describe("useGeneratedImageAttachment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(["reference", "firstFrame"] as const)(
    "appends a generated image as %s without showing a toast",
    async (role) => {
      const loadFile = vi.fn(
        async () => new File(["image"], "generated.png", { type: "image/png" }),
      );
      const { result } = renderAttachmentHook({ loadFile });

      await act(() => result.current.attachment.addGeneratedImage(image, role));

      expect(loadFile).toHaveBeenCalledTimes(1);
      expect(result.current.value.images).toHaveLength(1);
      expect(result.current.value.images[0]).toMatchObject({
        role,
        file: { name: "generated.png", type: "image/png" },
      });
      expectNoToast();
    },
  );

  it("appends a generated image as a last frame without showing a toast", async () => {
    const loadFile = vi.fn(
      async () => new File(["image"], "generated.png", { type: "image/png" }),
    );
    const initialValue = createEmptyGenerationAttachmentMediaValue();
    initialValue.images.push({
      source: "local",
      file: new File(["first"], "first.png", { type: "image/png" }),
      role: "firstFrame",
    });
    const { result } = renderAttachmentHook({ initialValue, loadFile });

    await act(() =>
      result.current.attachment.addGeneratedImage(image, "lastFrame"),
    );

    expect(loadFile).toHaveBeenCalledTimes(1);
    expect(result.current.value.images).toHaveLength(2);
    expect(result.current.value.images[1]).toMatchObject({
      role: "lastFrame",
      file: { name: "generated.png", type: "image/png" },
    });
    expectNoToast();
  });

  it("deduplicates a pending job and role", async () => {
    let resolveFile!: (file: File) => void;
    const loadFile = vi.fn(
      () =>
        new Promise<File>((resolve) => {
          resolveFile = resolve;
        }),
    );
    const { result } = renderAttachmentHook({ loadFile });

    let first!: Promise<void>;

    act(() => {
      first = result.current.attachment.addGeneratedImage(image, "reference");
      void result.current.attachment.addGeneratedImage(image, "reference");
    });

    expect(loadFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFile(new File(["image"], "generated.png", { type: "image/png" }));
      await first;
    });
  });

  it("does not mutate the draft when the selected model changes while loading", async () => {
    let resolveFile!: (file: File) => void;
    const loadFile = () =>
      new Promise<File>((resolve) => {
        resolveFile = resolve;
      });
    const { result } = renderAttachmentHook({ loadFile });
    let pending!: Promise<void>;

    act(() => {
      pending = result.current.attachment.addGeneratedImage(image, "reference");
      result.current.setModel(null);
    });
    await act(async () => {
      resolveFile(new File(["image"], "generated.png", { type: "image/png" }));
      await pending;
    });

    expect(result.current.value.images).toEqual([]);
    expect(toastMocks.error).toHaveBeenCalled();
  });
});

function renderAttachmentHook({
  initialValue,
  loadFile,
}: {
  initialValue?: GenerationAttachmentMediaValue;
  loadFile: (image: GeneratedImageDescriptor) => Promise<File>;
}) {
  return renderHook(() => {
    const [model, setModel] = useState<PublishedGenerationModelSummary | null>(
      () => createModel(),
    );
    const [value, setValue] = useState<GenerationAttachmentMediaValue>(
      () => initialValue ?? createEmptyGenerationAttachmentMediaValue(),
    );
    const attachment = useGeneratedImageAttachment({
      loadFile,
      selectedModel: model,
      setValue,
      value,
    });

    return { attachment, setModel, value };
  });
}

function expectNoToast() {
  expect(toastMocks.dismiss).not.toHaveBeenCalled();
  expect(toastMocks.error).not.toHaveBeenCalled();
  expect(toastMocks.loading).not.toHaveBeenCalled();
  expect(toastMocks.success).not.toHaveBeenCalled();
}

function createModel(): PublishedGenerationModelSummary {
  const field = {
    id: "images",
    label: "Images",
    componentKind: "mediaList",
    valueKind: "array",
    required: false,
    advanced: false,
    omitWhenEmpty: true,
    omitWhenDefault: false,
    arrayMax: 3,
    mediaRoleCapabilities: ["reference", "firstFrame", "lastFrame"],
    mediaConstraints: {
      mimeTypes: ["image/png"],
      extensions: [".png"],
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

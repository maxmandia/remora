/** @vitest-environment jsdom */

import type { AttachmentMediaRole } from "@remora/domain/generation-attachment-media/dto";
import type {
  GenerationFieldSpec,
  PublishedGenerationModelSummary,
} from "@remora/domain/generation-model/dto";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AttachmentMediaFieldId,
  GenerationAttachmentMediaItem,
  GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { GenerationSettings } from "./generation-settings.tsx";

describe("GenerationSettings", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders settings in canonical order regardless of field order", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [
              { label: "5s", value: 5 },
              { label: "10s", value: 10 },
            ],
          }),
          createField({
            id: "resolution",
            label: "Resolution",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "720p",
            options: [
              { label: "480p", value: "480p" },
              { label: "720p", value: "720p" },
            ],
          }),
          createField({
            id: "aspectRatio",
            label: "Aspect ratio",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "16:9",
            options: [
              { label: "16:9", value: "16:9" },
              { label: "9:16", value: "9:16" },
            ],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    const triggerLabels = Array.from(
      container.querySelectorAll('[data-slot="select-trigger"]'),
      (trigger) => trigger.textContent?.replace("▼", ""),
    );

    expect(triggerLabels).toEqual(["1", "720p", "16:9", "5s", "On"]);
  });

  it("does not render hidden settings while leaving visible audio controls intact", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "resolution",
            label: "Resolution",
            componentKind: "hidden",
            valueKind: "string",
            defaultValue: "1080p",
            options: [{ label: "1080p", value: "1080p" }],
          }),
          createField({
            id: "generateAudio",
            label: "Sound",
            componentKind: "select",
            valueKind: "boolean",
            defaultValue: false,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "1080p",
          duration: 5,
          generateAudio: false,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.queryByText("1080p")).toBeNull();
    expect(screen.getByText("Off")).toBeTruthy();
    expect(
      container.querySelectorAll('[data-slot="select-trigger"]'),
    ).toHaveLength(2);
  });

  it("uses shared surface-aware ghost trigger styling", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    const triggers = Array.from(
      container.querySelectorAll<HTMLElement>('[data-slot="select-trigger"]'),
    );

    expect(triggers.length).toBeGreaterThan(0);

    for (const trigger of triggers) {
      expect(trigger.className).toContain(
        "hover:bg-[var(--surface-interactive-hover)]",
      );
      expect(trigger.className).toContain(
        "aria-expanded:bg-[var(--surface-interactive-active)]",
      );
      expect(trigger.className).not.toContain("primary-foreground/10");
    }
  });

  it("renders select popovers on the shared popover surface", async () => {
    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Requested generations",
      }),
    );

    const option = await screen.findByRole("option", { name: "1" });
    const content = document.querySelector<HTMLElement>(
      '[data-slot="select-content"]',
    );

    expect(content?.dataset.surface).toBe("popup");
    expect(content?.className).toContain("bg-popover");
    expect(option.className).toContain(
      "focus:bg-[var(--surface-interactive-hover)]",
    );
  });

  it("renders requested generation options and emits selected counts", async () => {
    const onValueChange = vi.fn();

    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("combobox", {
        name: "Requested generations",
      }),
    );

    const option = await screen.findByRole("option", { name: "15" });
    fireEvent.pointerDown(option);
    fireEvent.pointerUp(option);
    fireEvent.click(option);

    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith({
        modelType: "video",
        aspectRatio: "16:9",
        resolution: "720p",
        duration: 5,
        generateAudio: true,
        requestedGenerations: 15,
      });
    });
  });

  it("renders Seedance audio as a canonical boolean setting", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("On")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="select-trigger"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders Kling audio as the same canonical boolean setting", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "generateAudio",
            label: "Sound",
            componentKind: "select",
            valueKind: "boolean",
            defaultValue: false,
            providerPath: ["sound"],
            providerValueMap: [
              { canonicalValue: true, providerValue: "on" },
              { canonicalValue: false, providerValue: "off" },
            ],
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: false,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Off")).toBeTruthy();
    expect(
      container.querySelector('[data-slot="select-trigger"]'),
    ).not.toBeNull();
    const audioTrigger = screen
      .getByText("Off")
      .closest('[data-slot="select-trigger"]');

    expect(
      audioTrigger
        ?.querySelector('[data-slot="select-trigger-icon"] svg')
        ?.classList.contains("lucide-volume-off"),
    ).toBe(true);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("renders controlled values instead of local defaults", () => {
    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [
              { label: "5s", value: 5 },
              { label: "10s", value: 10 },
            ],
          }),
          createField({
            id: "generateAudio",
            label: "Generate audio",
            componentKind: "toggle",
            valueKind: "boolean",
            defaultValue: true,
            options: [
              { label: "On", value: true },
              { label: "Off", value: false },
            ],
          }),
          createField({
            id: "aspectRatio",
            label: "Aspect ratio",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "16:9",
            options: [
              { label: "16:9", value: "16:9" },
              { label: "9:16", value: "9:16" },
            ],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "9:16",
          resolution: "720p",
          duration: 10,
          generateAudio: false,
          requestedGenerations: 7,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByText("9:16")).toBeTruthy();
    expect(screen.getByText("10s")).toBeTruthy();
    expect(screen.getByText("Off")).toBeTruthy();
  });

  it.each(["images", "videos", "audios"] as const)(
    "renders the add reference button for %s media fields",
    (fieldId) => {
      render(
        <GenerationSettings
          attachmentMediaValue={createAttachmentMediaValue()}
          selectedModel={createModel([
            createField({
              id: fieldId,
              label: "Attachments",
              componentKind: "mediaList",
              valueKind: "array",
              defaultValue: [],
              arrayMax: 3,
              mediaRoleCapabilities: ["reference"],
            }),
          ])}
          value={{
            modelType: "video",
            aspectRatio: "16:9",
            resolution: "720p",
            duration: 5,
            generateAudio: true,
            requestedGenerations: 1,
          }}
          onAttachmentMediaValueChange={vi.fn()}
          onValueChange={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("button", { name: "Add attachment" }),
      ).toBeTruthy();
    },
  );

  it("derives accepted media types from supported attachment fields", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "images",
            label: "Images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
          createField({
            id: "videos",
            label: "Videos",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
          createField({
            id: "audios",
            label: "Audios",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    const input = getAttachmentFileInput(container);

    expect(input.accept).toBe("image/*,video/*,audio/*");
    expect(input.multiple).toBe(true);
  });

  it("classifies selected attachment files by MIME prefix", () => {
    const onAttachmentMediaValueChange = vi.fn();
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "reference.mp4", {
      type: "video/mp4",
    });
    const audioFile = new File(["audio"], "reference.mp3", {
      type: "audio/mpeg",
    });
    const textFile = new File(["text"], "notes.txt", { type: "text/plain" });
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "images",
            label: "Images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
          createField({
            id: "videos",
            label: "Videos",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
          createField({
            id: "audios",
            label: "Audios",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 3,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={onAttachmentMediaValueChange}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.change(getAttachmentFileInput(container), {
      target: { files: [videoFile, imageFile, textFile, audioFile] },
    });

    expect(onAttachmentMediaValueChange).toHaveBeenCalledWith({
      images: [item(imageFile)],
      videos: [item(videoFile)],
      audios: [item(audioFile)],
    });
  });

  it("respects remaining attachment media capacity", () => {
    const onAttachmentMediaValueChange = vi.fn();
    const existingImageFile = new File(["existing"], "existing.png", {
      type: "image/png",
    });
    const acceptedImageFile = new File(["accepted"], "accepted.png", {
      type: "image/png",
    });
    const ignoredImageFile = new File(["ignored"], "ignored.png", {
      type: "image/png",
    });
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue({
          images: [existingImageFile],
        })}
        selectedModel={createModel([
          createField({
            id: "images",
            label: "Images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 2,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={onAttachmentMediaValueChange}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.change(getAttachmentFileInput(container), {
      target: { files: [acceptedImageFile, ignoredImageFile] },
    });

    expect(onAttachmentMediaValueChange).toHaveBeenCalledWith({
      images: [item(existingImageFile), item(acceptedImageFile)],
      videos: [],
      audios: [],
    });
  });

  it("disables attachment media selection when capacity is exhausted", () => {
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue({
          images: [imageFile],
        })}
        selectedModel={createModel([
          createField({
            id: "images",
            label: "Images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 1,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", { name: "Add attachment" });

    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not render the add attachment button without attachment media fields", () => {
    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "duration",
            label: "Duration",
            componentKind: "select",
            valueKind: "integer",
            defaultValue: 5,
            options: [{ label: "5s", value: 5 }],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add attachment" })).toBeNull();
  });

  it("does not render the add attachment button when attachment capacity is zero", () => {
    render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createModel([
          createField({
            id: "images",
            label: "Images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 0,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "video",
          aspectRatio: "16:9",
          resolution: "720p",
          duration: 5,
          generateAudio: true,
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Add attachment" })).toBeNull();
  });

  it("renders image settings without video-only controls", () => {
    const { container } = render(
      <GenerationSettings
        attachmentMediaValue={createAttachmentMediaValue()}
        selectedModel={createImageModel([
          createField({
            id: "aspectRatio",
            label: "Aspect ratio",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "1:1",
            options: [{ label: "1:1", value: "1:1" }],
          }),
          createField({
            id: "resolution",
            label: "Resolution",
            componentKind: "select",
            valueKind: "string",
            defaultValue: "1K",
            options: [{ label: "1K", value: "1K" }],
          }),
          createField({
            id: "images",
            label: "Reference images",
            componentKind: "mediaList",
            valueKind: "array",
            defaultValue: [],
            arrayMax: 14,
            mediaRoleCapabilities: ["reference"],
          }),
        ])}
        value={{
          modelType: "image",
          aspectRatio: "1:1",
          resolution: "1K",
          requestedGenerations: 1,
        }}
        onAttachmentMediaValueChange={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );

    const triggerLabels = Array.from(
      container.querySelectorAll('[data-slot="select-trigger"]'),
      (trigger) => trigger.textContent?.replace("▼", ""),
    );

    expect(triggerLabels).toEqual(["1", "1K", "1:1"]);
    expect(screen.getByRole("button", { name: "Add attachment" })).toBeTruthy();
  });
});

function createAttachmentMediaValue(
  overrides: Partial<
    Record<AttachmentMediaFieldId, Array<File | GenerationAttachmentMediaItem>>
  > = {},
): GenerationAttachmentMediaValue {
  return {
    images: normalizeItems(overrides.images),
    videos: normalizeItems(overrides.videos),
    audios: normalizeItems(overrides.audios),
  };
}

function normalizeItems(
  entries: Array<File | GenerationAttachmentMediaItem> = [],
) {
  return entries.map((entry) =>
    entry instanceof File ? item(entry, "reference") : entry,
  );
}

function item(
  file: File,
  role: AttachmentMediaRole = "reference",
): GenerationAttachmentMediaItem {
  return { file, role };
}

function getAttachmentFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    '[data-slot="file-picker-input"]',
  );

  if (!input) {
    throw new Error("Expected attachment file input to be rendered.");
  }

  return input;
}

function createField(
  overrides: Partial<GenerationFieldSpec> = {},
): GenerationFieldSpec {
  return {
    id: "prompt",
    label: "Prompt",
    componentKind: "promptTextarea",
    valueKind: "string",
    required: false,
    advanced: false,
    defaultValue: "",
    omitWhenEmpty: true,
    omitWhenDefault: false,
    notes: [],
    ...overrides,
  } as GenerationFieldSpec;
}

function createModel(
  fields: [GenerationFieldSpec, ...GenerationFieldSpec[]],
): PublishedGenerationModelSummary {
  const fieldIds = fields.map((field) => field.id) as [
    GenerationFieldSpec["id"],
    ...GenerationFieldSpec["id"][],
  ];

  return {
    id: "test-model",
    providerId: "byteplus",
    providerName: "BytePlus",
    displayName: "Test Model",
    type: "video",
    latestSpecId: "test-model-v1",
    latestSpecVersion: 1,
    spec: {
      schemaVersion: 1,
      id: "test-model",
      provider: "byteplus",
      providerModelId: null,
      displayName: "Test Model",
      type: "video",
      status: "published",
      sourceUrls: [],
      endpoint: {
        method: "POST",
        path: "/test",
      },
      modelParameter: {
        path: ["model"],
        source: "runtime",
      },
      fields,
      groups: [
        {
          id: "output",
          label: "Output",
          fieldIds,
          advanced: false,
        },
      ],
      transforms: [],
      validationRules: [],
    },
  };
}

function createImageModel(
  fields: [GenerationFieldSpec, ...GenerationFieldSpec[]],
): PublishedGenerationModelSummary {
  const model = createModel(fields);

  return {
    ...model,
    id: "nano-banana-2",
    providerId: "google",
    providerName: "Google",
    displayName: "Nano Banana 2",
    type: "image",
    latestSpecId: "nano-banana-2-v1",
    spec: {
      ...model.spec,
      id: "nano-banana-2-v1",
      provider: "google",
      providerModelId: "gemini-3.1-flash-image",
      displayName: "Nano Banana 2",
      type: "image",
      transforms: [],
      validationRules: [],
    },
  };
}

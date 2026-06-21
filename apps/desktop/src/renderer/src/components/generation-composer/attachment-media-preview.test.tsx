/** @vitest-environment jsdom */

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AttachmentMediaRole,
  MediaConstraints,
  PublishedGenerationModelSummary,
} from "@remora/backend/types";

import {
  attachmentMediaFieldIds,
  type AttachmentMediaFieldId,
  type AttachmentMediaFieldSpec,
  type GenerationAttachmentMediaItem,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { AttachmentMediaPreview } from "./attachment-media-preview.tsx";

const heicToMock = vi.hoisted(() => vi.fn());

vi.mock("heic-to", () => ({
  heicTo: heicToMock,
}));

let originalCreateObjectURLDescriptor: PropertyDescriptor | undefined;
let originalRevokeObjectURLDescriptor: PropertyDescriptor | undefined;
let createObjectURLMock = vi.fn();
let revokeObjectURLMock = vi.fn();

describe("AttachmentMediaPreview", () => {
  beforeEach(() => {
    originalCreateObjectURLDescriptor = Object.getOwnPropertyDescriptor(
      URL,
      "createObjectURL",
    );
    originalRevokeObjectURLDescriptor = Object.getOwnPropertyDescriptor(
      URL,
      "revokeObjectURL",
    );
    let convertedObjectUrlIndex = 0;

    createObjectURLMock = vi.fn((object: Blob | MediaSource) => {
      if (object instanceof File) {
        return `blob:${object.name || "media"}`;
      }

      convertedObjectUrlIndex += 1;

      const objectType = object instanceof Blob ? object.type : "media";

      return `blob:${objectType || "media"}:${convertedObjectUrlIndex}`;
    });
    revokeObjectURLMock = vi.fn();
    heicToMock.mockReset();
    heicToMock.mockResolvedValue(
      new Blob(["converted"], { type: "image/jpeg" }),
    );

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURLMock,
    });
  });

  afterEach(() => {
    cleanup();
    restoreUrlProperty("createObjectURL", originalCreateObjectURLDescriptor);
    restoreUrlProperty("revokeObjectURL", originalRevokeObjectURLDescriptor);
    vi.restoreAllMocks();
  });

  it("renders nothing without selected attachment media", () => {
    const { container } = render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue()}
        onValueChange={vi.fn()}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("renders selected images, videos, and audios in a stable preview list", async () => {
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "motion.mp4", {
      type: "video/mp4",
    });
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({
          images: [imageFile],
          videos: [videoFile],
          audios: [audioFile],
        })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("list", { name: "Attachments preview" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(
        screen.getByRole("img", {
          name: "Attachment image: reference.png",
        }).tagName,
      ).toBe("IMG");
      expect(
        screen.getByLabelText("Attachment video: motion.mp4").tagName,
      ).toBe("VIDEO");
    });
    expect(
      screen.getByRole("img", { name: "Attachment audio: soundtrack.mp3" }),
    ).toBeTruthy();
  });

  it("creates and revokes object URLs for visual media", async () => {
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "motion.mp4", {
      type: "video/mp4",
    });
    const rendered = render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({
          images: [imageFile],
          videos: [videoFile],
        })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    });

    expect(createObjectURLMock).toHaveBeenCalledWith(imageFile);
    expect(createObjectURLMock).toHaveBeenCalledWith(videoFile);

    rendered.unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:reference.png");
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:motion.mp4");
  });

  it("shows a loading state while preparing a HEIC preview", async () => {
    const conversion = createDeferred<Blob>();
    const heicFile = new File(["heic"], "reference.heic", {
      type: "image/heic",
    });
    heicToMock.mockReturnValueOnce(conversion.promise);

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [heicFile] })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(heicToMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen
        .getByRole("img", { name: "Attachment image: reference.heic" })
        .getAttribute("data-slot"),
    ).toBe("skeleton");

    conversion.resolve(new Blob(["converted"], { type: "image/jpeg" }));

    await waitFor(() => {
      expect(
        screen
          .getByRole("img", { name: "Attachment image: reference.heic" })
          .getAttribute("src"),
      ).toBe("blob:image/jpeg:1");
    });
  });

  it("keeps the original HEIC file in attachment media state", () => {
    const onValueChange = vi.fn();
    const heicFile = new File(["heic"], "reference.heic", {
      type: "image/heic",
    });
    const pngFile = new File(["png"], "reference.png", { type: "image/png" });

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [heicFile, pngFile] })}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove attachment image: reference.png",
      }),
    );

    expect(onValueChange).toHaveBeenCalledWith({
      images: [item(heicFile)],
      videos: [],
      audios: [],
    });
  });

  it("revokes converted HEIC object URLs on unmount", async () => {
    const heicFile = new File(["heic"], "reference.heic", {
      type: "image/heic",
    });
    const rendered = render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [heicFile] })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen
          .getByRole("img", { name: "Attachment image: reference.heic" })
          .getAttribute("src"),
      ).toBe("blob:image/jpeg:1");
    });

    rendered.unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:image/jpeg:1");
  });

  it("ignores and revokes stale HEIC conversions after the image changes", async () => {
    const firstConversion = createDeferred<Blob>();
    const firstHeicFile = new File(["first"], "first.heic", {
      type: "image/heic",
    });
    const secondHeicFile = new File(["second"], "second.heic", {
      type: "image/heic",
    });

    heicToMock
      .mockReturnValueOnce(firstConversion.promise)
      .mockResolvedValueOnce(new Blob(["second"], { type: "image/jpeg" }));

    const rendered = render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [firstHeicFile] })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(heicToMock).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [secondHeicFile] })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      const secondPreview = screen.getByRole("img", {
        name: "Attachment image: second.heic",
      });

      expect(secondPreview.getAttribute("src")).toBe("blob:image/jpeg:1");
    });

    firstConversion.resolve(new Blob(["first"], { type: "image/jpeg" }));

    await waitFor(() => {
      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:image/jpeg:2");
    });
    expect(
      screen
        .getByRole("img", { name: "Attachment image: second.heic" })
        .getAttribute("src"),
    ).toBe("blob:image/jpeg:1");
  });

  it("shows an unavailable state when HEIC conversion fails", async () => {
    const heicFile = new File(["heic"], "broken.heic", {
      type: "image/heic",
    });
    heicToMock.mockRejectedValueOnce(new Error("Unable to decode HEIC."));

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [heicFile] })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "Attachment image: broken.heic" })
          .tagName,
      ).toBe("DIV");
    });
    expect(screen.queryByText("HEIC preview unavailable")).toBeNull();
  });

  it("removes only the selected media item", () => {
    const onValueChange = vi.fn();
    const firstImageFile = new File(["first"], "first.png", {
      type: "image/png",
    });
    const secondImageFile = new File(["second"], "second.png", {
      type: "image/png",
    });
    const videoFile = new File(["video"], "motion.mp4", {
      type: "video/mp4",
    });
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({
          images: [firstImageFile, secondImageFile],
          videos: [videoFile],
          audios: [audioFile],
        })}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove attachment image: second.png",
      }),
    );

    expect(onValueChange).toHaveBeenCalledWith({
      images: [item(firstImageFile)],
      videos: [item(videoFile)],
      audios: [item(audioFile)],
    });
  });

  it("labels first and last frame image tiles", async () => {
    const firstFrame = new File(["first"], "first.png", {
      type: "image/png",
    });
    const lastFrame = new File(["last"], "last.png", {
      type: "image/png",
    });

    render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({
          images: [
            item(firstFrame, "firstFrame"),
            item(lastFrame, "lastFrame"),
          ],
        })}
        onValueChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "First frame image: first.png" }),
      ).toBeTruthy();
      expect(
        screen.getByRole("img", { name: "Last frame image: last.png" }),
      ).toBeTruthy();
    });
    expect(screen.getByText("First")).toBeTruthy();
    expect(screen.getByText("Last")).toBeTruthy();
  });

  it("keeps the preview in a compact peeking strip with hover motion", () => {
    const imageFile = new File(["image"], "reference.png", {
      type: "image/png",
    });
    const { container } = render(
      <AttachmentMediaPreview
        selectedModel={null}
        value={createAttachmentMediaValue({ images: [imageFile] })}
        onValueChange={vi.fn()}
      />,
    );
    const preview = container.querySelector<HTMLElement>(
      '[data-slot="attachment-media-preview"]',
    );
    const scrollViewport = container.querySelector<HTMLElement>(
      '[data-slot="attachment-media-preview-scroll"]',
    );
    const item = container.querySelector<HTMLElement>(
      '[data-slot="attachment-media-preview-item"]',
    );
    const removeButton = screen.getByRole("button", {
      name: "Remove attachment image: reference.png",
    });

    expect(preview?.className).toContain("absolute");
    expect(preview?.className).toContain("top-0");
    expect(preview?.className).toContain("h-24");
    expect(preview?.className).toContain("-translate-y-16");
    expect(scrollViewport?.className).toContain("pt-2");
    expect(scrollViewport?.className).toContain("overflow-y-hidden");
    expect(scrollViewport?.className).toContain("pointer-events-none");
    expect(item?.className).toContain("size-20");
    expect(item?.className).toContain("pointer-events-auto");
    expect(item?.className).toContain("hover:-translate-y-2");
    expect(item?.className).toContain("motion-reduce:transition-none");
    expect(removeButton.className).toContain("opacity-0");
    expect(removeButton.className).toContain(
      "group-hover/attachment-media:opacity-100",
    );
  });

  it("flags files that violate a physical-property constraint", () => {
    const oversizeImage = new File(["image"], "huge.png", {
      type: "image/png",
    });
    Object.defineProperty(oversizeImage, "size", { value: 40_000_000 });

    render(
      <AttachmentMediaPreview
        selectedModel={createModel([
          createFieldSpec("images", {
            mimeTypes: ["image/png"],
            extensions: [".png"],
            maxFileSizeBytes: 31457280,
          }),
        ])}
        value={createAttachmentMediaValue({ images: [oversizeImage] })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "File is too large (max 30 MB).",
      }),
    ).toBeTruthy();
  });

  it("flags audio attachments without an image or video attachment", () => {
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });

    render(
      <AttachmentMediaPreview
        selectedModel={createModel(
          [
            createFieldSpec("audios", {
              mimeTypes: ["audio/mpeg"],
              extensions: [".mp3"],
            }),
          ],
          ["seedance20ContentRules"],
        )}
        value={createAttachmentMediaValue({ audios: [audioFile] })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Audio attachments need an image or video attachment.",
      }),
    ).toBeTruthy();
  });

  it("does not flag audio-only references for models without Seedance content rules", () => {
    const audioFile = new File(["audio"], "soundtrack.mp3", {
      type: "audio/mpeg",
    });
    const { container } = render(
      <AttachmentMediaPreview
        selectedModel={createModel([
          createFieldSpec("audios", {
            mimeTypes: ["audio/mpeg"],
            extensions: [".mp3"],
          }),
        ])}
        value={createAttachmentMediaValue({ audios: [audioFile] })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector('[data-slot="attachment-media-preview-warning"]'),
    ).toBeNull();
  });

  it("renders no warning for files within their constraints", () => {
    const image = new File(["1234"], "ok.png", { type: "image/png" });
    const { container } = render(
      <AttachmentMediaPreview
        selectedModel={createModel([
          createFieldSpec("images", {
            mimeTypes: ["image/png"],
            extensions: [".png"],
            maxFileSizeBytes: 1000,
          }),
        ])}
        value={createAttachmentMediaValue({ images: [image] })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      container.querySelector('[data-slot="attachment-media-preview-warning"]'),
    ).toBeNull();
  });
});

function createAttachmentMediaValue(
  overrides: Partial<
    Record<AttachmentMediaFieldId, Array<File | GenerationAttachmentMediaItem>>
  > = {},
): GenerationAttachmentMediaValue {
  return Object.fromEntries(
    attachmentMediaFieldIds.map((fieldId) => [
      fieldId,
      (overrides[fieldId] ?? []).map((entry) =>
        entry instanceof File ? item(entry) : entry,
      ),
    ]),
  ) as GenerationAttachmentMediaValue;
}

function item(
  file: File,
  role: AttachmentMediaRole = "reference",
): GenerationAttachmentMediaItem {
  return { file, role };
}

function createFieldSpec(
  id: AttachmentMediaFieldId,
  mediaConstraints: MediaConstraints,
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
    mediaRoleCapabilities: ["reference"],
    mediaConstraints,
    notes: [],
  };
}

function createModel(
  mediaFields: AttachmentMediaFieldSpec[],
  validationRules: PublishedGenerationModelSummary["spec"]["validationRules"] = [],
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
      endpoint: { method: "POST", path: "/v1/videos" },
      modelParameter: { path: ["model"], source: "spec" },
      fields: [
        {
          id: "prompt",
          label: "Prompt",
          componentKind: "promptTextarea",
          valueKind: "string",
          required: true,
          advanced: false,
          omitWhenEmpty: false,
          omitWhenDefault: false,
          notes: [],
        },
        ...mediaFields,
      ],
      groups: [
        { id: "main", label: "Main", fieldIds: ["prompt"], advanced: false },
      ],
      transforms: [],
      validationRules,
    },
  };
}

function restoreUrlProperty(
  name: "createObjectURL" | "revokeObjectURL",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(URL, name, descriptor);
    return;
  }

  delete (URL as unknown as Record<typeof name, unknown>)[name];
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

/** @vitest-environment jsdom */

import type {
  AttachmentMediaRole,
  MediaConstraints,
} from "@remora/backend/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  attachmentMediaFieldIds,
  type AttachmentMediaFieldId,
  type AttachmentMediaFieldSpec,
  type GenerationAttachmentMediaItem,
  type GenerationAttachmentMediaValue,
} from "../../lib/generation/attachment-media.ts";
import { AttachmentMediaButton } from "./attachment-media-button.tsx";

const imageConstraints: MediaConstraints = {
  mimeTypes: ["image/png", "image/heic"],
  extensions: [".png", ".heic"],
  maxFileSizeBytes: 10,
};

describe("AttachmentMediaButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("offers a reference dropdown when reference is the only supported role", async () => {
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[createFieldSpec("images", imageConstraints)]}
        value={createAttachmentMediaValue()}
        onValueChange={vi.fn()}
      />,
    );

    expect(getFileInputs(container)).toHaveLength(1);
    expect(getFileInput(container, "reference").accept).toBe(
      "image/png,image/heic,.png,.heic",
    );

    fireEvent.click(screen.getByRole("button", { name: "Add attachment" }));

    expect(
      await screen.findByRole("menuitem", { name: "Reference" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("menuitem", { name: "First frame" }),
    ).toBeNull();
  });

  it("gates out files whose format is not accepted", () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[createFieldSpec("images", imageConstraints)]}
        value={createAttachmentMediaValue()}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(getFileInput(container, "reference"), {
      target: {
        files: [new File(["x"], "icon.svg", { type: "image/svg+xml" })],
      },
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps a right-format reference file that exceeds the size limit", () => {
    const onValueChange = vi.fn();
    const oversizeImage = new File(["12345678901"], "big.png", {
      type: "image/png",
    });
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[createFieldSpec("images", imageConstraints)]}
        value={createAttachmentMediaValue()}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(getFileInput(container, "reference"), {
      target: { files: [oversizeImage] },
    });

    expect(onValueChange).toHaveBeenCalledWith({
      images: [{ file: oversizeImage, role: "reference" }],
      videos: [],
      audios: [],
    });
  });

  it("offers role pickers when reference and frame roles are available", () => {
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
          createFieldSpec("videos", undefined, ["reference"]),
          createFieldSpec("audios", undefined, ["reference"]),
        ]}
        value={createAttachmentMediaValue()}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      getFileInputs(container).map(
        (input) => input.dataset.attachmentMediaRole,
      ),
    ).toEqual(["reference", "firstFrame", "lastFrame"]);
    expect(getFileInput(container, "reference").accept).toBe(
      "image/png,image/heic,.png,.heic,video/*,audio/*",
    );
    expect(getFileInput(container, "reference").multiple).toBe(true);
    expect(getFileInput(container, "firstFrame").multiple).toBe(false);
  });

  it("uses the model picker hover surface for role menu items", async () => {
    render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
        ]}
        value={createAttachmentMediaValue()}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add attachment" }));

    const referenceItem = await screen.findByRole("menuitem", {
      name: "Reference",
    });
    const content = document.querySelector<HTMLElement>(
      '[data-slot="dropdown-menu-content"]',
    );

    expect(content?.dataset.surface).toBe("popup");
    expect(referenceItem.className).toContain(
      "focus:bg-[var(--surface-interactive-hover)]",
    );
  });

  it("disables frame roles after adding a reference", () => {
    const referenceImage = new File(["1"], "reference.png", {
      type: "image/png",
    });
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
        ]}
        value={createAttachmentMediaValue({
          images: [{ file: referenceImage, role: "reference" }],
        })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      getFileInputs(container).map(
        (input) => input.dataset.attachmentMediaRole,
      ),
    ).toEqual(["reference", "firstFrame", "lastFrame"]);
    expect(getFileInput(container, "reference").disabled).toBe(false);
    expect(getFileInput(container, "firstFrame").disabled).toBe(true);
    expect(getFileInput(container, "lastFrame").disabled).toBe(true);
  });

  it("adds the enabled missing frame after one frame has been selected", () => {
    const onValueChange = vi.fn();
    const firstFrame = new File(["1"], "first.png", { type: "image/png" });
    const lastFrame = new File(["2"], "last.png", { type: "image/png" });
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
        ]}
        value={createAttachmentMediaValue({
          images: [{ file: firstFrame, role: "firstFrame" }],
        })}
        onValueChange={onValueChange}
      />,
    );

    expect(
      getFileInputs(container).map(
        (input) => input.dataset.attachmentMediaRole,
      ),
    ).toEqual(["reference", "firstFrame", "lastFrame"]);
    expect(getFileInput(container, "reference").disabled).toBe(true);
    expect(getFileInput(container, "firstFrame").disabled).toBe(true);
    expect(getFileInput(container, "lastFrame").disabled).toBe(false);

    fireEvent.change(getFileInput(container, "lastFrame"), {
      target: { files: [lastFrame] },
    });

    expect(onValueChange).toHaveBeenCalledWith({
      images: [
        { file: firstFrame, role: "firstFrame" },
        { file: lastFrame, role: "lastFrame" },
      ],
      videos: [],
      audios: [],
    });
  });

  it("does not open a disabled role picker", async () => {
    const firstFrame = new File(["1"], "first.png", { type: "image/png" });
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
        ]}
        value={createAttachmentMediaValue({
          images: [{ file: firstFrame, role: "firstFrame" }],
        })}
        onValueChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add attachment" }));

    const firstFrameItem = await screen.findByRole("menuitem", {
      name: "First frame",
    });
    const lastFrameItem = screen.getByRole("menuitem", {
      name: "Last frame",
    });

    expect(
      firstFrameItem.matches("[aria-disabled='true'], [data-disabled]"),
    ).toBe(true);

    fireEvent.click(firstFrameItem);
    expect(inputClick).not.toHaveBeenCalled();

    fireEvent.click(lastFrameItem);
    expect(inputClick).toHaveBeenCalledTimes(1);
  });

  it("skips files beyond the field capacity", () => {
    const onValueChange = vi.fn();
    const first = new File(["1"], "first.png", { type: "image/png" });
    const second = new File(["2"], "second.png", { type: "image/png" });
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[
          { ...createFieldSpec("images", imageConstraints), arrayMax: 1 },
        ]}
        value={createAttachmentMediaValue()}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(getFileInput(container, "reference"), {
      target: { files: [first, second] },
    });

    expect(onValueChange).toHaveBeenCalledWith({
      images: [{ file: first, role: "reference" }],
      videos: [],
      audios: [],
    });
  });

  it("disables the picker after both frame roles are selected", () => {
    render(
      <AttachmentMediaButton
        fieldSpecs={[
          createFieldSpec("images", imageConstraints, [
            "firstFrame",
            "lastFrame",
            "reference",
          ]),
        ]}
        value={createAttachmentMediaValue({
          images: [
            item(
              new File(["1"], "first.png", { type: "image/png" }),
              "firstFrame",
            ),
            item(
              new File(["2"], "last.png", { type: "image/png" }),
              "lastFrame",
            ),
          ],
        })}
        onValueChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: "Add attachment" })
        .disabled,
    ).toBe(true);
  });
});

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

function createAttachmentMediaValue(
  overrides: Partial<
    Record<AttachmentMediaFieldId, Array<File | GenerationAttachmentMediaItem>>
  > = {},
): GenerationAttachmentMediaValue {
  return Object.fromEntries(
    attachmentMediaFieldIds.map((fieldId) => [
      fieldId,
      (overrides[fieldId] ?? []).map((entry) =>
        entry instanceof File ? item(entry, "reference") : entry,
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

function getFileInputs(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLInputElement>('input[type="file"]'),
  );
}

function getFileInput(container: HTMLElement, role: AttachmentMediaRole) {
  const input = container.querySelector<HTMLInputElement>(
    `input[type="file"][data-attachment-media-role="${role}"]`,
  );

  if (!input) {
    throw new Error(`Expected ${role} file input to be rendered.`);
  }

  return input;
}

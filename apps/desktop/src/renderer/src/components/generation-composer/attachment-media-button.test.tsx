/** @vitest-environment jsdom */

import type { MediaConstraints } from "@remora/backend/types";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type GenerationAttachmentMediaValue,
  type AttachmentMediaFieldId,
  type AttachmentMediaFieldSpec,
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

  it("derives the accept attribute from the field constraints", () => {
    const { container } = render(
      <AttachmentMediaButton
        fieldSpecs={[createFieldSpec("images", imageConstraints)]}
        value={createAttachmentMediaValue()}
        onValueChange={vi.fn()}
      />,
    );

    expect(getFileInput(container).accept).toBe(
      "image/png,image/heic,.png,.heic",
    );
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

    fireEvent.change(getFileInput(container), {
      target: {
        files: [new File(["x"], "icon.svg", { type: "image/svg+xml" })],
      },
    });

    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("keeps a right-format file that exceeds the size limit", () => {
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

    fireEvent.change(getFileInput(container), {
      target: { files: [oversizeImage] },
    });

    expect(onValueChange).toHaveBeenCalledWith({
      images: [oversizeImage],
      videos: [],
      audios: [],
    });
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

    fireEvent.change(getFileInput(container), {
      target: { files: [first, second] },
    });

    expect(onValueChange).toHaveBeenCalledWith({
      images: [first],
      videos: [],
      audios: [],
    });
  });

  it("disables the picker when every field is at capacity", () => {
    render(
      <AttachmentMediaButton
        fieldSpecs={[
          { ...createFieldSpec("images", imageConstraints), arrayMax: 1 },
        ]}
        value={createAttachmentMediaValue({
          images: [new File(["1"], "first.png", { type: "image/png" })],
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

function createAttachmentMediaValue(
  overrides: Partial<GenerationAttachmentMediaValue> = {},
): GenerationAttachmentMediaValue {
  return {
    images: [],
    videos: [],
    audios: [],
    ...overrides,
  };
}

function getFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>('input[type="file"]');

  if (!input) {
    throw new Error("Expected file input to be rendered.");
  }

  return input;
}

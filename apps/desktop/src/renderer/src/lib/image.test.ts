/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createHeicPreviewObjectUrl,
  getFileExtension,
  isHeicImageFile,
} from "./image.ts";

const heicToMock = vi.hoisted(() => vi.fn());

vi.mock("heic-to", () => ({
  heicTo: heicToMock,
}));

let originalCreateObjectURLDescriptor: PropertyDescriptor | undefined;
let createObjectURLMock = vi.fn();

describe("getFileExtension", () => {
  it("returns the lowercased, dot-prefixed extension", () => {
    expect(getFileExtension("Reference.PNG")).toBe(".png");
    expect(getFileExtension("archive.tar.gz")).toBe(".gz");
  });

  it("returns empty string when there is no real extension", () => {
    expect(getFileExtension("no-extension")).toBe("");
    expect(getFileExtension(".dotfile")).toBe("");
    expect(getFileExtension("trailing.")).toBe("");
  });
});

describe("isHeicImageFile", () => {
  it("detects HEIC and HEIF files by MIME type", () => {
    expect(
      isHeicImageFile(new File(["x"], "reference", { type: "image/heic" })),
    ).toBe(true);
    expect(
      isHeicImageFile(new File(["x"], "reference", { type: "image/heif" })),
    ).toBe(true);
  });

  it("detects HEIC and HEIF files by extension", () => {
    expect(isHeicImageFile(new File(["x"], "REFERENCE.HEIC"))).toBe(true);
    expect(isHeicImageFile(new File(["x"], "reference.heif"))).toBe(true);
  });

  it("rejects other image formats", () => {
    expect(
      isHeicImageFile(new File(["x"], "reference.png", { type: "image/png" })),
    ).toBe(false);
  });
});

describe("createHeicPreviewObjectUrl", () => {
  beforeEach(() => {
    originalCreateObjectURLDescriptor = Object.getOwnPropertyDescriptor(
      URL,
      "createObjectURL",
    );
    createObjectURLMock = vi.fn(() => "blob:image/jpeg:1");
    heicToMock.mockReset();
    heicToMock.mockResolvedValue(
      new Blob(["converted"], { type: "image/jpeg" }),
    );

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
  });

  afterEach(() => {
    if (originalCreateObjectURLDescriptor) {
      Object.defineProperty(
        URL,
        "createObjectURL",
        originalCreateObjectURLDescriptor,
      );
      return;
    }

    delete (URL as unknown as Record<"createObjectURL", unknown>)
      .createObjectURL;
  });

  it("converts HEIC images to JPEG object URLs", async () => {
    const heicFile = new File(["heic"], "reference.heic", {
      type: "image/heic",
    });

    await expect(createHeicPreviewObjectUrl(heicFile)).resolves.toBe(
      "blob:image/jpeg:1",
    );

    expect(heicToMock).toHaveBeenCalledWith({
      blob: heicFile,
      quality: 0.9,
      type: "image/jpeg",
    });
    expect(createObjectURLMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image/jpeg" }),
    );
  });

  it("converts HEIF images to JPEG object URLs", async () => {
    const heifFile = new File(["heif"], "reference.heif", {
      type: "image/heif",
    });

    await expect(createHeicPreviewObjectUrl(heifFile)).resolves.toBe(
      "blob:image/jpeg:1",
    );

    expect(heicToMock).toHaveBeenCalledWith(
      expect.objectContaining({ blob: heifFile }),
    );
  });

  it("rejects when conversion returns no blob", async () => {
    heicToMock.mockResolvedValueOnce(null);

    await expect(
      createHeicPreviewObjectUrl(new File(["heic"], "broken.heic")),
    ).rejects.toThrow("HEIC conversion returned no preview blob.");
  });
});

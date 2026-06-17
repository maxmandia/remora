/** @vitest-environment jsdom */

import { FilePickerButton } from "@remora/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("FilePickerButton", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens the hidden file input when clicked", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(
      <FilePickerButton onFilesSelect={vi.fn()}>Upload</FilePickerButton>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(inputClick).toHaveBeenCalledOnce();
  });

  it("emits selected files as an array", () => {
    const onFilesSelect = vi.fn();
    const file = new File(["frame"], "frame.png", { type: "image/png" });
    const { container } = render(
      <FilePickerButton
        accept="image/*"
        multiple
        onFilesSelect={onFilesSelect}
      >
        Upload
      </FilePickerButton>,
    );

    fireEvent.change(getFileInput(container), {
      target: { files: [file] },
    });

    expect(onFilesSelect).toHaveBeenCalledWith([file]);
    expect(getFileInput(container).accept).toBe("image/*");
    expect(getFileInput(container).multiple).toBe(true);
  });

  it("ignores canceled file selections", () => {
    const onFilesSelect = vi.fn();
    const { container } = render(
      <FilePickerButton onFilesSelect={onFilesSelect}>Upload</FilePickerButton>,
    );

    fireEvent.change(getFileInput(container), {
      target: { files: [] },
    });

    expect(onFilesSelect).not.toHaveBeenCalled();
  });

  it("clears the input so the same file can be selected again", () => {
    const onFilesSelect = vi.fn();
    const file = new File(["frame"], "frame.png", { type: "image/png" });
    const { container } = render(
      <FilePickerButton onFilesSelect={onFilesSelect}>Upload</FilePickerButton>,
    );
    const input = getFileInput(container);

    fireEvent.change(input, {
      target: { files: [file] },
    });
    fireEvent.change(input, {
      target: { files: [file] },
    });

    expect(onFilesSelect).toHaveBeenCalledTimes(2);
    expect(input.value).toBe("");
  });
});

function getFileInput(container: HTMLElement) {
  const input = container.querySelector<HTMLInputElement>(
    'input[type="file"]',
  );

  if (!input) {
    throw new Error("Expected file input to be rendered.");
  }

  return input;
}

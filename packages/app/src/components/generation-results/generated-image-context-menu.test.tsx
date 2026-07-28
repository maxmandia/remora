// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GeneratedImageContextMenu } from "./generated-image-context-menu.tsx";

const image = {
  jobId: "job_1",
  url: "https://assets.example/image.png",
  contentLength: 5,
  contentType: "image/png",
};

describe("GeneratedImageContextMenu", () => {
  it("opens on right click and invokes enabled role and download actions", async () => {
    const onAdd = vi.fn();
    const onDownload = vi.fn();

    render(
      <GeneratedImageContextMenu
        actions={{
          getRoleChoices: () => [
            { role: "reference", disabled: false },
            { role: "firstFrame", disabled: true },
          ],
          onAdd,
          onDownload,
        }}
        image={image}
      >
        <button type="button">Generated image</button>
      </GeneratedImageContextMenu>,
    );

    const trigger = screen.getByRole("button", { name: "Generated image" });

    expect(fireEvent.contextMenu(trigger, { clientX: 20, clientY: 30 })).toBe(
      false,
    );

    const reference = await screen.findByRole("menuitem", {
      name: "Use as reference",
    });
    const firstFrame = screen.getByRole("menuitem", {
      name: "Use as first frame",
    });

    expect(firstFrame.getAttribute("aria-disabled")).toBe("true");

    fireEvent.click(reference);
    expect(onAdd).toHaveBeenCalledWith(image, "reference");

    fireEvent.contextMenu(trigger);
    fireEvent.click(
      await screen.findByRole("menuitem", { name: "Download image" }),
    );
    expect(onDownload).toHaveBeenCalledWith(image);
  });
});

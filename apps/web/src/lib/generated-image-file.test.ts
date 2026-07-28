// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  downloadGeneratedImage,
  loadGeneratedImageFile,
} from "./generated-image-file";

const image = {
  jobId: "job_1",
  url: "https://assets.example/image.png",
  contentLength: 5,
  contentType: "image/png",
};

describe("generated image file delivery", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads an authenticated response as a named file", async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Headers({
        "content-disposition":
          'attachment; filename="remora-image-job_1.png"',
        "content-type": "image/png",
      }),
      blob: async () =>
        new Blob(["image-bytes"], {
          type: "image/png",
        }),
    }));

    vi.stubGlobal("fetch", fetch);

    const file = await loadGeneratedImageFile(image);

    expect(fetch).toHaveBeenCalledWith(
      "http://localhost:4000/api/generation/jobs/job_1/image-file",
      { credentials: "include" },
    );
    expect(file.name).toBe("remora-image-job_1.png");
    expect(file.type).toBe("image/png");
    expect(await file.text()).toBe("image-bytes");
  });

  it("opens the authenticated file route for download", () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadGeneratedImage(image);

    const anchor = click.mock.instances[0] as HTMLAnchorElement;

    expect(anchor.href).toBe(
      "http://localhost:4000/api/generation/jobs/job_1/image-file",
    );
    expect(anchor.target).toBe("_blank");
    expect(click).toHaveBeenCalled();
  });
});

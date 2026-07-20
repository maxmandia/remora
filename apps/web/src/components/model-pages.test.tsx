/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { publishedModelPages } from "../lib/seo/model-pages";
import { ModelPage } from "./model-page";
import { ModelsPage } from "./models-page";

const downloadUrl =
  "https://releases.remora.computer/stable/darwin/arm64/Remora-darwin-arm64.dmg";

describe("model pages", () => {
  afterEach(() => cleanup());

  it("lists published model variants with crawlable links", () => {
    const seedance = publishedModelPages.find(
      ({ slug }) => slug === "seedance-2-0-video",
    );
    expect(seedance).toBeDefined();
    const imageModel = {
      ...seedance!,
      slug: "example-image-pro",
      title: "Zeta Image Pro",
      description: "A distinct image model description.",
      family: "Example Image",
      variant: "Pro",
      modality: "image" as const,
    };
    const secondImageModel = {
      ...imageModel,
      slug: "alpha-image-standard",
      title: "Alpha Image Standard",
      description: "A second distinct image model description.",
      variant: "Standard",
    };

    render(<ModelsPage models={[imageModel, seedance!, secondImageModel]} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Generative media models",
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: /Seedance 2.0 Video/ })
        .getAttribute("href"),
    ).toBe("/models/seedance-2-0-video");
    expect(
      screen.getByRole("link", { name: /Zeta Image Pro/ }).getAttribute("href"),
    ).toBe("/models/example-image-pro");
    expect(
      screen.getByRole("heading", { level: 2, name: "Image models" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: "Video models" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "text-to-image" }).getAttribute("href"),
    ).toBe("https://artificialanalysis.ai/image/leaderboard/text-to-image");
    expect(
      screen.getByRole("link", { name: "text-to-video" }).getAttribute("href"),
    ).toBe("https://artificialanalysis.ai/video/leaderboard/text-to-video");
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Alpha Image Standard", "Zeta Image Pro", "Seedance 2.0 Video"]);
    expect(screen.getByRole("link", { name: "Image models 2" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Video models 1" })).toBeTruthy();
  });

  it("renders unique facts, authored content, sources, and both macOS CTAs", () => {
    const metadata = publishedModelPages.find(
      ({ slug }) => slug === "seedance-2-0-video",
    );
    expect(metadata).toBeDefined();

    render(
      <ModelPage
        metadata={metadata!}
        downloadUrl={downloadUrl}
        Content={() => (
          <section>
            <h2>A reference-driven video model</h2>
            <p>Unique authored model content.</p>
          </section>
        )}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Seedance 2.0 Video" }),
    ).toBeTruthy();
    expect(screen.getByText("480p, 720p, 1080p, or 4K")).toBeTruthy();
    expect(screen.getByText("Unique authored model content.")).toBeTruthy();
    expect(
      screen.getByRole("link", {
        name: "BytePlus ModelArk: Seedance video generation",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Create with Remora on macOS",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Bring image and video generation into one focused desktop workspace.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Create generative media with Remora",
      }),
    ).toBeTruthy();

    const downloads = screen.getAllByRole("link", {
      name: "Download for macOS",
    });
    expect(downloads).toHaveLength(2);
    for (const download of downloads) {
      expect(download.getAttribute("href")).toBe(downloadUrl);
      expect(download.getAttribute("download")).toBe("Remora-darwin-arm64.dmg");
    }

    const compactCtaHeading = screen.getByRole("heading", {
      level: 2,
      name: "Create with Remora on macOS",
    });
    const keyFactsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Key facts",
    });
    const authoredHeading = screen.getByRole("heading", {
      level: 2,
      name: "A reference-driven video model",
    });
    const fullCtaHeading = screen.getByRole("heading", {
      level: 2,
      name: "Create generative media with Remora",
    });

    expect(
      compactCtaHeading.compareDocumentPosition(keyFactsHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      compactCtaHeading.compareDocumentPosition(authoredHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      authoredHeading.compareDocumentPosition(fullCtaHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    expect(screen.queryByText(/available (?:in|through) Remora/i)).toBeNull();
  });
});

/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GenerationModel3dViewerModal } from "./generation-model3d-viewer-modal.tsx";

const { webglState } = vi.hoisted(() => ({
  webglState: { shouldFail: true },
}));

vi.mock("../../providers/hotkeys-provider.tsx", () => ({
  useHotkey: vi.fn(),
}));

vi.mock("three", () => {
  class Scene {
    add() {}
    remove() {}
  }

  class WebGLRenderer {
    domElement = document.createElement("canvas");
    renderLists = { dispose() {} };

    constructor() {
      if (webglState.shouldFail) {
        throw new Error("WebGL unavailable");
      }
    }

    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
    forceContextLoss() {}
  }

  class Vector3 {
    set() {
      return this;
    }

    copy() {
      return this;
    }

    addScaledVector() {
      return this;
    }

    normalize() {
      return this;
    }
  }

  class Box3 {
    isEmpty() {
      return true;
    }

    setFromObject() {
      return this;
    }

    getCenter() {
      return new Vector3();
    }

    getSize() {
      return new Vector3();
    }
  }

  class PerspectiveCamera {
    aspect = 1;
    fov = 42;
    near = 0.01;
    far = 10_000;
    position = new Vector3();

    updateProjectionMatrix() {}
  }

  class DirectionalLight {
    position = new Vector3();
  }

  return {
    Box3,
    DirectionalLight,
    HemisphereLight: class {},
    MathUtils: {
      degToRad: (degrees: number) => (degrees * Math.PI) / 180,
    },
    Mesh: class {},
    PerspectiveCamera,
    Scene,
    SRGBColorSpace: "srgb",
    Vector3,
    WebGLRenderer,
  };
});

vi.mock("three/addons/loaders/GLTFLoader.js", () => ({
  GLTFLoader: class {
    load() {}
  },
}));

vi.mock("three/addons/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    target = { set() {}, copy() {} };
    update() {}
    dispose() {}
  },
}));

describe("GenerationModel3dViewerModal", () => {
  afterEach(() => {
    webglState.shouldFail = true;
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps the durable download available when WebGL cannot initialize", async () => {
    render(
      <GenerationModel3dViewerModal
        downloadUrl="/api/generation/jobs/job_1/model3d-file"
        modelUrl="https://assets.example/model.glb"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "could not be loaded",
      );
    });

    const download = screen.getByRole("link", { name: "Download GLB" });
    expect(download.getAttribute("href")).toBe(
      "/api/generation/jobs/job_1/model3d-file",
    );
    expect(download.hasAttribute("download")).toBe(true);
    expect(screen.getByRole("dialog").className).toContain("bg-transparent");
    expect(screen.getByRole("alert").className).toContain(
      "bg-[var(--remora-stage-background,var(--background))]",
    );
  });

  it("sizes the WebGL canvas to the viewer viewport", async () => {
    webglState.shouldFail = false;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );

    render(
      <GenerationModel3dViewerModal
        downloadUrl="/api/generation/jobs/job_1/model3d-file"
        modelUrl="https://assets.example/model.glb"
        onClose={vi.fn()}
      />,
    );

    const canvas = await waitFor(() => {
      const element = document.querySelector("canvas");
      expect(element).not.toBeNull();
      return element!;
    });

    expect(canvas.className).toContain("absolute");
    expect(canvas.className).toContain("inset-0");
    expect(canvas.className).toContain("size-full");
  });
});

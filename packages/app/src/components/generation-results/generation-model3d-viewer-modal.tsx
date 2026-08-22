import { DownloadIcon, LoaderCircleIcon, XIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Box3,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
  type Texture,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

import { Button } from "@remora/ui";
import { useHotkey } from "../../providers/hotkeys-provider.tsx";

export type GenerationModel3dViewerModalProps = {
  downloadUrl: string;
  modelUrl: string;
  onClose: () => void;
};

export function GenerationModel3dViewerModal({
  downloadUrl,
  modelUrl,
  onClose,
}: GenerationModel3dViewerModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useHotkey("generation.closeMediaViewer", {
    allowInEditable: true,
    onKeyDown: onClose,
  });

  useLayoutEffect(() => {
    dialogRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    setStatus("loading");
    let disposed = false;
    let animationFrame = 0;
    let loadedScene: Object3D | null = null;
    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.01, 10_000);
    let renderer: WebGLRenderer;

    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setStatus("error");
      return;
    }

    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "absolute inset-0 block size-full";
    viewport.append(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.screenSpacePanning = true;

    scene.add(new HemisphereLight(0xffffff, 0x3a4050, 2.2));
    const keyLight = new DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(4, 6, 5);
    scene.add(keyLight);
    const fillLight = new DirectionalLight(0x9ab7ff, 1.4);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);

    const resize = () => {
      const width = Math.max(viewport.clientWidth, 1);
      const height = Math.max(viewport.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    resize();

    const render = () => {
      if (disposed) {
        return;
      }
      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    render();

    new GLTFLoader().load(
      modelUrl,
      (gltf) => {
        if (disposed) {
          disposeObject(gltf.scene);
          return;
        }
        loadedScene = gltf.scene;
        scene.add(gltf.scene);
        resize();
        frameObject(camera, controls, gltf.scene);
        setStatus("ready");
      },
      undefined,
      () => {
        if (!disposed) {
          setStatus("error");
        }
      },
    );

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      if (loadedScene) {
        scene.remove(loadedScene);
        disposeObject(loadedScene);
      }
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [modelUrl]);

  return createPortal(
    <div
      ref={dialogRef}
      aria-label="Generated 3D model viewer"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-transparent outline-none"
      data-slot="generation-model3d-viewer-modal"
      role="dialog"
      tabIndex={-1}
    >
      <Button
        aria-label="Close generated 3D model"
        className="absolute inset-0 border-0 bg-transparent p-0"
        onClick={onClose}
        type="button"
      />
      <div className="relative z-[1] h-[min(82vh,56rem)] w-[min(92vw,72rem)] overflow-hidden rounded-xl bg-[var(--remora-stage-background,var(--background))] ring-1 ring-white/15">
        <div
          ref={viewportRef}
          className="relative size-full bg-[var(--remora-stage-background,var(--background))]"
        />
        {status !== "ready" ? (
          <div
            className="pointer-events-none absolute inset-0 grid place-items-center bg-[var(--remora-stage-background,var(--background))] text-sm text-white/75"
            role={status === "error" ? "alert" : "status"}
          >
            {status === "loading" ? (
              <span className="flex items-center gap-2">
                <LoaderCircleIcon className="size-4 animate-spin" />
                Loading 3D model…
              </span>
            ) : (
              <span>The 3D preview could not be loaded.</span>
            )}
          </div>
        ) : null}
        <div className="absolute top-4 right-4 z-[2] flex gap-2">
          <a
            className="bg-surface-strong text-foreground inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm"
            download
            href={downloadUrl}
          >
            <DownloadIcon className="size-4" />
            Download GLB
          </a>
          <button
            aria-label="Close generated 3D model"
            className="bg-surface-strong text-foreground cursor:pointer grid size-9 place-items-center rounded-md border-0 p-0"
            type="button"
            onClick={onClose}
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function frameObject(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  object: Object3D,
) {
  object.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    camera.position.set(0, 0, 3);
    controls.target.set(0, 0, 0);
    controls.update();
    return;
  }

  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const verticalFov = MathUtils.degToRad(camera.fov);
  const fitHeight = size.y / (2 * Math.tan(verticalFov / 2));
  const fitWidth = size.x / (2 * Math.tan(verticalFov / 2) * camera.aspect);
  const maxDimension = Math.max(size.x, size.y, size.z, 0.01);
  const distance =
    Math.max(
      maxDimension / (2 * Math.tan(verticalFov / 2)),
      fitHeight,
      fitWidth,
    ) * 1.45;
  const direction = new Vector3(1, 0.65, 1).normalize();

  camera.position.copy(center).addScaledVector(direction, distance);
  camera.near = Math.max(distance / 1_000, 0.001);
  camera.far = Math.max(distance * 100, 100);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.maxDistance = distance * 10;
  controls.minDistance = distance * 0.05;
  controls.update();
}

function disposeObject(object: Object3D) {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    child.geometry.dispose();
    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    for (const material of materials) {
      disposeMaterial(material);
    }
  });
}

function disposeMaterial(material: Material) {
  for (const value of Object.values(material)) {
    if (isTexture(value)) {
      value.dispose();
    }
  }
  material.dispose();
}

function isTexture(value: unknown): value is Texture {
  return Boolean(
    value &&
    typeof value === "object" &&
    "isTexture" in value &&
    value.isTexture === true,
  );
}

import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Matrix3,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector3,
  VideoTexture,
  WebGLRenderer,
  type Material,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export type ExploreCrtRuntime = {
  dispose: () => void;
  setReducedMotion: (reducedMotion: boolean) => void;
  setVideoSource: (source: string) => void;
};

export type ExploreCrtRuntimeOptions = {
  canvas: HTMLCanvasElement;
  modelUrl: string;
  onError: () => void;
  onReady: () => void;
  reducedMotion: boolean;
  videoUrl: string;
};

export function createExploreCrtRuntime({
  canvas,
  modelUrl,
  onError,
  onReady,
  reducedMotion: initialReducedMotion,
  videoUrl,
}: ExploreCrtRuntimeOptions): ExploreCrtRuntime {
  const renderer = new WebGLRenderer({
    alpha: true,
    antialias: true,
    canvas,
    powerPreference: "high-performance",
  });
  const scene = new Scene();
  const video = document.createElement("video");
  const videoTexture = new VideoTexture(video);
  let animationFrame: number | null = null;
  let camera: OrthographicCamera | null = null;
  let disposed = false;
  let isIntersecting = true;
  let model: Object3D | null = null;
  let readyNotified = false;
  let reducedMotion = initialReducedMotion;
  let videoFrame: number | null = null;
  let videoReady = false;

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  video.crossOrigin = "anonymous";
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  videoTexture.colorSpace = SRGBColorSpace;
  videoTexture.flipY = true;

  function cancelRenderLoop() {
    if (animationFrame !== null) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }

    if (
      videoFrame !== null &&
      typeof video.cancelVideoFrameCallback === "function"
    ) {
      video.cancelVideoFrameCallback(videoFrame);
      videoFrame = null;
    }
  }

  function render() {
    if (!disposed && camera) {
      renderer.render(scene, camera);
    }
  }

  function scheduleRender() {
    if (
      disposed ||
      reducedMotion ||
      document.hidden ||
      !isIntersecting ||
      video.paused
    ) {
      return;
    }

    if (typeof video.requestVideoFrameCallback === "function") {
      if (videoFrame !== null) {
        return;
      }

      videoFrame = video.requestVideoFrameCallback(() => {
        videoFrame = null;
        render();
        scheduleRender();
      });
      return;
    }

    if (animationFrame === null) {
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        render();
        scheduleRender();
      });
    }
  }

  function updatePlayback() {
    const shouldPlay =
      !disposed &&
      !reducedMotion &&
      !document.hidden &&
      isIntersecting &&
      model !== null;

    if (!shouldPlay) {
      video.pause();
      cancelRenderLoop();
      render();
      return;
    }

    void video.play().then(scheduleRender).catch(render);
  }

  function resize() {
    const { height, width } = canvas.getBoundingClientRect();

    if (height <= 0 || width <= 0) {
      return;
    }

    renderer.setSize(width, height, false);

    if (camera && model) {
      const screen = findScreenMesh(model);

      if (screen) {
        configureExploreCrtCamera(camera, model, screen, width / height);
      }
    }

    render();
  }

  function setVideoSource(source: string) {
    if (video.getAttribute("src") === source) {
      video.currentTime = 0;
      updatePlayback();
      return;
    }

    cancelRenderLoop();
    video.src = source;
    video.load();
    updatePlayback();
  }

  function setReducedMotion(nextReducedMotion: boolean) {
    reducedMotion = nextReducedMotion;
    updatePlayback();
  }

  const resizeObserver = new ResizeObserver(resize);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    isIntersecting = entry?.isIntersecting ?? false;
    updatePlayback();
  });

  // Readiness waits for the first decoded video frame in addition to the
  // model so the reveal never shows the shell with an empty screen.
  function notifyReady() {
    if (readyNotified || !model || !videoReady) {
      return;
    }

    readyNotified = true;
    onReady();
  }

  function handleLoadedData() {
    videoReady = true;
    render();
    updatePlayback();
    notifyReady();
  }

  function handleVideoError() {
    if (!disposed) {
      onError();
    }
  }

  function handlePlay() {
    scheduleRender();
  }

  function handleVisibilityChange() {
    updatePlayback();
  }

  video.addEventListener("error", handleVideoError);
  video.addEventListener("loadeddata", handleLoadedData);
  video.addEventListener("play", handlePlay);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  resizeObserver.observe(canvas);
  intersectionObserver.observe(canvas);
  setVideoSource(videoUrl);
  resize();

  const modelLoader = new GLTFLoader();

  modelLoader.setMeshoptDecoder(MeshoptDecoder);

  void modelLoader
    .loadAsync(modelUrl)
    .then((gltf) => {
      if (disposed) {
        disposeExploreCrtModel(gltf.scene);
        return;
      }

      model = gltf.scene;

      model.updateMatrixWorld(true);

      const screen = findScreenMesh(model);

      if (!screen) {
        throw new Error("The CRT model does not expose a screen mesh.");
      }

      screen.material = createExploreCrtScreenMaterial(
        screen.material,
        videoTexture,
      );
      scene.add(model);

      camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, 100);
      configureExploreCrtCamera(
        camera,
        model,
        screen,
        canvas.clientWidth / Math.max(canvas.clientHeight, 1),
      );
      addExploreCrtLighting(scene, camera, model);
      resize();
      render();
      updatePlayback();
      notifyReady();
    })
    .catch(() => {
      if (!disposed) {
        onError();
      }
    });

  return {
    dispose() {
      disposed = true;
      cancelRenderLoop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      video.removeEventListener("error", handleVideoError);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("play", handlePlay);
      video.pause();
      video.removeAttribute("src");
      video.load();
      videoTexture.dispose();

      if (model) {
        disposeExploreCrtModel(model);
      }

      renderer.dispose();
      renderer.forceContextLoss();
    },
    setReducedMotion,
    setVideoSource,
  };
}

function configureExploreCrtCamera(
  camera: OrthographicCamera,
  model: Object3D,
  screen: Mesh,
  aspectRatio: number,
) {
  model.updateMatrixWorld(true);

  const modelBounds = getVisibleModelBounds(model);
  const modelCenter = modelBounds.getCenter(new Vector3());
  const front = getScreenFront(screen);

  camera.up.set(0, 1, 0);
  camera.position.copy(modelCenter).addScaledVector(front, 4);
  camera.lookAt(modelCenter);
  camera.updateMatrixWorld(true);

  const projectedCorners = getProjectedBoundsCorners(
    modelBounds,
    camera.matrixWorldInverse,
  );
  const minX = Math.min(...projectedCorners.map((corner) => corner.x));
  const maxX = Math.max(...projectedCorners.map((corner) => corner.x));
  const minY = Math.min(...projectedCorners.map((corner) => corner.y));
  const maxY = Math.max(...projectedCorners.map((corner) => corner.y));
  const projectedWidth = maxX - minX;
  const projectedHeight = maxY - minY;
  const paddedWidth = Math.max(projectedWidth, projectedHeight * aspectRatio);
  const paddedHeight = paddedWidth / aspectRatio;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const padding = 1.06;

  camera.left = centerX - (paddedWidth * padding) / 2;
  camera.right = centerX + (paddedWidth * padding) / 2;
  camera.bottom = centerY - (paddedHeight * padding) / 2;
  camera.top = centerY + (paddedHeight * padding) / 2;
  camera.updateProjectionMatrix();
}

function addExploreCrtLighting(
  scene: Scene,
  camera: OrthographicCamera,
  model: Object3D,
) {
  const modelCenter = getVisibleModelBounds(model).getCenter(new Vector3());
  const cameraRight = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const lightTarget = new Object3D();
  const keyLight = new DirectionalLight(0xfff4e8, 4.1);
  const fillLight = new DirectionalLight(0xd7e8ff, 2);
  const rimLight = new DirectionalLight(0xffffff, 1.2);

  lightTarget.position.copy(modelCenter);
  keyLight.target = lightTarget;
  fillLight.target = lightTarget;
  rimLight.target = lightTarget;
  keyLight.position
    .copy(camera.position)
    .addScaledVector(cameraRight, -1.5)
    .add(new Vector3(0, 1.8, 0));
  fillLight.position
    .copy(camera.position)
    .addScaledVector(cameraRight, 2)
    .add(new Vector3(0, -0.6, 0));
  rimLight.position.copy(modelCenter).add(new Vector3(0, 1.5, 2));

  scene.add(
    new HemisphereLight(0xffffff, 0x352f2c, 2.2),
    lightTarget,
    keyLight,
    fillLight,
    rimLight,
  );
}

function createExploreCrtScreenMaterial(
  originalMaterial: Material | Material[],
  videoTexture: VideoTexture,
) {
  const original = Array.isArray(originalMaterial)
    ? originalMaterial[0]
    : originalMaterial;
  const originalScreenMaterial =
    original instanceof MeshStandardMaterial ? original : null;

  return new MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.8,
    emissiveMap: videoTexture,
    map: videoTexture,
    metalness: 0,
    normalMap: originalScreenMaterial?.normalMap ?? null,
    normalScale: originalScreenMaterial?.normalScale,
    roughness: 0.22,
  });
}

function findScreenMesh(model: Object3D): Mesh | null {
  let screen: Mesh | null = null;

  model.traverse((object) => {
    if (
      !screen &&
      object instanceof Mesh &&
      (object.name === "Screen" || object.parent?.name === "Screen")
    ) {
      screen = object;
    }
  });

  return screen;
}

function getScreenFront(screen: Mesh) {
  const normals = screen.geometry.getAttribute("normal");
  const normalMatrix = new Matrix3().getNormalMatrix(screen.matrixWorld);
  const front = new Vector3();

  for (let index = 0; index < normals.count; index += 1) {
    front.add(
      new Vector3()
        .fromBufferAttribute(normals, index)
        .applyMatrix3(normalMatrix)
        .normalize(),
    );
  }

  return front.normalize();
}

function getVisibleModelBounds(model: Object3D) {
  const bounds = new Box3();

  model.traverse((object) => {
    if (object instanceof Mesh && isVisibleThroughParents(object, model)) {
      bounds.expandByObject(object, true);
    }
  });

  return bounds;
}

function isVisibleThroughParents(object: Object3D, root: Object3D) {
  let current: Object3D | null = object;

  while (current) {
    if (!current.visible) {
      return false;
    }

    if (current === root) {
      return true;
    }

    current = current.parent;
  }

  return false;
}

function getProjectedBoundsCorners(bounds: Box3, projection: Matrix4) {
  const corners: Vector3[] = [];

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        corners.push(new Vector3(x, y, z).applyMatrix4(projection));
      }
    }
  }

  return corners;
}

function disposeExploreCrtModel(model: Object3D) {
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  model.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }

    object.geometry.dispose();

    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material]) {
      materials.add(material);

      for (const value of Object.values(material)) {
        if (value instanceof Texture) {
          textures.add(value);
        }
      }
    }
  });

  for (const texture of textures) {
    texture.dispose();
  }

  for (const material of materials) {
    material.dispose();
  }
}

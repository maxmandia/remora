import { copyFile, rename, stat } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const hiddenSectionNames = new Set([
  "rear_section",
  "Screw",
  "AV_back",
  "Coax_connector",
]);
const inputPath = resolve(process.argv[2] ?? "src/assets/crtv.glb");
const requestedOutputPath = resolve(process.argv[3] ?? inputPath);
const posterPath = resolve(process.argv[4] ?? "src/assets/explore-crt-tv.webp");
const outputPath =
  inputPath === requestedOutputPath
    ? resolve(
        dirname(inputPath),
        `${basename(inputPath, extname(inputPath))}.optimized${extname(inputPath)}`,
      )
    : requestedOutputPath;
const inputSize = (await stat(inputPath)).size;

await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });
const document = await io.read(inputPath);
const root = document.getRoot();
const hasHiddenSections = root
  .listNodes()
  .some((node) => hiddenSectionNames.has(node.getName()));

const screenMaterial = root
  .listMaterials()
  .find((material) => material.getName() === "TVScreen");
const frontMaterial = root
  .listMaterials()
  .find((material) => material.getName() === "TVfront");
const frontBaseColorTexture = frontMaterial?.getBaseColorTexture();

if (!screenMaterial?.getNormalTexture() || !frontBaseColorTexture) {
  throw new Error("Expected the CRT front and screen textures to exist.");
}

frontBaseColorTexture.setName("TVfront_baseColor");

const hasUnusedScreenTextures = Boolean(
  screenMaterial.getBaseColorTexture() ||
  screenMaterial.getEmissiveTexture() ||
  screenMaterial.getMetallicRoughnessTexture() ||
  screenMaterial.getOcclusionTexture(),
);
const hasUnoptimizedTextures = root.listTextures().some((texture) => {
  const [width, height] = texture.getSize();
  const maximumSize = texture === frontBaseColorTexture ? 4096 : 1024;

  return (
    texture.getMimeType() !== "image/webp" ||
    width > maximumSize ||
    height > maximumSize
  );
});
const hasMeshoptCompression = root
  .listExtensionsUsed()
  .some((extension) => extension.extensionName === "EXT_meshopt_compression");

if (
  hasHiddenSections ||
  hasUnusedScreenTextures ||
  hasUnoptimizedTextures ||
  !hasMeshoptCompression
) {
  for (const node of root.listNodes()) {
    if (hiddenSectionNames.has(node.getName())) {
      node.detach();
    }
  }

  // The runtime replaces these slots with the selected video. Preserve only
  // the normal map, which gives the video the curved-glass appearance.
  screenMaterial
    .setBaseColorTexture(null)
    .setEmissiveTexture(null)
    .setMetallicRoughnessTexture(null)
    .setOcclusionTexture(null);

  await document.transform(
    prune(),
    textureCompress({
      encoder: sharp,
      effort: 80,
      formats: /image\/(jpeg|png)/,
      pattern: /^TVfront_baseColor$/,
      quality: 95,
      resize: [4096, 4096],
      slots: /^baseColorTexture$/,
      targetFormat: "webp",
    }),
    textureCompress({
      encoder: sharp,
      effort: 80,
      formats: /image\/(jpeg|png)/,
      quality: 88,
      resize: [1024, 1024],
      slots: /^(baseColorTexture|emissiveTexture)$/,
      targetFormat: "webp",
    }),
    textureCompress({
      encoder: sharp,
      effort: 80,
      formats: /image\/(jpeg|png)/,
      lossless: true,
      resize: [1024, 1024],
      slots: /^(normalTexture|metallicRoughnessTexture|occlusionTexture)$/,
      targetFormat: "webp",
    }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  await io.write(outputPath, document);

  if (outputPath !== requestedOutputPath) {
    await rename(outputPath, requestedOutputPath);
  }

  const outputSize = (await stat(requestedOutputPath)).size;
  const reduction = 1 - outputSize / inputSize;

  console.log(
    `Optimized ${basename(requestedOutputPath)}: ${inputSize.toLocaleString()} → ${outputSize.toLocaleString()} bytes (${(reduction * 100).toFixed(1)}% smaller).`,
  );
} else {
  if (inputPath !== requestedOutputPath) {
    await copyFile(inputPath, requestedOutputPath);
  }

  console.log(`${basename(inputPath)} is already optimized.`);
}

const posterMetadata = await sharp(posterPath).metadata();

if ((posterMetadata.width ?? 0) > 1280 || (posterMetadata.height ?? 0) > 1280) {
  const posterInputSize = (await stat(posterPath)).size;
  const posterOutputPath = resolve(
    dirname(posterPath),
    `${basename(posterPath, extname(posterPath))}.optimized${extname(posterPath)}`,
  );

  await sharp(posterPath)
    .resize({
      fit: "inside",
      height: 1280,
      width: 1280,
      withoutEnlargement: true,
    })
    .webp({ effort: 6, quality: 88 })
    .toFile(posterOutputPath);
  await rename(posterOutputPath, posterPath);

  const posterOutputSize = (await stat(posterPath)).size;
  const posterReduction = 1 - posterOutputSize / posterInputSize;

  console.log(
    `Optimized ${basename(posterPath)}: ${posterInputSize.toLocaleString()} → ${posterOutputSize.toLocaleString()} bytes (${(posterReduction * 100).toFixed(1)}% smaller).`,
  );
}

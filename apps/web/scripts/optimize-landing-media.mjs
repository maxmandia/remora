import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Requires curl and ffmpeg. Match the 136 CSS pixel previews at 2x density.
const mediaOrigin = "https://pub-e0770bd34c30421082e5b93b4ed59196.r2.dev";
const sources = [
  ["neon-shark", "neon-shark-collage.jpg", "neon-shark-b721ced630f4.mp4"],
  ["fox-windstorm", "fox-windstorm.jpg", "fox-windstorm-e8a0cd3fd4d1.mp4"],
  [
    "dandelion-kitten",
    "dandelion-kitten.jpg",
    "dandelion-kitten-59fd87cda0d9.mp4",
  ],
  ["detective-fox", "detective-fox.png", "detective-fox.mp4"],
  [
    "ostrich-editorial",
    "ostrich-editorial.jpg",
    "ostrich-editorial-dba8f9614fac.mp4",
  ],
  ["android-grief", "android-grief-3.jpg", "android-grief-ad3913a4d204.mp4"],
  [
    "prehistoric-family",
    "prehistoric-family.jpg",
    "prehistoric-family-e1c9b1e3b8dd.mp4",
  ],
  ["loving-grace", "loving-grace.png", "loving-grace.mp4"],
];
const output = fileURLToPath(
  new URL("../src/assets/landing/", import.meta.url),
);
const temporary = await mkdtemp(join(tmpdir(), "remora-landing-"));
const crop =
  "scale=272:272:force_original_aspect_ratio=increase,crop=272:272,setsar=1";

await mkdir(output, { recursive: true });

try {
  for (const [name, image, video] of sources) {
    for (const [kind, source] of [
      ["image", image],
      ["video", video],
    ]) {
      const input = join(temporary, source);
      const directory =
        kind === "image" ? "explore/art" : "landing/cursor-videos";
      execFileSync("curl", [
        "--fail",
        "--silent",
        "--show-error",
        "--location",
        `${mediaOrigin}/${directory}/${source}`,
        "--output",
        input,
      ]);
      const destination = join(
        output,
        `${name}.${kind === "image" ? "webp" : "mp4"}`,
      );
      if (kind === "image") {
        await sharp(input)
          .resize(272, 272, { fit: "cover" })
          .webp({ quality: 80 })
          .toFile(destination);
      } else {
        execFileSync("ffmpeg", [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          input,
          "-vf",
          `${crop},fps=24`,
          "-an",
          "-c:v",
          "libx264",
          "-crf",
          "28",
          "-preset",
          "slow",
          "-pix_fmt",
          "yuv420p",
          "-movflags",
          "+faststart",
          destination,
        ]);
      }
      console.log(
        `${name} ${kind}: ${(await stat(input)).size} -> ${(await stat(destination)).size} bytes`,
      );
    }
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}

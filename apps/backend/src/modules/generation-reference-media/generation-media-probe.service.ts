import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { promisify } from "node:util";

import type { GenerationReferenceMediaMetadata } from "./generation-reference-media.types.ts";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

type FfprobeStaticModule = {
  path?: string;
};

type FfprobeJson = {
  streams?: FfprobeStream[];
  format?: {
    duration?: string;
  };
};

type FfprobeStream = {
  codec_type?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
  r_frame_rate?: string;
};

export type MediaMetadataProbe = {
  probe(filePath: string): Promise<GenerationReferenceMediaMetadata>;
};

export class FfprobeMediaMetadataProbe implements MediaMetadataProbe {
  private readonly ffprobePath: string;

  constructor(ffprobePath = getFfprobePath()) {
    this.ffprobePath = ffprobePath;
  }

  async probe(filePath: string): Promise<GenerationReferenceMediaMetadata> {
    const { stdout } = await execFileAsync(this.ffprobePath, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ]);
    const result = JSON.parse(stdout) as FfprobeJson;

    return toMediaMetadata(result);
  }
}

export function toMediaMetadata(
  result: FfprobeJson,
): GenerationReferenceMediaMetadata {
  const streams = result.streams ?? [];
  const videoStream = streams.find((stream) => stream.codec_type === "video");
  const audioStream = streams.find((stream) => stream.codec_type === "audio");
  const durationSec =
    parseFiniteNumber(videoStream?.duration) ??
    parseFiniteNumber(audioStream?.duration) ??
    parseFiniteNumber(result.format?.duration);

  return {
    widthPx: videoStream?.width ?? null,
    heightPx: videoStream?.height ?? null,
    durationSec: durationSec ?? null,
    fps:
      parseFrameRate(videoStream?.avg_frame_rate) ??
      parseFrameRate(videoStream?.r_frame_rate) ??
      null,
  };
}

function getFfprobePath() {
  const ffprobeStatic = require("ffprobe-static") as FfprobeStaticModule;
  const ffprobePath = ffprobeStatic.path;

  if (!ffprobePath) {
    throw new Error("ffprobe-static did not provide an executable path");
  }

  return ffprobePath;
}

function parseFiniteNumber(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function parseFrameRate(value: string | undefined) {
  if (!value || value === "0/0") {
    return null;
  }

  const [numerator, denominator] = value.split("/");

  if (!denominator) {
    return parseFiniteNumber(value);
  }

  const parsedNumerator = Number(numerator);
  const parsedDenominator = Number(denominator);

  if (
    !Number.isFinite(parsedNumerator) ||
    !Number.isFinite(parsedDenominator) ||
    parsedDenominator === 0
  ) {
    return null;
  }

  return parsedNumerator / parsedDenominator;
}

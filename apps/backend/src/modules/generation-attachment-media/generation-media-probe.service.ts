import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { GenerationAttachmentMediaMetadata } from "./generation-attachment-media.types.ts";

const execFileAsync = promisify(execFile);

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
  probe(filePath: string): Promise<GenerationAttachmentMediaMetadata>;
};

export type FfprobeExecutor = (
  executable: string,
  args: string[],
) => Promise<{ stdout: string }>;

export class FfprobeMediaMetadataProbe implements MediaMetadataProbe {
  constructor(
    private readonly ffprobePath = "ffprobe",
    private readonly execute: FfprobeExecutor = executeFfprobe,
  ) {}

  async probe(filePath: string): Promise<GenerationAttachmentMediaMetadata> {
    const { stdout } = await this.execute(this.ffprobePath, [
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
): GenerationAttachmentMediaMetadata {
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

async function executeFfprobe(executable: string, args: string[]) {
  const { stdout } = await execFileAsync(executable, args, {
    encoding: "utf8",
  });

  return { stdout };
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

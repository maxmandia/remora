import { describe, expect, it, vi } from "vitest";

import {
  FfprobeMediaMetadataProbe,
  type FfprobeExecutor,
} from "./generation-media-probe.service.ts";

describe("ffprobe media metadata probe", () => {
  it("invokes ffprobe from PATH and parses video metadata", async () => {
    const execute = vi.fn<FfprobeExecutor>(async () => ({
      stdout: JSON.stringify({
        streams: [
          {
            codec_type: "video",
            width: 1920,
            height: 1080,
            duration: "5.25",
            avg_frame_rate: "30000/1001",
          },
        ],
        format: { duration: "6" },
      }),
    }));
    const probe = new FfprobeMediaMetadataProbe(undefined, execute);

    await expect(probe.probe("/tmp/input.mp4")).resolves.toEqual({
      widthPx: 1920,
      heightPx: 1080,
      durationSec: 5.25,
      fps: 30000 / 1001,
    });
    expect(execute).toHaveBeenCalledWith("ffprobe", [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "/tmp/input.mp4",
    ]);
  });

  it("supports an injected executable and executor", async () => {
    const execute = vi.fn<FfprobeExecutor>(async () => ({
      stdout: JSON.stringify({
        streams: [{ codec_type: "audio", duration: "2.5" }],
      }),
    }));
    const probe = new FfprobeMediaMetadataProbe(
      "/opt/media/bin/ffprobe",
      execute,
    );

    await expect(probe.probe("/tmp/audio.wav")).resolves.toEqual({
      widthPx: null,
      heightPx: null,
      durationSec: 2.5,
      fps: null,
    });
    expect(execute).toHaveBeenCalledWith(
      "/opt/media/bin/ffprobe",
      expect.arrayContaining(["/tmp/audio.wav"]),
    );
  });
});

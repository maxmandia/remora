import type { VideoModelSpec } from "../../../model/model.types.ts";

export type SeedanceImageRole =
  | "first_frame"
  | "last_frame"
  | "reference_image";
export type SeedanceVideoRole = "reference_video";
export type SeedanceAudioRole = "reference_audio";

export type SeedanceImageInput = {
  url: string;
  role?: SeedanceImageRole;
};

export type SeedanceVideoInput = {
  url: string;
  role?: SeedanceVideoRole;
};

export type SeedanceAudioInput = {
  url: string;
  role?: SeedanceAudioRole;
};

export type SeedanceVideoTaskOptions = {
  resolution?: string;
  aspectRatio?: string;
  duration?: number;
  generateAudio?: boolean;
  watermark?: boolean;
  seed?: number;
  returnLastFrame?: boolean;
  priority?: number;
  safetyIdentifier?: string;
  callbackUrl?: string;
  executionExpiresAfter?: number;
  serviceTier?: "default" | "flex";
  draft?: boolean;
  frames?: number;
  cameraFixed?: boolean;
};

export type SeedanceVideoTaskPayloadInput = SeedanceVideoTaskOptions & {
  prompt?: string;
  images?: SeedanceImageInput[];
  videos?: SeedanceVideoInput[];
  audios?: SeedanceAudioInput[];
  draftTaskId?: string;
};

export type SeedanceVideoTaskRequest = {
  model: string;
  content: SeedanceContentItem[];
  resolution?: string;
  ratio?: string;
  duration?: number;
  generate_audio?: boolean;
  watermark?: boolean;
  seed?: number;
  return_last_frame?: boolean;
  priority?: number;
  safety_identifier?: string;
  callback_url?: string;
  execution_expires_after?: number;
  service_tier?: "default";
  draft?: boolean;
  frames?: number;
  camera_fixed?: boolean;
};

export type SeedanceContentItem =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: { url: string };
      role?: SeedanceImageRole;
    }
  | {
      type: "video_url";
      video_url: { url: string };
      role: SeedanceVideoRole;
    }
  | {
      type: "audio_url";
      audio_url: { url: string };
      role: SeedanceAudioRole;
    }
  | {
      type: "draft_task";
      draft_task: { id: string };
    };

export type SeedancePayloadBuildInput = {
  spec: VideoModelSpec;
  input: SeedanceVideoTaskPayloadInput;
};

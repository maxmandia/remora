import type { VideoModelSpec } from "../../../model/model.types.ts";
import type { CreateVideoTaskInput } from "../../generation.types.ts";

export type KlingVideoTaskRequest = {
  model_name: string;
  prompt: string;
  mode: "pro";
  duration: string;
  aspect_ratio: "16:9" | "9:16" | "1:1";
  sound: "on" | "off";
  callback_url: string;
  external_task_id: string;
};

export type KlingVideoTaskBuildInput = {
  spec: VideoModelSpec;
  input: CreateVideoTaskInput;
};

export type KlingProviderTaskStatus =
  | "submitted"
  | "processing"
  | "succeed"
  | "failed";

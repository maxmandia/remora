import { parseBytePlusProviderEnv } from "@remora/env";

import type { VideoModelSpec } from "../../../model/model.types.ts";
import type {
  CreateVideoTaskInput,
  CreateVideoTaskResult,
  GenerationProviderTaskResult,
} from "../../generation.types.ts";
import { BytePlusClient } from "./byteplus.client.ts";
import {
  buildSeedanceVideoTaskRequest,
  toSeedanceAttachmentMedia,
} from "./byteplus.payload.ts";

export class BytePlusService {
  // Narrows callbackUrl from string | null — this provider requires a callback.
  async createVideoTask({
    spec,
    input,
  }: {
    spec: VideoModelSpec;
    input: CreateVideoTaskInput & { callbackUrl: string };
  }): Promise<CreateVideoTaskResult> {
    const request = buildSeedanceVideoTaskRequest({
      spec,
      input: {
        ...input.submittedInput,
        ...toSeedanceAttachmentMedia(input.attachmentMedia),
        callbackUrl: input.callbackUrl,
      },
    });
    const client = this.createConfiguredClient();

    return client.createVideoTask(request);
  }

  normalizeVideoTaskResult(rawPayload: unknown): GenerationProviderTaskResult {
    return BytePlusClient.normalizeVideoTaskResponse(rawPayload);
  }

  private createConfiguredClient(): BytePlusClient {
    const env = parseBytePlusProviderEnv(process.env);

    return new BytePlusClient({
      apiKey: env.BYTEPLUS_ARK_API_KEY,
      baseUrl: env.BYTEPLUS_ARK_BASE_URL,
    });
  }
}

export const bytePlusService = new BytePlusService();

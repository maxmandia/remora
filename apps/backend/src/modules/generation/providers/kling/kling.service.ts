import { parseKlingProviderEnv } from "@remora/env";

import type { VideoModelSpec } from "../../../model/model.types.ts";
import type {
  CreateVideoTaskInput,
  CreateVideoTaskResult,
  GenerationProviderTaskResult,
} from "../../generation.types.ts";
import { requestProviderJson } from "../provider-http.ts";
import {
  buildKlingVideoTaskRequest,
  normalizeKlingVideoTaskResult,
  parseKlingCreateVideoTaskResponse,
} from "./kling.utils.ts";

type Fetch = typeof fetch;

type KlingServiceOptions = {
  environment?: NodeJS.ProcessEnv;
  fetcher?: Fetch;
};

export class KlingService {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly fetcher: Fetch;

  constructor({
    environment = process.env,
    fetcher = fetch,
  }: KlingServiceOptions = {}) {
    this.environment = environment;
    this.fetcher = fetcher;
  }

  async createVideoTask({
    spec,
    input,
  }: {
    spec: VideoModelSpec;
    input: CreateVideoTaskInput;
  }): Promise<CreateVideoTaskResult> {
    const env = parseKlingProviderEnv(this.environment);
    const request = buildKlingVideoTaskRequest({ spec, input });
    const response = await requestProviderJson({
      providerName: "Kling",
      baseUrl: env.KLING_API_BASE_URL,
      path: spec.endpoint.path,
      fetcher: this.fetcher,
      init: {
        method: "POST",
        body: JSON.stringify(request),
        headers: {
          Authorization: `Bearer ${env.KLING_API_KEY}`,
        },
      },
    });

    return parseKlingCreateVideoTaskResponse(response, request.model_name);
  }

  normalizeVideoTaskResult(
    rawPayload: unknown,
    providerModelId: string,
  ): GenerationProviderTaskResult {
    return normalizeKlingVideoTaskResult(rawPayload, providerModelId);
  }
}

export const klingService = new KlingService();

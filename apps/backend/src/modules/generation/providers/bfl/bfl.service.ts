import { parseBflProviderEnv } from "@remora/env";

import type { VideoModelSpec } from "../../../model/model.types.ts";
import type {
  CreateVideoTaskInput,
  CreateVideoTaskResult,
} from "../../generation.types.ts";
import { requestProviderJson } from "../provider-http.ts";
import {
  buildBflVideoTaskRequest,
  normalizeBflVideoTaskResult,
  parseBflCreateVideoTaskResponse,
  toBflProviderError,
  validateBflPollingUrl,
} from "./bfl.utils.ts";

type Fetch = typeof fetch;

type BflServiceOptions = {
  environment?: NodeJS.ProcessEnv;
  fetcher?: Fetch;
};

export class BflService {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly fetcher: Fetch;

  constructor({
    environment = process.env,
    fetcher = fetch,
  }: BflServiceOptions = {}) {
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
    const environment = parseBflProviderEnv(this.environment);
    const request = buildBflVideoTaskRequest({ spec, input });

    try {
      const response = await requestProviderJson({
        providerName: "BFL",
        baseUrl: environment.BFL_API_BASE_URL,
        path: spec.endpoint.path,
        fetcher: this.fetcher,
        init: {
          method: "POST",
          body: JSON.stringify(request),
          headers: { "x-key": environment.BFL_API_KEY },
        },
      });
      const result = parseBflCreateVideoTaskResponse(response);

      return {
        ...result,
        pollingUrl: validateBflPollingUrl(
          result.pollingUrl,
          environment.BFL_API_BASE_URL,
        ),
      };
    } catch (error) {
      throw toBflProviderError(error);
    }
  }

  async retrieveVideoTask(pollingUrl: string): Promise<unknown> {
    const environment = parseBflProviderEnv(this.environment);
    const validatedUrl = new URL(
      validateBflPollingUrl(pollingUrl, environment.BFL_API_BASE_URL),
    );

    try {
      return await requestProviderJson({
        providerName: "BFL",
        baseUrl: validatedUrl.origin,
        path: `${validatedUrl.pathname}${validatedUrl.search}`,
        fetcher: this.fetcher,
        init: {
          method: "GET",
          headers: { "x-key": environment.BFL_API_KEY },
        },
      });
    } catch (error) {
      throw toBflProviderError(error);
    }
  }

  normalizeVideoTaskResult(input: {
    expectedProviderTaskId: string;
    providerModelId: string;
    value: unknown;
  }) {
    return normalizeBflVideoTaskResult(input);
  }
}

export const bflService = new BflService();

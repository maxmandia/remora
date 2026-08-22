import { parseTripoProviderEnv } from "@remora/env";

import type { Model3dModelSpec } from "../../../model/model.types.ts";
import type {
  CreateModel3dTaskInput,
  CreateModel3dTaskResult,
  GenerationProviderTaskResult,
} from "../../generation.types.ts";
import { isJsonObject, ProviderHttpError } from "../provider-http.ts";
import {
  buildTripoModel3dTaskRequest,
  normalizeTripoModel3dTaskResult,
  parseTripoCreateModel3dTaskResponse,
  toTripoProviderError,
} from "./tripo.utils.ts";
import {
  TripoProviderError,
  type TripoModelId,
} from "./tripo.types.ts";

type Fetch = typeof fetch;

type TripoServiceOptions = {
  environment?: NodeJS.ProcessEnv;
  fetcher?: Fetch;
};

export class TripoService {
  private readonly environment: NodeJS.ProcessEnv;
  private readonly fetcher: Fetch;

  constructor({
    environment = process.env,
    fetcher = fetch,
  }: TripoServiceOptions = {}) {
    this.environment = environment;
    this.fetcher = fetcher;
  }

  async createModel3dTask({
    spec,
    input,
  }: {
    spec: Model3dModelSpec;
    input: CreateModel3dTaskInput;
  }): Promise<CreateModel3dTaskResult> {
    const environment = parseTripoProviderEnv(this.environment);
    const request = buildTripoModel3dTaskRequest({ spec, input });

    try {
      const response = await this.requestJson({
        baseUrl: environment.TRIPO_API_BASE_URL,
        path: spec.endpoint.path,
        apiKey: environment.TRIPO_API_KEY,
        init: { method: "POST", body: JSON.stringify(request) },
      });
      return parseTripoCreateModel3dTaskResponse(
        response,
        request.model as TripoModelId,
      );
    } catch (error) {
      throw toTripoProviderError(error);
    }
  }

  async retrieveModel3dTask(providerTaskId: string): Promise<unknown> {
    const environment = parseTripoProviderEnv(this.environment);
    if (!providerTaskId || providerTaskId.includes("/")) {
      throw new TripoProviderError({
        code: "INVALID_TASK_ID",
        message: "Tripo task id was invalid",
        providerMessage: null,
        retryable: false,
        statusCode: null,
      });
    }

    try {
      return await this.requestJson({
        baseUrl: environment.TRIPO_API_BASE_URL,
        path: `/tasks/${encodeURIComponent(providerTaskId)}`,
        apiKey: environment.TRIPO_API_KEY,
        init: { method: "GET" },
      });
    } catch (error) {
      throw toTripoProviderError(error);
    }
  }

  normalizeModel3dTaskResult(input: {
    expectedProviderTaskId: string;
    providerModelId: string;
    value: unknown;
  }): GenerationProviderTaskResult {
    try {
      return normalizeTripoModel3dTaskResult(input);
    } catch (error) {
      throw toTripoProviderError(error);
    }
  }

  private async requestJson({
    baseUrl,
    path,
    apiKey,
    init,
  }: {
    baseUrl: string;
    path: string;
    apiKey: string;
    init: RequestInit;
  }) {
    let response: Response;
    try {
      response = await this.fetcher(
        new URL(path.replace(/^\/+/, ""), `${baseUrl}/`),
        {
          ...init,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            ...init.headers,
          },
        },
      );
    } catch (error) {
      throw new TripoProviderError({
        code: null,
        message: error instanceof Error ? error.message : "Tripo request failed",
        providerMessage: null,
        retryable: true,
        statusCode: null,
      });
    }

    const body = await response.text();
    let parsed: unknown = null;
    if (body) {
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        throw new ProviderHttpError("Tripo", "response was not valid JSON", {
          statusCode: response.status,
          code: null,
          providerMessage: null,
        });
      }
    }

    if (!response.ok) {
      const code =
        isJsonObject(parsed) &&
        (typeof parsed.code === "string" || typeof parsed.code === "number")
          ? String(parsed.code)
          : null;
      const providerMessage =
        isJsonObject(parsed) && typeof parsed.message === "string"
          ? parsed.message
          : null;
      const requestId =
        isJsonObject(parsed) && typeof parsed.request_id === "string"
          ? parsed.request_id
          : null;
      const retryable = response.status === 429 || response.status >= 500;

      throw new TripoProviderError({
        code,
        message: `Tripo request failed (HTTP ${response.status})`,
        providerMessage,
        retryable,
        retryAfterMs: retryable
          ? parseRetryAfterMs(response.headers.get("Retry-After"))
          : null,
        statusCode: response.status,
        requestId,
      });
    }

    return parsed;
  }
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

export const tripoService = new TripoService();

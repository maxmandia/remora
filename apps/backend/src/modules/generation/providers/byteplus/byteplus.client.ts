import type {
  CreateVideoTaskResult,
  GenerationProviderTaskError,
  GenerationProviderTaskResult,
  GenerationProviderTaskStatus,
  GenerationProviderTaskUsage,
} from "../../generation.types.ts";
import {
  isJsonObject,
  ProviderHttpError,
  requestProviderJson,
} from "../provider-http.ts";

import type { SeedanceVideoTaskRequest } from "./byteplus.types.ts";

type Fetch = typeof fetch;

export type BytePlusClientConfig = {
  apiKey: string;
  baseUrl: string;
  fetcher?: Fetch;
};

export class BytePlusClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetcher: Fetch;

  constructor({ apiKey, baseUrl, fetcher = fetch }: BytePlusClientConfig) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetcher = fetcher;
  }

  async createVideoTask(
    request: SeedanceVideoTaskRequest,
  ): Promise<CreateVideoTaskResult> {
    const response = await requestProviderJson({
      providerName: "BytePlus",
      baseUrl: this.baseUrl,
      fetcher: this.fetcher,
      path: "/contents/generations/tasks",
      init: {
        method: "POST",
        body: JSON.stringify(request),
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    });

    return this.parseCreateResponse(response, request.model);
  }

  async retrieveVideoTask(
    providerTaskId: string,
  ): Promise<GenerationProviderTaskResult> {
    const response = await requestProviderJson({
      providerName: "BytePlus",
      baseUrl: this.baseUrl,
      fetcher: this.fetcher,
      path: `/contents/generations/tasks/${encodeURIComponent(providerTaskId)}`,
      init: {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      },
    });

    return BytePlusClient.normalizeVideoTaskResponse(response);
  }

  static normalizeVideoTaskResponse(
    value: unknown,
  ): GenerationProviderTaskResult {
    if (
      !isJsonObject(value) ||
      typeof value.id !== "string" ||
      !BytePlusClient.isProviderStatus(value.status)
    ) {
      throw new ProviderHttpError(
        "BytePlus",
        "retrieve response was malformed",
        {
          statusCode: null,
          code: null,
          providerMessage: null,
        },
      );
    }

    return {
      provider: "byteplus",
      providerTaskId: value.id,
      providerModelId: typeof value.model === "string" ? value.model : null,
      status: value.status,
      videoUrl: BytePlusClient.parseContentUrl(value.content, "video_url"),
      usage: BytePlusClient.parseUsage(value.usage),
      createdAt: typeof value.created_at === "number" ? value.created_at : null,
      updatedAt: typeof value.updated_at === "number" ? value.updated_at : null,
      providerError: BytePlusClient.parseTaskError(value.error),
    };
  }

  private parseCreateResponse(
    value: unknown,
    providerModelId: string,
  ): CreateVideoTaskResult {
    if (!isJsonObject(value) || typeof value.id !== "string") {
      throw new ProviderHttpError("BytePlus", "create response was malformed", {
        statusCode: null,
        code: null,
        providerMessage: null,
      });
    }

    return {
      provider: "byteplus",
      providerTaskId: value.id,
      providerModelId,
    };
  }

  private static parseContentUrl(content: unknown, key: "video_url") {
    if (!isJsonObject(content)) {
      return null;
    }

    return typeof content[key] === "string" ? content[key] : null;
  }

  private static parseUsage(
    usage: unknown,
  ): GenerationProviderTaskUsage | null {
    if (!isJsonObject(usage)) {
      return null;
    }

    return {
      completionTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : null,
      totalTokens:
        typeof usage.total_tokens === "number" ? usage.total_tokens : null,
    };
  }

  private static parseTaskError(
    error: unknown,
  ): GenerationProviderTaskError | null {
    if (!isJsonObject(error)) {
      return null;
    }

    return {
      code: typeof error.code === "string" ? error.code : null,
      message: typeof error.message === "string" ? error.message : null,
    };
  }

  private static isProviderStatus(
    status: unknown,
  ): status is GenerationProviderTaskStatus {
    return (
      status === "queued" ||
      status === "running" ||
      status === "cancelled" ||
      status === "succeeded" ||
      status === "failed" ||
      status === "expired"
    );
  }
}

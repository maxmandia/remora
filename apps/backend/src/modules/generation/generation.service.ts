import { createHash, randomBytes } from "node:crypto";

import { parseBytePlusProviderEnv } from "@remora/env";
import { generationRepository } from "./generation.repository.ts";
import { BytePlusSeedanceClient } from "./providers/byteplus/seedance.client.ts";
import { buildSeedanceVideoTaskRequest } from "./providers/byteplus/seedance.payload.ts";
import type {
  JsonPrimitive,
  VideoFieldSpec,
  VideoModelSpec,
} from "../model/types.ts";
import type { GenerationRepository } from "./generation.repository.ts";
import type {
  CreateVideoGenerationFieldId,
  CreatedVideoGenerationJob,
  CreateSeedanceVideoTaskInput,
  CreateSeedanceVideoTaskResult,
  CreateVideoGenerationInput,
  GenerationJobSubmittedInput,
  RetrieveSeedanceVideoTaskInput,
  RetrieveSeedanceVideoTaskResult,
} from "./generation.types.ts";
import {
  createVideoGenerationFieldIds,
  GenerationInputValidationError,
  supportedVideoGenerationModelId,
  UnsupportedGenerationModelError,
} from "./generation.types.ts";

export class GenerationService {
  constructor(
    private readonly repository: GenerationRepository = generationRepository,
  ) {}

  async createVideoGenerationJob({
    userId,
    input,
  }: {
    userId: string;
    input: CreateVideoGenerationInput;
  }): Promise<CreatedVideoGenerationJob> {
    const modelSpec = await this.getSupportedVideoModelSpec(input.modelId);
    const submittedInput = this.toSubmittedInput(input);
    const callbackToken = this.createGenerationCallbackToken();

    this.validateCreateVideoInputAgainstSpec({
      input: {
        ...input,
        ...submittedInput,
      },
      spec: modelSpec.spec,
    });

    const job = await this.repository.insertGenerationJob({
      userId,
      input,
      modelSpec,
      submittedInput,
      callbackTokenHash: this.hashGenerationCallbackToken(callbackToken),
    });

    return {
      job,
      callbackToken,
    };
  }

  async createSeedanceVideoTask(
    input: CreateSeedanceVideoTaskInput,
  ): Promise<CreateSeedanceVideoTaskResult> {
    const spec = await this.getPublishedSeedanceSpec();
    const request = buildSeedanceVideoTaskRequest({ spec, input });
    const client = this.createConfiguredBytePlusClient();

    return client.createSeedanceVideoTask(request);
  }

  async retrieveSeedanceVideoTask({
    providerTaskId,
  }: RetrieveSeedanceVideoTaskInput): Promise<RetrieveSeedanceVideoTaskResult> {
    const client = this.createConfiguredBytePlusClient();

    return client.retrieveSeedanceVideoTask(providerTaskId);
  }

  private async getPublishedSeedanceSpec(): Promise<VideoModelSpec> {
    return (
      await this.getSupportedVideoModelSpec(supportedVideoGenerationModelId)
    ).spec;
  }

  private async getSupportedVideoModelSpec(modelId: string) {
    if (modelId !== supportedVideoGenerationModelId) {
      throw new UnsupportedGenerationModelError(modelId);
    }

    const modelSpec =
      await this.repository.getLatestPublishedGenerationModelSpec(modelId);

    if (!modelSpec) {
      throw new Error("Published Seedance model spec was not found");
    }

    return modelSpec;
  }

  private toSubmittedInput(
    input: CreateVideoGenerationInput,
  ): GenerationJobSubmittedInput {
    return {
      prompt: input.prompt.trim(),
      aspectRatio: input.aspectRatio,
      duration: input.duration,
      generateAudio: input.generateAudio,
    };
  }

  private validateCreateVideoInputAgainstSpec({
    input,
    spec,
  }: {
    input: CreateVideoGenerationInput;
    spec: VideoModelSpec;
  }) {
    for (const fieldId of createVideoGenerationFieldIds) {
      this.validateFieldValue({
        field: this.getRequiredField(spec, fieldId),
        value: input[fieldId],
      });
    }
  }

  private getRequiredField(
    spec: VideoModelSpec,
    fieldId: CreateVideoGenerationFieldId,
  ) {
    const field = spec.fields.find((candidate) => candidate.id === fieldId);

    if (!field) {
      throw new GenerationInputValidationError(
        fieldId,
        `${fieldId} is not supported by this model`,
      );
    }

    return field;
  }

  private validateFieldValue({
    field,
    value,
  }: {
    field: VideoFieldSpec;
    value: JsonPrimitive;
  }) {
    this.validateFieldValueKind(field, value);
    this.validateFieldBounds(field, value);
    this.validateFieldOptions(field, value);
  }

  private validateFieldValueKind(field: VideoFieldSpec, value: JsonPrimitive) {
    if (field.valueKind === "integer" && !Number.isInteger(value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be an integer`,
      );
    }

    if (field.valueKind === "number" && typeof value !== "number") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a number`,
      );
    }

    if (field.valueKind === "boolean" && typeof value !== "boolean") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a boolean`,
      );
    }

    if (field.valueKind === "string" && typeof value !== "string") {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must be a string`,
      );
    }
  }

  private validateFieldBounds(field: VideoFieldSpec, value: JsonPrimitive) {
    if (typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be greater than or equal to ${field.min}`,
        );
      }

      if (field.max !== undefined && value > field.max) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be less than or equal to ${field.max}`,
        );
      }
    }

    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at least ${field.minLength} characters`,
        );
      }

      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new GenerationInputValidationError(
          field.id,
          `${field.id} must be at most ${field.maxLength} characters`,
        );
      }
    }
  }

  private validateFieldOptions(field: VideoFieldSpec, value: JsonPrimitive) {
    if (!field.options || field.options.length === 0) {
      return;
    }

    if (!field.options.some((option) => option.value === value)) {
      throw new GenerationInputValidationError(
        field.id,
        `${field.id} must match a supported model option`,
      );
    }
  }

  private createConfiguredBytePlusClient() {
    const env = parseBytePlusProviderEnv(process.env);

    return new BytePlusSeedanceClient({
      apiKey: env.BYTEPLUS_ARK_API_KEY,
      baseUrl: env.BYTEPLUS_ARK_BASE_URL,
    });
  }

  private createGenerationCallbackToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashGenerationCallbackToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }
}

export const generationService = new GenerationService();

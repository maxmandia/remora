import type {
  JsonPrimitive,
  VideoFieldSpec,
  VideoProviderPathSegment,
} from "../model/types.ts";

export type ModelFieldPayloadValue =
  | string
  | number
  | boolean
  | null
  | undefined;

export class ModelFieldPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelFieldPayloadError";
  }
}

export class ModelFieldPayloadBuilder {
  constructor(private readonly payload: Record<string, unknown>) {}

  applyFieldValues({
    fields,
    values,
  }: {
    fields: readonly VideoFieldSpec[];
    values: ReadonlyMap<string, ModelFieldPayloadValue>;
  }) {
    for (const field of fields) {
      const value = values.get(field.id);

      if (value === undefined || !field.providerPath) {
        continue;
      }

      this.validateFieldValue(field, value);

      if (this.shouldOmitFieldValue(field, value)) {
        continue;
      }

      this.setProviderValue(
        field.providerPath,
        this.mapProviderValue(field, value),
      );
    }
  }

  setProviderValue(path: readonly VideoProviderPathSegment[], value: unknown) {
    let current = this.payload;

    for (const [index, segment] of path.entries()) {
      const isLast = index === path.length - 1;

      if (isLast) {
        current[String(segment)] = value;
        return;
      }

      const key = String(segment);
      const existing = current[key];

      if (
        !existing ||
        typeof existing !== "object" ||
        Array.isArray(existing)
      ) {
        current[key] = {};
      }

      current = current[key] as Record<string, unknown>;
    }
  }

  private validateFieldValue(
    field: VideoFieldSpec,
    value: ModelFieldPayloadValue,
  ) {
    if (value === null || value === undefined) {
      return;
    }

    if (
      field.valueKind === "integer" &&
      (!Number.isInteger(value) || typeof value !== "number")
    ) {
      throw new ModelFieldPayloadError(`${field.id} must be an integer`);
    }

    if (field.valueKind === "number" && typeof value !== "number") {
      throw new ModelFieldPayloadError(`${field.id} must be a number`);
    }

    if (field.valueKind === "boolean" && typeof value !== "boolean") {
      throw new ModelFieldPayloadError(`${field.id} must be a boolean`);
    }

    if (field.valueKind === "string" && typeof value !== "string") {
      throw new ModelFieldPayloadError(`${field.id} must be a string`);
    }

    if (typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        throw new ModelFieldPayloadError(
          `${field.id} must be greater than or equal to ${field.min}`,
        );
      }

      if (field.max !== undefined && value > field.max) {
        throw new ModelFieldPayloadError(
          `${field.id} must be less than or equal to ${field.max}`,
        );
      }
    }

    if (typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) {
        throw new ModelFieldPayloadError(
          `${field.id} must be at least ${field.minLength} characters`,
        );
      }

      if (field.maxLength !== undefined && value.length > field.maxLength) {
        throw new ModelFieldPayloadError(
          `${field.id} must be at most ${field.maxLength} characters`,
        );
      }
    }
  }

  private shouldOmitFieldValue(
    field: VideoFieldSpec,
    value: ModelFieldPayloadValue,
  ) {
    if (field.omitWhenEmpty && (value === "" || value === null)) {
      return true;
    }

    return field.omitWhenDefault && value === field.defaultValue;
  }

  private mapProviderValue(
    field: VideoFieldSpec,
    value: ModelFieldPayloadValue,
  ): JsonPrimitive {
    const mappedValue = field.providerValueMap?.find(
      (entry) => entry.canonicalValue === value,
    )?.providerValue;

    if (mappedValue !== undefined) {
      return mappedValue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    return null;
  }
}
